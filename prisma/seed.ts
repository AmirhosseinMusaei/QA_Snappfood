/**
 * Prisma Seed Script for SnappFood Commercial QA Portal
 * Seeds all Support & Sales rubrics, sub-items, real Snappfood teams, controllers, leads, agents,
 * and 25 realistic historical assessments with audit logs.
 */

import { PrismaClient } from '@prisma/client';
import {
  SEED_TEAMS,
  SEED_CONTROLLERS,
  SEED_TEAM_LEADS,
  SEED_AGENTS,
  SEED_FAULTS,
  SEED_ASSESSMENTS,
  SEED_AUDIT_LOGS,
  DEFAULT_SETTINGS,
  SEED_USERS,
} from '../src/data/seedData.ts';
import { SUPPORT_RUBRIC, SALES_RUBRIC } from '../src/utils/scoring.ts';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SnappFood QA database seed...');

  // 1. Seed Settings
  for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(val) },
      create: { key, value: JSON.stringify(val), description: `Snappfood QA setting: ${key}` },
    });
  }
  console.log('✅ Settings seeded');

  // 2. Seed Users
  for (const u of SEED_USERS) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: { name: u.name, role: u.role, department: u.department, team: u.team },
      create: {
        id: u.id,
        username: u.username,
        password: '$2b$10$epR54z1234567890abcdefghijklmnopqrstuvwxyz123456', // bcrypt placeholder for 'snappfood123'
        name: u.name,
        role: u.role,
        department: u.department,
        team: u.team,
        active: true,
      },
    });
  }
  console.log('✅ Users seeded');

  // 3. Seed Teams
  for (const t of SEED_TEAMS) {
    await prisma.team.upsert({
      where: { name: t.name },
      update: { department: t.department, lead_name: t.lead_name },
      create: {
        id: t.id,
        name: t.name,
        department: t.department,
        lead_name: t.lead_name,
      },
    });
  }
  console.log('✅ Teams seeded');

  // 4. Seed Agents
  for (const ag of SEED_AGENTS) {
    const teamRecord = await prisma.team.findUnique({ where: { name: ag.team } });
    await prisma.agent.upsert({
      where: { source_id: ag.source_id },
      update: {
        name: ag.name,
        department: ag.department,
        team_id: teamRecord?.id || 'team-technical',
        team_name: ag.team,
        team_lead: ag.team_lead,
        controller: ag.controller,
        operator_panel: ag.operator_panel,
        min_monthly_reviews: ag.min_monthly_reviews,
      },
      create: {
        id: ag.id,
        source_id: ag.source_id,
        name: ag.name,
        department: ag.department,
        team_id: teamRecord?.id || 'team-technical',
        team_name: ag.team,
        team_lead: ag.team_lead,
        controller: ag.controller,
        operator_panel: ag.operator_panel,
        min_monthly_reviews: ag.min_monthly_reviews,
        active: true,
      },
    });
  }
  console.log('✅ Agents seeded');

  // 5. Seed Assessment Forms, Criteria, and Sub-items
  // Support Form (Version 1)
  const supportForm = await prisma.assessmentForm.upsert({
    where: { form_type_version: { form_type: 'support', version: 1 } },
    update: { title: 'روبریک ارزیابی پشتیبانی (Support Rubric)' },
    create: {
      id: 'form-support-v1',
      form_type: 'support',
      title: 'روبریک ارزیابی پشتیبانی (Support Rubric)',
      version: 1,
      is_active: true,
    },
  });

  for (const [secIdx, section] of SUPPORT_RUBRIC.entries()) {
    for (const [critIdx, crit] of section.criteria.entries()) {
      const criteriaRecord = await prisma.rubricCriteria.upsert({
        where: { id: `crit-${crit.id}` },
        update: { title: crit.title, max_points: crit.maxPoints },
        create: {
          id: `crit-${crit.id}`,
          form_id: supportForm.id,
          section: section.id,
          title: crit.title,
          max_points: crit.maxPoints,
          order_index: secIdx * 10 + critIdx,
        },
      });

      for (const [itemIdx, item] of crit.items.entries()) {
        await prisma.rubricCriteriaItem.upsert({
          where: { id: `item-${item.id}` },
          update: { title: item.title, max_points: item.maxPoints },
          create: {
            id: `item-${item.id}`,
            criteria_id: criteriaRecord.id,
            title: item.title,
            max_points: item.maxPoints,
            order_index: itemIdx,
          },
        });
      }
    }
  }

  // Sales Form (Version 1)
  const salesForm = await prisma.assessmentForm.upsert({
    where: { form_type_version: { form_type: 'sales', version: 1 } },
    update: { title: 'روبریک ارزیابی فروش (Sales Rubric)' },
    create: {
      id: 'form-sales-v1',
      form_type: 'sales',
      title: 'روبریک ارزیابی فروش (Sales Rubric)',
      version: 1,
      is_active: true,
    },
  });

  for (const [secIdx, section] of SALES_RUBRIC.entries()) {
    for (const [critIdx, crit] of section.criteria.entries()) {
      const criteriaRecord = await prisma.rubricCriteria.upsert({
        where: { id: `crit-${crit.id}` },
        update: { title: crit.title, max_points: crit.maxPoints },
        create: {
          id: `crit-${crit.id}`,
          form_id: salesForm.id,
          section: section.id,
          title: crit.title,
          max_points: crit.maxPoints,
          order_index: secIdx * 10 + critIdx,
        },
      });

      for (const [itemIdx, item] of crit.items.entries()) {
        await prisma.rubricCriteriaItem.upsert({
          where: { id: `item-${item.id}` },
          update: { title: item.title, max_points: item.maxPoints },
          create: {
            id: `item-${item.id}`,
            criteria_id: criteriaRecord.id,
            title: item.title,
            max_points: item.maxPoints,
            order_index: itemIdx,
          },
        });
      }
    }
  }
  console.log('✅ Assessment Forms and Criteria seeded');

  // 6. Seed Faults
  for (const f of SEED_FAULTS) {
    await prisma.fault.upsert({
      where: { title: f.title },
      update: {
        department: f.department,
        category: f.category,
        is_critical: f.is_critical,
        description: f.description,
      },
      create: {
        id: f.id,
        title: f.title,
        department: f.department,
        category: f.category,
        is_critical: f.is_critical,
        description: f.description,
      },
    });
  }
  console.log('✅ Faults seeded');

  // 7. Seed Assessments
  for (const a of SEED_ASSESSMENTS) {
    const existing = await prisma.assessment.findUnique({ where: { id: a.id } });
    if (!existing) {
      await prisma.assessment.create({
        data: {
          id: a.id,
          agent_id: a.agent_id,
          controller_id: a.controller_id,
          form_type: a.form_type,
          sample_name: a.sample_name,
          vendor_id: a.vendor_id,
          vendor_title: a.vendor_title,
          check_date: a.check_date,
          fault_id: a.fault_id,
          backend_general: a.backend_general,
          is_fraud: a.is_fraud,
          result: a.result,
          result_comment: a.result_comment,
          team_lead_reviewed: a.team_lead_reviewed || false,
          team_lead_note: a.team_lead_note,
          ticket_number: a.ticket_number,
          voice_link: a.voice_link,
          fault_categories: a.fault_categories ? JSON.stringify(a.fault_categories) : null,
          phone_number: a.phone_number,
          project: a.project,
          discount_or_coupon: a.discount_or_coupon,
          registration_date: a.registration_date,
          execution_date: a.execution_date,
          mistake_count: a.mistake_count,
          total_score: a.total_score,
          created_at: new Date(a.created_at),
        },
      });

      if (a.dispute) {
        await prisma.dispute.create({
          data: {
            id: a.dispute.id || `disp-${a.id}`,
            assessment_id: a.id,
            agent_id: a.agent_id,
            agent_name: a.dispute.agent_name,
            criterion_id: a.dispute.criterion_id,
            criterion_title: a.dispute.criterion_title,
            agent_comment: a.dispute.agent_comment,
            status: a.dispute.status,
            controller_id: a.dispute.controller_id,
            controller_comment: a.dispute.controller_comment,
            original_score: a.dispute.original_score,
            revised_score: a.dispute.revised_score,
          },
        });
      }
    }
  }
  console.log(`✅ 25 Assessments and Disputes seeded`);

  // 8. Seed Audit Logs
  for (const log of SEED_AUDIT_LOGS) {
    const existing = await prisma.auditLog.findUnique({ where: { id: log.id } });
    if (!existing) {
      await prisma.auditLog.create({
        data: {
          id: log.id,
          user_id: log.user_id,
          user_name: log.user_name,
          user_role: log.user_role,
          entity: log.entity,
          entity_id: log.entity_id,
          action: log.action,
          field: log.field,
          old_value: log.old_value,
          new_value: log.new_value,
        },
      });
    }
  }
  console.log('✅ Audit Logs seeded');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
