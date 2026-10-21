/**
 * Prisma Seed Script for SnappFood Commercial QA Portal
 * Seeds all Support & Sales rubrics, sub-items, real Snappfood teams, controllers, leads, agents,
 * realistic historical assessments with audit logs, faults, settings, and problems.
 */

import { PrismaClient } from "@prisma/client";
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
  SEED_PROBLEMS,
} from "../src/data/seedData.ts";
import { SUPPORT_RUBRIC, SALES_RUBRIC } from "../src/utils/scoring.ts";
import { parseJalaliOrGregorianDate } from "../src/utils/persian.ts";

import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "snappfood123";
const HASHED_PASSWORD = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

async function main() {
  if (
    process.env.NODE_ENV === "production" ||
    (process.env.NODE_ENV !== "test" && process.env.DEMO_SEED !== "true")
  )
    throw new Error(
      "Demo seed requires NODE_ENV=test or DEMO_SEED=true outside production.",
    );
  if ((await prisma.user.count()) && process.env.NODE_ENV !== "test")
    throw new Error(
      "Demo seed requires an empty database; existing users will not be overwritten.",
    );
  console.log("🌱 Starting SnappFood QA database seed...");

  // 1. Seed Settings
  for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(val) },
      create: {
        key,
        value: JSON.stringify(val),
        description: `Snappfood QA setting: ${key}`,
      },
    });
  }
  console.log("✅ Settings seeded");

  // 2. Seed Users (Roles: admin, qa_supervisor, qa_controller, team_lead, manager, agent)
  for (const u of SEED_USERS) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        name: u.name,
        role: u.role,
        department: u.department,
        team: u.team,
        password: HASHED_PASSWORD,
      },
      create: {
        id: u.id,
        username: u.username,
        password: HASHED_PASSWORD,
        name: u.name,
        role: u.role,
        department: u.department,
        team: u.team,
        active: true,
      },
    });
  }

  // Also seed dedicated agent user accounts so each agent can log in and view only their own evaluations
  const agentUsersMap: Record<string, string> = {
    "agent-3718": "mahya",
    "agent-3726": "alireza",
    "agent-7237": "sara",
    "agent-7110": "amirali",
    "agent-3728": "shaghayegh",
    "agent-3708": "zahra",
    "agent-7119": "niloofar",
    "agent-3736": "parmida",
    "agent-3890": "farzad",
  };

  for (const ag of SEED_AGENTS) {
    const uname = agentUsersMap[ag.id] || `agent_${ag.source_id}`;
    const agentUserId = `usr-${ag.id}`;

    await prisma.user.upsert({
      where: { username: uname },
      update: {
        name: ag.name,
        role: "agent",
        department: ag.department,
        team: ag.team,
        password: HASHED_PASSWORD,
      },
      create: {
        id: agentUserId,
        username: uname,
        password: HASHED_PASSWORD,
        name: ag.name,
        role: "agent",
        department: ag.department,
        team: ag.team,
        active: true,
      },
    });
  }

  // Default generic agent
  await prisma.user.upsert({
    where: { username: "agent" },
    update: {
      password: HASHED_PASSWORD,
    },
    create: {
      id: "usr-agent-default",
      username: "agent",
      password: HASHED_PASSWORD,
      name: "مهیا ممیزاده (کارشناس نمونه)",
      role: "agent",
      department: "sales",
      team: "Campaign",
      active: true,
    },
  });

  console.log("✅ Users with bcrypt passwords seeded");

  // 3. Seed Teams (with lead_id User relation)
  for (const t of SEED_TEAMS) {
    const leadUser = await prisma.user.findFirst({
      where: { name: t.lead_name, role: "team_lead" },
    });

    await prisma.team.upsert({
      where: { name: t.name },
      update: {
        department: t.department,
        lead_name: t.lead_name,
        lead_id: leadUser?.id || null,
      },
      create: {
        id: t.id,
        name: t.name,
        department: t.department,
        lead_name: t.lead_name,
        lead_id: leadUser?.id || null,
      },
    });
  }
  console.log("✅ Teams with lead relations seeded");

  // 4. Seed Agents (with user_id, team_lead_id, and controller_id relations)
  for (const ag of SEED_AGENTS) {
    const teamRecord = await prisma.team.findUnique({
      where: { name: ag.team },
    });
    const leadUser = await prisma.user.findFirst({
      where: { name: ag.team_lead, role: "team_lead" },
    });
    const controllerUser = await prisma.user.findFirst({
      where: {
        role: "qa_controller",
        OR: [
          { username: ag.controller.toLowerCase() },
          { name: { contains: ag.controller } },
        ],
      },
    });
    const uname = agentUsersMap[ag.id] || `agent_${ag.source_id}`;
    const agentUser = await prisma.user.findUnique({
      where: { username: uname },
    });

    await prisma.agent.upsert({
      where: { source_id: ag.source_id },
      update: {
        name: ag.name,
        department: ag.department,
        user_id: agentUser?.id || null,
        team_id: teamRecord?.id || "team-technical",
        team_name: ag.team,
        team_lead_id: leadUser?.id || null,
        team_lead: ag.team_lead,
        controller_id: controllerUser?.id || null,
        controller: ag.controller,
        operator_panel: ag.operator_panel,
        sample_name: ag.sample_name || "Random Sampling",
        check_process: ag.check_process || "if needed",
        min_monthly_reviews: ag.min_monthly_reviews,
      },
      create: {
        id: ag.id,
        source_id: ag.source_id,
        name: ag.name,
        department: ag.department,
        user_id: agentUser?.id || null,
        team_id: teamRecord?.id || "team-technical",
        team_name: ag.team,
        team_lead_id: leadUser?.id || null,
        team_lead: ag.team_lead,
        controller_id: controllerUser?.id || null,
        controller: ag.controller,
        operator_panel: ag.operator_panel,
        sample_name: ag.sample_name || "Random Sampling",
        check_process: ag.check_process || "if needed",
        min_monthly_reviews: ag.min_monthly_reviews,
        active: true,
      },
    });
  }
  console.log("✅ Agents with User relations seeded");

  // 5. Seed Assessment Forms, Criteria, and Sub-items
  // Support Form (Version 1)
  const supportForm = await prisma.assessmentForm.upsert({
    where: { form_type_version: { form_type: "support", version: 1 } },
    update: { title: "روبریک ارزیابی پشتیبانی (Support Rubric)" },
    create: {
      id: "form-support-v1",
      form_type: "support",
      title: "روبریک ارزیابی پشتیبانی (Support Rubric)",
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
    where: { form_type_version: { form_type: "sales", version: 1 } },
    update: { title: "روبریک ارزیابی فروش (Sales Rubric)" },
    create: {
      id: "form-sales-v1",
      form_type: "sales",
      title: "روبریک ارزیابی فروش (Sales Rubric)",
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
  console.log("✅ Assessment Forms and Criteria seeded");

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
  console.log("✅ Faults seeded");

  // 7. Seed Assessments
  for (const a of SEED_ASSESSMENTS) {
    const existing = await prisma.assessment.findUnique({
      where: { id: a.id },
    });
    if (!existing) {
      await prisma.assessment.create({
        data: {
          id: a.id,
          agent_id: a.agent_id,
          controller_id: a.controller_id,
          form_type: a.form_type,
          form_id: `form-${a.form_type}-v${a.form_version || 1}`,
          form_version: a.form_version || 1,
          sample_name: a.sample_name,
          vendor_id: a.vendor_id,
          vendor_title: a.vendor_title,
          check_date: parseJalaliOrGregorianDate(a.check_date),
          fault_id: a.fault_id,
          backend_general: a.backend_general,
          is_fraud: a.is_fraud,
          result: a.result,
          result_comment: a.result_comment,
          team_lead_reviewed: a.team_lead_reviewed || false,
          team_lead_note: a.team_lead_note,
          team_lead_reviewed_at: a.team_lead_reviewed_at,
          action_taken: a.action_taken,
          ticket_number: a.ticket_number,
          voice_link: a.voice_link,
          fault_categories: a.fault_categories
            ? JSON.stringify(a.fault_categories)
            : null,
          support_scores_json: a.support_scores
            ? JSON.stringify(a.support_scores)
            : null,
          sales_scores_json: a.sales_scores
            ? JSON.stringify(a.sales_scores)
            : null,
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

      // Also create assessment scores
      const scoreObj = a.support_scores || a.sales_scores || {};
      for (const [key, val] of Object.entries(scoreObj)) {
        await prisma.assessmentScore.create({
          data: {
            assessment_id: a.id,
            item_id: key,
            awarded_score: Number(val),
            max_score: 5,
          },
        });
      }

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
  console.log(`✅ Assessments, Scores, and Disputes seeded`);

  // 8. Seed Problems
  for (const prob of SEED_PROBLEMS) {
    const existing = await prisma.problem.findUnique({
      where: { id: prob.id },
    });
    if (!existing) {
      await prisma.problem.create({
        data: {
          id: prob.id,
          priority: prob.priority,
          issue_date: prob.issue_date,
          team: prob.team,
          category: prob.category,
          title: prob.title,
          description: prob.description,
          status: prob.status,
          owner: prob.owner,
          resolved_at: prob.resolved_at,
          solution_note: prob.solution_note,
          created_at: new Date(prob.created_at),
        },
      });
    }
  }
  console.log("✅ Problems seeded");

  // 9. Seed Audit Logs
  for (const log of SEED_AUDIT_LOGS) {
    const existing = await prisma.auditLog.findUnique({
      where: { id: log.id },
    });
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
  console.log("✅ Audit Logs seeded");

  // 10. Seed Settings
  for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: JSON.stringify(val) },
      create: { key, value: JSON.stringify(val) },
    });
  }
  console.log("✅ Settings seeded");

  console.log("🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
