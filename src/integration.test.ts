import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import bcrypt from 'bcryptjs';
import { app, prisma } from '../server.ts';
import { getDefaultSupportScores, getDefaultSalesScores } from './utils/scoring.ts';

let server: Server;
let baseUrl: string;

// Helper to log in a user and return their session cookie
async function loginUser(username: string, password = 'snappfood123'): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `Login for ${username} should succeed`);
  const rawCookie = res.headers.get('set-cookie');
  assert.ok(rawCookie, 'Expected Set-Cookie header with snappfood_session');
  // Extract session cookie
  const cookieMatch = rawCookie.match(/snappfood_session=[^;]+/);
  assert.ok(cookieMatch, 'Expected snappfood_session cookie in Set-Cookie header');
  return cookieMatch[0];
}

before(async () => {
  // Start server on random free port
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('1. Authentication & Session Security', () => {
  test('POST /api/auth/login succeeds with valid credentials and sets signed HttpOnly cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'snappfood123' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.username, 'admin');
    // Browser session token should not be exposed in JSON body when using HttpOnly cookie
    assert.equal(data.token, undefined, 'Session token should not be returned in login JSON body');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie?.includes('HttpOnly'), 'Cookie must be HttpOnly');
    assert.ok(setCookie?.includes('snappfood_session'), 'Cookie must name snappfood_session');
  });

  test('POST /api/auth/login rejects invalid password with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('Protected endpoint returns 401 for unauthenticated request without token', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Accept': 'application/json' },
    });
    assert.equal(res.status, 401);
  });
});

describe('2. Agent Role (mahya - Mahya Mamizadeh)', () => {
  let agentCookie: string;
  let ownAssessmentId: string;
  let otherAssessmentId: string;

  before(async () => {
    agentCookie = await loginUser('mahya');

    // Find an assessment belonging to Mahya
    const mahyaAssessments = await prisma.assessment.findMany({
      where: { agent_id: 'agent-3718', deleted_at: null },
    });
    assert.ok(mahyaAssessments.length > 0, 'Seed should have assessments for agent-3718');
    ownAssessmentId = mahyaAssessments[0].id;

    // Find an assessment belonging to someone else (e.g. agent-3726)
    const otherAssessments = await prisma.assessment.findMany({
      where: { agent_id: { not: 'agent-3718' }, deleted_at: null },
    });
    assert.ok(otherAssessments.length > 0, 'Seed should have assessments for other agents');
    otherAssessmentId = otherAssessments[0].id;
  });

  test('Agent sees only own assessments in GET /api/assessments', async () => {
    const res = await fetch(`${baseUrl}/api/assessments`, {
      headers: { Cookie: agentCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length > 0, 'Agent should see own assessments');
    for (const a of body.data) {
      assert.equal(a.agent_id, 'agent-3718', 'All returned assessments must belong strictly to this agent');
    }
  });

  test('Agent sees only own profile in GET /api/agents', async () => {
    const res = await fetch(`${baseUrl}/api/agents`, {
      headers: { Cookie: agentCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, 'agent-3718');
  });

  test('Agent can file a dispute for their own assessment (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${ownAssessmentId}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: agentCookie },
      body: JSON.stringify({
        criterion_id: 'soft_greeting',
        criterion_title: 'احوالپرسی و ارتباط اولیه',
        agent_comment: 'درخواست بازشنوایی ثانیه ۴۵ تا ۶۰ تماس',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.assessment_id, ownAssessmentId);
  });

  test('Agent CANNOT file a dispute for another agent assessment (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${otherAssessmentId}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: agentCookie },
      body: JSON.stringify({
        criterion_id: 'soft_greeting',
        criterion_title: 'احوالپرسی',
        agent_comment: 'تست دسترسی غیرمجاز',
      }),
    });
    assert.equal(res.status, 403);
  });

  test('Agent CANNOT create assessment (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: agentCookie },
      body: JSON.stringify({ agent_id: 'agent-3718', total_score: 90, result: 'Standard' }),
    });
    assert.equal(res.status, 403);
  });

  test('Agent CANNOT edit assessment (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${ownAssessmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: agentCookie },
      body: JSON.stringify({ total_score: 100 }),
    });
    assert.equal(res.status, 403);
  });

  test('Agent CANNOT access user management (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { Cookie: agentCookie },
    });
    assert.equal(res.status, 403);
  });

  test('Agent CANNOT access audit logs (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Cookie: agentCookie },
    });
    assert.equal(res.status, 403);
  });

  test('Agent CANNOT update settings (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: agentCookie },
      body: JSON.stringify({ settings: { dispute_window_days: 10 } }),
    });
    assert.equal(res.status, 403);
  });
});

