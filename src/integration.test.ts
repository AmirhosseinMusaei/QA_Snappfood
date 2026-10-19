import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
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
    assert.equal(data.user.role, 'admin');
    assert.ok(data.token, 'Expected session token in body');

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

  test('QA Controller CANNOT delete assessment (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/assessments/${ownCreatedAssessmentId}`, {
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
