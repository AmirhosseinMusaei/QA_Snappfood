import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  getAllRubricItems,
  SUPPORT_RUBRIC,
  SALES_RUBRIC,
} from "../src/utils/scoring.ts";
const db = new PrismaClient();
try {
  if (!process.argv.includes("--apply"))
    throw new Error(
      "Back up the database, apply the additive schema, then run with --apply.",
    );
  await db.$transaction(
    async (tx) => {
      const users = await tx.user.findMany();
      for (const a of await tx.assessment.findMany()) {
        const candidates = users.filter(
          (u) =>
            u.id === a.controller_id ||
            u.username.toLowerCase() === a.controller_id.toLowerCase(),
        );
        const user = candidates.length === 1 ? candidates[0] : null;
        if (!user)
          throw new Error(
            `Unresolved controller for assessment ${a.id}; fix mapping before migration.`,
          );
        const agent = await tx.agent.findUniqueOrThrow({
          where: { id: a.agent_id },
        });
        const scores = JSON.parse(
          (a.form_type === "sales"
            ? a.sales_scores_json
            : a.support_scores_json) || "{}",
        );
        // Historical totals are preserved. Missing item details are explicitly unavailable.
        const form = a.form_id
          ? await tx.assessmentForm.findUnique({
              where: { id: a.form_id },
              include: { criteria: { include: { items: true } } },
            })
          : null;
        const expected =
          form?.criteria.flatMap((c) =>
            c.items.map((i) =>
              i.id.replace(/^item-/, "").replace(/-v\d+$/, ""),
            ),
          ) || [];
        const missing =
          !expected.length ||
          expected.some((id) => typeof scores[id] !== "number");
        await tx.assessment.update({
          where: { id: a.id },
          data: {
            controller_id: user.id,
            team_id: a.team_id || agent.team_id,
            legacy_aggregate: a.legacy_aggregate || missing,
          },
        });
      }
      await tx.dispute.updateMany({
        where: { status: "pending" },
        data: { status: "open" },
      });
      await tx.dispute.updateMany({
        where: { status: "resolved" },
        data: { status: "accepted" },
      });
      await tx.auditLog.create({
        data: {
          user_id: "system",
          user_name: "Migration",
          user_role: "system",
          entity: "settings",
          entity_id: "integrity-v1",
          action: "migration",
          field: "controller_id,team_id,legacy_aggregate,dispute.status",
          new_value: "Canonical IDs and states; historical totals unchanged",
        },
      });
    },
    { timeout: 120000 },
  );
  console.log(
    "Integrity migration complete. Historical totals were not recalculated.",
  );
} finally {
  await db.$disconnect();
}