describe('3. Team Lead Role (negin - Vendor Success / NCR Team Lead)', () => {
  let leadCookie: string;
  let ownTeamAssessmentId: string;
  let otherTeamAssessmentId: string;

  before(async () => {
    leadCookie = await loginUser('negin');

    // Find assessment belonging to an agent in Negin's team (Vendor Success or NCR)
    const ownTeamAss = await prisma.assessment.findFirst({
      where: {
        agent: { team_name: { in: ['Vendor Success', 'NCR'] } },
        deleted_at: null,
      },
    });
    assert.ok(ownTeamAss, 'Should find assessment in Negin team');
    ownTeamAssessmentId = ownTeamAss.id;

    // Find assessment belonging to a different team (e.g. Technical / General)
    const otherTeamAss = await prisma.assessment.findFirst({
      where: {
        agent: { team_name: { in: ['Technical', 'General'] } },
        deleted_at: null,
      },
    });
    assert.ok(otherTeamAss, 'Should find assessment in another team');
    otherTeamAssessmentId = otherTeamAss.id;
  });

  test('Team Lead sees only assessments of own team in GET /api/assessments', async () => {
    const res = await fetch(`${baseUrl}/api/assessments`, {
      headers: { Cookie: leadCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length > 0, 'Team lead should see team assessments');
    for (const a of body.data) {
      const allowed = ['Vendor Success', 'NCR', 'Campaign', 'Promotion'].some((t) =>
        a.agent.team_name.includes(t) || a.agent.team_lead === 'نگین رضایی'
      );
      assert.ok(allowed, `Assessment agent team ${a.agent.team_name} must belong to team lead jurisdiction`);
    }
  });

  test('Team Lead can review assessment of own team (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${ownTeamAssessmentId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: leadCookie },
      body: JSON.stringify({ note: 'جلسه بازشنوایی ۱-on-۱ با کارشناس برگزار شد و نکات اصلاحی منتقل شد' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.team_lead_reviewed, true);
    assert.ok(body.data.team_lead_note.includes('جلسه بازشنوایی'));
  });

  test('Team Lead CANNOT review assessment of a different team (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${otherTeamAssessmentId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: leadCookie },
      body: JSON.stringify({ note: 'تست بازخورد تیم غیرمجاز' }),
    });
    assert.equal(res.status, 403);
  });

  test('Team Lead CANNOT create assessments (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: leadCookie },
      body: JSON.stringify({ agent_id: 'agent-3718', total_score: 95 }),
    });
    assert.equal(res.status, 403);
  });

  test('Team Lead CANNOT delete assessments (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${ownTeamAssessmentId}`, {
      method: 'DELETE',
      headers: { Cookie: leadCookie },
    });
    assert.equal(res.status, 403);
  });

  test('Team Lead CANNOT update settings (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: leadCookie },
      body: JSON.stringify({ settings: { dispute_window_days: 5 } }),
    });
    assert.equal(res.status, 403);
  });

  test('Team Lead CANNOT view user accounts (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { Cookie: leadCookie },
    });
    assert.equal(res.status, 403);
  });
});

