import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test('Prisma DB connects and queries seeded users', async () => {
  const users = await prisma.user.findMany();
  assert.ok(users.length >= 10, 'Expected at least 10 seeded users');
  const admin = users.find((u) => u.role === 'admin');
  assert.ok(admin, 'Expected admin user in database');
});

test('Prisma DB has seeded agents and teams', async () => {
  const [agents, teams] = await Promise.all([
    prisma.agent.findMany(),
    prisma.team.findMany(),
  ]);
  assert.ok(agents.length >= 7, 'Expected at least 7 seeded agents');
  assert.ok(teams.length >= 5, 'Expected at least 5 seeded teams');
});

test('Prisma DB has assessments with valid scores and relations', async () => {
  const assessments = await prisma.assessment.findMany({
    include: { agent: true, scores: true },
  });
  assert.ok(assessments.length >= 20, 'Expected at least 20 seeded assessments');
  for (const a of assessments) {
    assert.ok(a.total_score >= 0 && a.total_score <= 100, 'Score must be 0-100');
    assert.ok(a.agent, 'Assessment must be linked to an Agent');
  }
});

test('Prisma DB has audit logs and problems seeded', async () => {
  const [logs, problems] = await Promise.all([
    prisma.auditLog.findMany(),
    prisma.problem.findMany(),
  ]);
  assert.ok(logs.length >= 1, 'Expected seeded audit logs');
  assert.ok(problems.length >= 3, 'Expected seeded problems');
});

test('Prisma DB has active Support (100 pts) and Sales forms (70 pts + 30 mistake pool)', async () => {
  const forms = await prisma.assessmentForm.findMany({
    where: { is_active: true },
    include: { criteria: true },
  });
  assert.equal(forms.length, 2, 'Expected 2 active forms (support and sales)');
  for (const f of forms) {
    const total = f.criteria.reduce((s, c) => s + c.max_points, 0);
    if (f.form_type === 'support') {
      assert.equal(total, 100, 'Support form criteria must sum to 100 max points (60 soft skill + 40 knowledge)');
    } else {
      assert.equal(total, 70, 'Sales form criteria must sum to 70 max points (29 soft skill + 41 script + 30 mistake table)');
    }
  }
});
