import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const db = new PrismaClient();
try {
  if (
    process.env.ALLOW_SQLSERVER_SMOKE !== "true" ||
    !process.env.DATABASE_URL?.includes("database=qa_ci;")
  )
    throw new Error(
      "Smoke tests require isolated qa_ci SQL Server database and ALLOW_SQLSERVER_SMOKE=true.",
    );
  await db.$executeRawUnsafe(
    readFileSync("prisma/sqlserver-nullable-user-index.sql", "utf8"),
  );
  const marker = "smoke-" + Date.now();
  const team = await db.team.create({
    data: { name: marker, department: "sales", lead_name: "" },
  });
  const a = await db.agent.create({
    data: {
      name: "Smoke",
      source_id: marker + "-1",
      department: "sales",
      team_id: team.id,
      team_name: team.name,
      team_lead: "",
      controller: "",
    },
  });
  await db.agent.create({
    data: {
      name: "Smoke 2",
      source_id: marker + "-2",
      department: "sales",
      team_id: team.id,
      team_name: team.name,
      team_lead: "",
      controller: "",
    },
  });
  const assessment = await db.$transaction(async (tx) => {
    const record = await tx.assessment.create({
      data: {
        agent_id: a.id,
        controller_id: marker,
        form_type: "sales",
        sample_name: "Smoke",
        result: "No problem",
        total_score: 100,
        sales_scores_json: JSON.stringify({ longText: "x".repeat(4000) }),
      },
    });
    await tx.auditLog.create({
      data: {
        user_id: marker,
        user_name: "Smoke",
        user_role: "system",
        entity: "assessment",
        entity_id: record.id,
        action: "create",
        field: "total_score",
        new_value: "100",
      },
    });
    return record;
  });
  if (JSON.parse(assessment.sales_scores_json!).longText.length !== 4000)
    throw new Error("Long JSON was truncated");
  console.log(
    "SQL Server schema, nullable roster links, UTC assessment, long JSON, transaction and audit smoke tests passed.",
  );
} finally {
  await db.$disconnect();
}