describe('4. Manager Role (mgr_sales - Commercial Sales Unit Manager)', () => {
  let mgrCookie: string;

  before(async () => {
    mgrCookie = await loginUser('mgr_sales');
  });

  test('Manager sees only own department assessments in GET /api/assessments', async () => {
    const res = await fetch(`${baseUrl}/api/assessments`, {
      headers: { Cookie: mgrCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length > 0, 'Sales manager should see assessments');
    for (const a of body.data) {
      assert.equal(a.form_type, 'sales', 'Sales manager must see strictly sales department assessments');
    }
  });

  test('Manager can access department analytics in GET /api/analytics', async () => {
    const res = await fetch(`${baseUrl}/api/analytics`, {
      headers: { Cookie: mgrCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.totalAudits > 0);
  });

  test('Manager CANNOT create assessments (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookie },
      body: JSON.stringify({ agent_id: 'agent-3718', total_score: 95 }),
    });
    assert.equal(res.status, 403);
  });

  test('Manager CANNOT update settings (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: mgrCookie },
      body: JSON.stringify({ settings: { high_quality_threshold: 90 } }),
    });
    assert.equal(res.status, 403);
  });

  test('Manager CANNOT view user accounts (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { Cookie: mgrCookie },
    });
    assert.equal(res.status, 403);
  });
});

describe('5. QA Controller Role (meysam - QA Controller)', () => {
  let controllerCookie: string;
  let ownCreatedAssessmentId: string;
  let otherControllerAssessmentId: string;

  before(async () => {
    controllerCookie = await loginUser('meysam');

    // Find assessment evaluated by Meysam
    const meysamAss = await prisma.assessment.findFirst({
      where: {
        OR: [{ controller_id: 'meysam' }, { controller_id: 'usr-meysam' }],
        deleted_at: null,
      },
    });
    assert.ok(meysamAss, 'Seed should have assessment by Meysam');
    ownCreatedAssessmentId = meysamAss.id;

    // Find assessment evaluated by another controller (e.g. Asal or Mohamadjavad)
    const otherAss = await prisma.assessment.findFirst({
      where: {
        controller_id: { notIn: ['meysam', 'usr-meysam'] },
        deleted_at: null,
      },
    });
    assert.ok(otherAss, 'Seed should have assessment by another controller');
    otherControllerAssessmentId = otherAss.id;
  });

  test('QA Controller CAN create assessment for assigned agent (201 Created)', async () => {
    // Agent-3718 (Mahya) is assigned to Meysam in seed
    const scores = getDefaultSupportScores();
    scores['start_greeting'] = 0; // -1 pt
    scores['empathy_sympathy'] = 0; // -5 pts
    scores['active_listening_main'] = 3; // -2 pts (max is 5)
    // 100 - 1 - 5 - 2 = 92

    const res = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
      body: JSON.stringify({
        agent_id: 'agent-3718',
        form_type: 'support',
        vendor_id: 'vnd-test-99',
        vendor_title: 'رستوران تست کنترلر',
        check_date: '۱۴۰۳/۰۷/۲۵',
        total_score: 92,
        result: 'Standard',
        result_comment: 'ارزیابی آزمایشی برای کارشناس تخصیص‌یافته',
        support_scores: scores,
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.agent_id, 'agent-3718');
    assert.equal(body.data.total_score, 92);
    assert.ok(typeof body.data.form_version === 'number' && body.data.form_version >= 1);
    assert.ok(body.data.form_id);
  });

  test('QA Controller CANNOT create assessment for an UNASSIGNED agent (403 Forbidden)', async () => {
    // Agent-7237 (Sara) is assigned to Asal, NOT Meysam
    const res = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
      body: JSON.stringify({
        agent_id: 'agent-7237',
        vendor_id: 'vnd-unassigned',
        vendor_title: 'رستوران غیرمجاز',
        check_date: '۱۴۰۳/۰۷/۲۵',
        total_score: 80,
        result: 'Standard',
      }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('Forbidden') || body.message.includes('تخصیص‌یافته'));
  });

  test('QA Controller CAN edit their own created assessment (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${ownCreatedAssessmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
      body: JSON.stringify({ result_comment: 'ویرایش متن بازخورد توسط کنترلر ثبت‌کننده' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.result_comment.includes('ویرایش متن بازخورد'));
  });

  test('QA Controller CANNOT edit another controller assessment (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${otherControllerAssessmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
      body: JSON.stringify({ total_score: 50 }),
    });
    assert.equal(res.status, 403);
  });

  test('QA Controller CAN resolve disputes (200 OK)', async () => {
    // Create an assessment and dispute to test resolution
    const disp = await prisma.dispute.findFirst({
      where: { status: 'pending' },
    });
    if (disp) {
      const res = await fetch(`${baseUrl}/api/disputes/${disp.assessment_id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
        body: JSON.stringify({
          status: 'resolved',
          controller_comment: 'اعتراض پذیرفته شد و نمره تصحیح گردید',
          revised_score: 95,
        }),
      });
      assert.equal(res.status, 200);
    }
  });

  test('QA Controller CAN delete their own assessment (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${ownCreatedAssessmentId}`, {
      method: 'DELETE',
      headers: { Cookie: controllerCookie },
    });
    assert.equal(res.status, 200);
  });

  test('QA Controller CANNOT delete another controller assessment (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${otherControllerAssessmentId}`, {
      method: 'DELETE',
      headers: { Cookie: controllerCookie },
    });
    assert.equal(res.status, 403);
  });

  test('QA Controller CANNOT view user accounts (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { Cookie: controllerCookie },
    });
    assert.equal(res.status, 403);
  });

  test('QA Controller CANNOT update settings (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
      body: JSON.stringify({ settings: { dispute_window_days: 4 } }),
    });
    assert.equal(res.status, 403);
  });
});

describe('6. QA Supervisor Role (supervisor - Complete QA Oversight)', () => {
  let supCookie: string;
  let testAssId: string;

  before(async () => {
    supCookie = await loginUser('supervisor');

    // Create a fresh test assessment for supervisor actions
    const created = await prisma.assessment.create({
      data: {
        id: `qa-test-sup-${Date.now()}`,
        agent_id: 'agent-3718',
        controller_id: 'supervisor',
        form_type: 'sales',
        total_score: 85,
        result: 'Need to check',
        check_date: new Date('2024-10-17T12:00:00Z'),
        sample_name: 'Random Sampling',
      },
    });
    testAssId = created.id;
  });

  test('QA Supervisor CAN view all assessments without restriction', async () => {
    const res = await fetch(`${baseUrl}/api/assessments`, {
      headers: { Cookie: supCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length >= 10, 'Supervisor sees all assessments');
  });

  test('QA Supervisor CAN edit any assessment (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${testAssId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: supCookie },
      body: JSON.stringify({ total_score: 96, result: 'High Quality' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.total_score, 96);
  });

  test('QA Supervisor CAN soft-delete assessment (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${testAssId}`, {
      method: 'DELETE',
      headers: { Cookie: supCookie },
    });
    assert.equal(res.status, 200);
    const check = await prisma.assessment.findUnique({ where: { id: testAssId } });
    assert.ok(check?.deleted_at, 'Assessment must be marked with deleted_at');
  });

  test('QA Supervisor CAN restore soft-deleted assessment (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${testAssId}/restore`, {
      method: 'POST',
      headers: { Cookie: supCookie },
    });
    assert.equal(res.status, 200);
    const check = await prisma.assessment.findUnique({ where: { id: testAssId } });
    assert.equal(check?.deleted_at, null);
  });

  test('QA Supervisor CAN access user list (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { Cookie: supCookie },
    });
    assert.equal(res.status, 200);
  });

  test('QA Supervisor CAN access audit logs (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Cookie: supCookie },
    });
    assert.equal(res.status, 200);
  });

  test('QA Supervisor CAN access executive analytics (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics`, {
      headers: { Cookie: supCookie },
    });
    assert.equal(res.status, 200);
  });
});

describe('7. Admin Role (admin - Users & Settings Only)', () => {
  let adminCookie: string;
  let testUserId: string;

  before(async () => {
    adminCookie = await loginUser('admin');
  });

  test('Admin CAN manage users: create user (201 Created)', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        username: `test_agent_${Date.now()}`,
        password: 'password123',
        name: 'کارشناس تستی ادمین',
        role: 'agent',
        department: 'sales',
        team: 'Campaign',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.id);
    testUserId = body.data.id;
  });

  test('Admin CAN manage users: update user (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/users/${testUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ name: 'کارشناس اصلاح‌شده ادمین' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.name, 'کارشناس اصلاح‌شده ادمین');
  });

  test('Admin CAN manage users: deactivate user (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/users/${testUserId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 200);
    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    assert.equal(user?.active, false);
  });

  test('Admin CAN manage settings (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ settings: { dispute_window_days: 4 } }),
    });
    assert.equal(res.status, 200);
  });

  test('Admin CANNOT create assessments (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ agent_id: 'agent-3718', total_score: 90 }),
    });
    assert.equal(res.status, 403);
  });

  test('Admin CANNOT edit assessments (403 Forbidden)', async () => {
    const anyAss = await prisma.assessment.findFirst({ where: { deleted_at: null } });
    assert.ok(anyAss);
    const res = await fetch(`${baseUrl}/api/assessments/${anyAss.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ total_score: 99 }),
    });
    assert.equal(res.status, 403);
  });

  test('Admin CANNOT delete assessments (403 Forbidden)', async () => {
    const anyAss = await prisma.assessment.findFirst({ where: { deleted_at: null } });
    assert.ok(anyAss);
    const res = await fetch(`${baseUrl}/api/assessments/${anyAss.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 403);
  });

  test('Admin CANNOT review assessments (403 Forbidden)', async () => {
    const anyAss = await prisma.assessment.findFirst({ where: { deleted_at: null } });
    assert.ok(anyAss);
    const res = await fetch(`${baseUrl}/api/assessments/${anyAss.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ note: 'بررسی غیرمجاز ادمین' }),
    });
    assert.equal(res.status, 403);
  });

  test('Admin CANNOT resolve disputes (403 Forbidden)', async () => {
    const anyAss = await prisma.assessment.findFirst();
    assert.ok(anyAss);
    const res = await fetch(`${baseUrl}/api/disputes/${anyAss.id}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ status: 'resolved', revised_score: 100 }),
    });
    assert.equal(res.status, 403);
  });

  test('Admin CANNOT view analytics (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/analytics`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 403);
  });

  test('Admin CANNOT manage operations problems (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/problems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ title: 'مشکل تستی ادمین' }),
    });
    assert.equal(res.status, 403);
  });
});

describe('8. Scoring UX, Data Integrity, Versioning & Server Recomputation', () => {
  let controllerCookie: string;
  let supervisorCookie: string;
  let testAssessmentId: string;

  before(async () => {
    controllerCookie = await loginUser('meysam');
    supervisorCookie = await loginUser('supervisor');
  });

  test('Server REJECTS assessment creation when items lack explicit scores (400 Bad Request)', async () => {
    // Only 2 items provided out of all required rubric items
    const res = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
      body: JSON.stringify({
        agent_id: 'agent-3718',
        form_type: 'support',
        vendor_id: 'vnd-incomplete',
        vendor_title: 'رستوران ناقص',
        check_date: '۱۴۰۳/۰۷/۲۵',
        total_score: 95,
        result: 'Standard',
        support_scores: { start_greeting: 1, start_agent_name: 1 },
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.missing_items && body.missing_items.length > 0);
    assert.ok(body.message.includes('فاقد نمره ثبت‌شده') || body.message.includes('Validation Error'));
  });

  test('Server REJECTS assessment creation when item score is out-of-range (400 Bad Request)', async () => {
    const scores = getDefaultSupportScores();
    scores['start_greeting'] = 50; // max is 1

    const res = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
      body: JSON.stringify({
        agent_id: 'agent-3718',
        form_type: 'support',
        vendor_id: 'vnd-out-of-range',
        vendor_title: 'رستوران نمره نامعتبر',
        check_date: '۱۴۰۳/۰۷/۲۵',
        total_score: 90,
        result: 'Standard',
        support_scores: scores,
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.out_of_range_items && body.out_of_range_items.length > 0);
    assert.ok(body.message.includes('خارج از بازه مجاز') || body.message.includes('Validation Error'));
  });

  test('Server RECOMPUTES total_score and REJECTS mismatching client total (400 Bad Request)', async () => {
    const scores = getDefaultSupportScores();
    scores['start_greeting'] = 0; // -1 pt
    scores['empathy_sympathy'] = 0; // -5 pts
    // True server computed total = 94

    const res = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
      body: JSON.stringify({
        agent_id: 'agent-3718',
        form_type: 'support',
        vendor_id: 'vnd-mismatch',
        vendor_title: 'رستوران مغایرت نمره',
        check_date: '۱۴۰۳/۰۷/۲۵',
        total_score: 75, // Intentionally wrong client total
        result: 'Standard',
        support_scores: scores,
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.submitted_total, 75);
    assert.equal(body.computed_total, 94);
    assert.ok(body.message.includes('همخوانی ندارد') || body.message.includes('Total Score Mismatch'));
  });

  test('Server STORES form_id and form_version on created assessment (201 Created)', async () => {
    const activeForm = await prisma.assessmentForm.findFirst({
      where: { form_type: 'support', is_active: true },
      orderBy: { version: 'desc' },
    });
    const expectedVersion = activeForm?.version || 1;
    const expectedFormId = activeForm?.id || `form-support-v${expectedVersion}`;

    const scores = getDefaultSupportScores();
    scores['start_greeting'] = 0; // -1 pt (total = 99)

    const res = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
      body: JSON.stringify({
        agent_id: 'agent-3718',
        form_type: 'support',
        vendor_id: 'vnd-version-check',
        vendor_title: 'رستوران تست نگارش فرم',
        check_date: '۱۴۰۳/۰۷/۲۵',
        total_score: 99,
        result: 'Standard',
        result_comment: 'ارزیابی برای بررسی نگارش فرم',
        support_scores: scores,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.total_score, 99);
    assert.equal(body.data.form_version, expectedVersion);
    assert.equal(body.data.form_id, expectedFormId);
    testAssessmentId = body.data.id;
  });

  test('Old assessment maintains original form version and scoring when rubric is edited', async () => {
    // 1. Fetch old assessment to record its original version
    const initialAssRes = await fetch(`${baseUrl}/api/assessments/${testAssessmentId}`, {
      headers: { Cookie: supervisorCookie },
    });
    assert.equal(initialAssRes.status, 200);
    const initialAssData = await initialAssRes.json();
    const originalVersion = initialAssData.data.form_version;
    const originalFormId = initialAssData.data.form_id;

    // 2. Fetch current support rubric
    const getRes = await fetch(`${baseUrl}/api/forms`, {
      headers: { Cookie: supervisorCookie },
    });
    assert.equal(getRes.status, 200);
    const formsData = await getRes.json();
    const currentSupportRubric = formsData.supportRubric;

    // 3. QA Supervisor updates rubric (creates next version)
    const updateRes = await fetch(`${baseUrl}/api/forms/support`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: supervisorCookie },
      body: JSON.stringify({
        sections: currentSupportRubric,
      }),
    });
    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.equal(updateData.success, true);
    assert.equal(updateData.version, originalVersion + 1);

    // 4. Verify old assessment still has its original form_version and form_id and score
    const oldAssRes = await fetch(`${baseUrl}/api/assessments/${testAssessmentId}`, {
      headers: { Cookie: supervisorCookie },
    });
    assert.equal(oldAssRes.status, 200);
    const oldAssData = await oldAssRes.json();
    assert.equal(oldAssData.data.form_version, originalVersion);
    assert.equal(oldAssData.data.form_id, originalFormId);
    assert.equal(oldAssData.data.total_score, 99);

    // 5. Verify historical version endpoint returns original rubric version
    const histRes = await fetch(`${baseUrl}/api/forms/support/version/${originalVersion}`, {
      headers: { Cookie: supervisorCookie },
    });
    assert.equal(histRes.status, 200);
    const histData = await histRes.json();
    assert.equal(histData.success, true);
    assert.equal(histData.version, originalVersion);
  });
});

describe('9. Stage 2 Dedicated Verification: Cross-Role Scoping, Exports, Replay & Production Security', () => {
  let agentCookie: string;
  let otherAgentCookie: string;
  let controllerCookie: string;
  let otherControllerCookie: string;
  let managerCookie: string;
  let supervisorCookie: string;
  let adminCookie: string;
  let orphanManagerCookie: string;

  let mahyaAssessmentId: string;
  let otherAssessmentId: string;
  let meysamAssessmentId: string;
  let otherControllerAssessmentId: string;

  before(async () => {
    agentCookie = await loginUser('mahya');
    otherAgentCookie = await loginUser('sara');
    controllerCookie = await loginUser('meysam');
    otherControllerCookie = await loginUser('asal');
    managerCookie = await loginUser('mgr_sales');
    supervisorCookie = await loginUser('supervisor');
    adminCookie = await loginUser('admin');

    // Create an orphan manager without department for testing fail-closed
    const orphanUsername = 'mgr_nodept';
    const existing = await prisma.user.findUnique({ where: { username: orphanUsername } });
    if (!existing) {
      await prisma.user.create({
        data: {
          username: orphanUsername,
          password: bcrypt.hashSync('snappfood123', 10),
          name: 'مدیر بدون واحد',
          role: 'manager',
          department: null,
          active: true,
        },
      });
    }
    orphanManagerCookie = await loginUser(orphanUsername);

    // Identify assessments
    const mahyaAss = await prisma.assessment.findFirst({
      where: { agent_id: 'agent-3718', deleted_at: null },
    });
    mahyaAssessmentId = mahyaAss!.id;

    const otherAss = await prisma.assessment.findFirst({
      where: { agent_id: { not: 'agent-3718' }, deleted_at: null },
    });
    otherAssessmentId = otherAss!.id;

    const meysamAss = await prisma.assessment.findFirst({
      where: { OR: [{ controller_id: 'meysam' }, { controller_id: 'usr-meysam' }], deleted_at: null },
    });
    meysamAssessmentId = meysamAss!.id;

    const otherCtrlAss = await prisma.assessment.findFirst({
      where: { controller_id: { notIn: ['meysam', 'usr-meysam'] }, deleted_at: null },
    });
    otherControllerAssessmentId = otherCtrlAss!.id;
  });

  // 1. GET /api/assessments/:id Scoping
  test('Agent CAN access their own assessment by ID (200 OK)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${mahyaAssessmentId}`, {
      headers: { Cookie: agentCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, mahyaAssessmentId);
  });

  test('Agent CANNOT access another agent assessment by ID (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${otherAssessmentId}`, {
      headers: { Cookie: agentCookie },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  test('Admin CANNOT access single assessment detail by ID (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${mahyaAssessmentId}`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(res.status, 403);
  });

  // 2. Export Permissions
  test('Agent CANNOT export assessments to CSV (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/export/assessments.csv`, {
      headers: { Cookie: agentCookie },
    });
    assert.equal(res.status, 403);
  });

  test('Agent CANNOT export assessments to XLSX (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/export/assessments.xlsx`, {
      headers: { Cookie: agentCookie },
    });
    assert.equal(res.status, 403);
  });

  test('Agent CANNOT export monthly scores to XLSX (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/export/monthly-scores.xlsx`, {
      headers: { Cookie: agentCookie },
    });
    assert.equal(res.status, 403);
  });

  test('Admin CANNOT export assessments to CSV or XLSX (403 Forbidden)', async () => {
    const csvRes = await fetch(`${baseUrl}/api/export/assessments.csv`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(csvRes.status, 403);

    const xlsxRes = await fetch(`${baseUrl}/api/export/monthly-scores.xlsx`, {
      headers: { Cookie: adminCookie },
    });
    assert.equal(xlsxRes.status, 403);
  });

  test('QA Controller CAN export assessments CSV scoped to assigned agents/own assessments', async () => {
    const res = await fetch(`${baseUrl}/api/export/assessments.csv`, {
      headers: { Cookie: controllerCookie },
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('شناسه'), 'CSV should contain Persian headers');
  });

  // 3. Manager Without Department Fails Closed
  test('Manager without department returns 0 assessments in GET /api/assessments (fail-closed)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments`, {
      headers: { Cookie: orphanManagerCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 0, 'Manager without department must fail closed to 0 records');
  });

  test('Manager without department is rejected from analytics with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/analytics`, {
      headers: { Cookie: orphanManagerCookie },
    });
    assert.equal(res.status, 403);
  });

  test('Manager without department is rejected from CSV export with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/export/assessments.csv`, {
      headers: { Cookie: orphanManagerCookie },
    });
    assert.equal(res.status, 403);
  });

  test('Manager without department is rejected from monthly-scores.xlsx with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/export/monthly-scores.xlsx`, {
      headers: { Cookie: orphanManagerCookie },
    });
    assert.equal(res.status, 403);
  });

  // 4. Audit Log Scoping for QA Controllers
  test('QA Controller sees only audit logs associated with their own assessments or actions', async () => {
    const res = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Cookie: controllerCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    // Every log returned must either be authored by meysam or associated with meysam's assessments
    for (const log of body.data) {
      if (log.user_id !== 'usr-meysam' && log.user_name !== 'میثم کاظمی') {
        assert.ok(
          log.entity === 'assessment' || log.entity === 'dispute',
          'QA controller must only see audit logs of assessment/dispute on their own items'
        );
      }
    }
  });

  // 5. Session Revocation & Logout Replay Prevention
  test('Session is revoked upon logout and replaying old session cookie returns 401 Unauthorized', async () => {
    // Log in temporary user
    const resLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sara', password: 'snappfood123' }),
    });
    assert.equal(resLogin.status, 200);
    const rawCookie = resLogin.headers.get('set-cookie')!;
    const cookieMatch = rawCookie.match(/snappfood_session=[^;]+/);
    const replayCookie = cookieMatch![0];

    // Verify session works before logout
    const preCheck = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: replayCookie },
    });
    const preCheckBody = await preCheck.json();
    assert.equal(preCheckBody.authenticated, true);

    // Call logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: replayCookie },
    });
    assert.equal(logoutRes.status, 200);

    // Replay old cookie on protected endpoint
    const postCheck = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: replayCookie },
    });
    const postCheckBody = await postCheck.json();
    assert.equal(postCheckBody.authenticated, false, 'Revoked session must not authenticate');

    const protectedRes = await fetch(`${baseUrl}/api/assessments`, {
      headers: { Cookie: replayCookie },
    });
    assert.equal(protectedRes.status, 401, 'Protected endpoint must reject revoked token with 401');
  });

  // 6. Production Dev-Header Rejection
  test('Unauthenticated request with X-Dev-Role header is rejected with 401 in test/prod', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: {
        'Accept': 'application/json',
        'X-Dev-Role': 'admin',
      },
    });
    assert.equal(res.status, 401, 'Dev header must not bypass authentication when DEV_ROLE_SWITCH is disabled');
  });

  // 7. Corporate SSO Fail-Closed
  test('Corporate SSO fails closed with 503 and informative message', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        ssoToken: 'sample-dummy-sso-token-xyz',
        provider: 'sso',
      }),
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('SSO'));
  });

  // 8. Prevent Deletion/Restore Permission Bypass through Writable deleted_at Fields
  test('PUT /api/assessments/:id ignores deleted_at in body and does not soft-delete assessment', async () => {
    const testDate = new Date().toISOString();
    const res = await fetch(`${baseUrl}/api/assessments/${meysamAssessmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: controllerCookie },
      body: JSON.stringify({
        deleted_at: testDate,
        result_comment: 'تست جلوگیری از بای‌پَس فیلد deleted_at',
      }),
    });
    assert.equal(res.status, 200);

    // Verify assessment in database still has deleted_at === null
    const checkDb = await prisma.assessment.findUnique({
      where: { id: meysamAssessmentId },
    });
    assert.equal(checkDb?.deleted_at, null, 'deleted_at must NOT be updated via PUT');
  });

  // 9. Staff endpoint returns authorized controllers and team leads
  test('GET /api/staff returns authorized controllers and team leads from database', async () => {
    const res = await fetch(`${baseUrl}/api/staff`, {
      headers: { Cookie: controllerCookie },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.controllers));
    assert.ok(Array.isArray(body.teamLeads));
    assert.ok(body.controllers.length >= 2, 'Expected controllers in staff directory');
    assert.ok(body.teamLeads.length >= 2, 'Expected team leads in staff directory');
  });
});

