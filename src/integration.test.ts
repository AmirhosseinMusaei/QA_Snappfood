import test, { before, after, describe } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { app, prisma } from "../server.ts";
import {
  dateToJalali,
  jalaliMonthRange,
  parseJalaliOrGregorianDate,
} from "./utils/persian.ts";
import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
let server: Server,
  base: string,
  forms: any,
  sales: any,
  support: any,
  serial = 0;
const cookies: Record<string, string> = {},
  users: Record<string, any> = {};
async function request(
  role: string,
  path: string,
  method = "GET",
  body?: any,
  headers: any = {},
) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(cookies[role] ? { Cookie: cookies[role] } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const buffer = Buffer.from(await res.arrayBuffer());
  let data: any;
  try {
    data = JSON.parse(buffer.toString());
  } catch {}
  return { status: res.status, data, buffer, headers: res.headers };
}
const full = (rubric: any[]) =>
  Object.fromEntries(
    rubric.flatMap((s) =>
      s.criteria.flatMap((c: any) =>
        c.items.map((i: any) => [i.id, i.maxPoints]),
      ),
    ),
  );
async function create(overrides: any = {}, role = "supervisor", agent = sales) {
  const type = agent.department;
  const payload = {
    agent_id: agent.id,
    form_type: type,
    form_id: forms[type + "FormId"],
    sample_name: "Random Sampling",
    ticket_number: "test-" + ++serial,
    phone_number: "09120000000",
    vendor_id: "0000123",
    project: "NCR",
    registration_date: "1405/07/01",
    execution_date: "1405/07/02",
    check_date: "1405/07/10",
    result: "No problem",
    mistake_count: 0,
    [type + "_scores"]: full(forms[type + "Rubric"]),
    ...overrides,
  };
  return request(role, "/api/assessments", "POST", payload);
}
async function fixture(
  overrides: any = {},
  role = "supervisor",
  agent = sales,
) {
  const r = await create(overrides, role, agent);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.data;
}
async function detail(id: string) {
  return (await request("supervisor", "/api/assessments/" + id)).data.data;
}
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  for (const name of [
    "admin",
    "supervisor",
    "meysam",
    "asal",
    "mahya",
    "negin",
    "mgr_sales",
  ]) {
    const r = await request("", "/api/auth/login", "POST", {
      username: name,
      password: "snappfood123",
    });
    assert.equal(r.status, 200);
    cookies[name] = r.headers.get("set-cookie")!.split(";")[0];
    users[name] = r.data.user;
    assert.ok(!r.data.token);
  }
  forms = (await request("supervisor", "/api/forms")).data;
  sales = await prisma.agent.findUniqueOrThrow({
    where: { id: users.mahya.agent_id },
  });
  support = await prisma.agent.findFirstOrThrow({
    where: { department: "support", controller_id: users.asal.id },
  });
});
after(async () => {
  await prisma.$disconnect();
  await new Promise<void>((r) => server.close(() => r()));
});
describe("Authentication, safe DTOs and the actual PRD permission matrix", () => {
  test("unauthenticated list is 401", async () =>
    assert.equal((await request("", "/api/assessments")).status, 401));
  test("default-password legacy login removed", async () =>
    assert.equal(
      (await request("", "/api/users/login", "POST", { username: "admin" }))
        .status,
      400,
    ));
  test("SSO is unavailable, not fake-authenticated", async () =>
    assert.equal(
      (
        await request("", "/api/auth/login", "POST", {
          username: "admin",
          ssoToken: "fake",
          provider: "sso",
        })
      ).status,
      503,
    ));
  test("dev role header is refused outside explicit dev mode", async () =>
    assert.equal(
      (
        await request("", "/api/assessments", "GET", undefined, {
          "x-dev-role": "admin",
        })
      ).status,
      401,
    ));
  test("all agent response relations exclude password hashes", async () => {
    for (const role of Object.keys(cookies)) {
      const r = await request(role, "/api/agents");
      assert.equal(r.status, 200);
      assert.ok(!JSON.stringify(r.data).includes('"password"'));
    }
  });
  test("user mutation sanitizes returned hash", async () => {
    const r = await request("admin", "/api/users", "POST", {
      username: "test-user",
      password: "test-secure-password",
      name: "Test User",
      role: "agent",
    });
    assert.equal(r.status, 201);
    assert.ok(!r.data.data.password);
    const u = await request("admin", "/api/users/" + r.data.data.id, "PUT", {
      password: "replacement-password",
    });
    assert.equal(u.status, 200);
    assert.ok(!u.data.data.password);
  });
  test("agent list is scoped and cannot override agent filter", async () => {
    const r = await request("mahya", "/api/assessments?limit=100");
    assert.ok(r.data.data.every((a: any) => a.agent_id === sales.id));
    const other = await request(
      "mahya",
      "/api/assessments?agent_id=" + support.id,
    );
    assert.equal(other.data.total, 0);
  });
  test("agent cannot read another detail", async () => {
    const a = await fixture({}, "supervisor", support);
    assert.equal(
      (await request("mahya", "/api/assessments/" + a.id)).status,
      403,
    );
  });
  for (const role of ["admin", "supervisor", "meysam", "negin", "mgr_sales"])
    test(role + " may read authorized reports", async () =>
      assert.equal(
        (await request(role, "/api/export/assessments.csv")).status,
        200,
      ),
    );
  test("admin reads all scores but cannot create/edit/delete", async () => {
    const a = await fixture();
    assert.equal(
      (await request("admin", "/api/assessments/" + a.id)).status,
      200,
    );
    assert.ok(
      (await request("admin", "/api/assessments?limit=100")).data.total > 0,
    );
    assert.equal((await create({}, "admin")).status, 403);
    assert.equal(
      (
        await request("admin", "/api/assessments/" + a.id, "PUT", {
          revision: a.revision,
          result_comment: "x",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("admin", "/api/assessments/" + a.id, "DELETE", {
          revision: a.revision,
        })
      ).status,
      403,
    );
  });
  test("agent cannot export or read global problems", async () => {
    for (const path of [
      "/api/export/assessments.csv",
      "/api/export/assessments.xlsx",
      "/api/export/monthly-scores.xlsx",
      "/api/problems",
    ])
      assert.equal((await request("mahya", path)).status, 403);
  });
  test("unassigned controller cannot create or mutate", async () => {
    assert.equal((await create({}, "asal")).status, 403);
    const a = await fixture();
    assert.equal(
      (
        await request("asal", "/api/assessments/" + a.id, "PUT", {
          revision: a.revision,
          is_fraud: true,
        })
      ).status,
      403,
    );
  });
  test("manager without department is fail closed", async () => {
    const u = await prisma.user.create({
      data: {
        username: "manager-none",
        name: "No department",
        role: "manager",
        password: await bcrypt.hash("test-secure-password", 10),
      },
    });
    const r = await request("", "/api/auth/login", "POST", {
      username: u.username,
      password: "test-secure-password",
    });
    cookies.none = r.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await request("none", "/api/assessments")).data.total, 0);
    assert.equal((await request("none", "/api/analytics")).status, 403);
  });
  test("persistent revocation shared by separate adapter instances", async () => {
    const { LocalDatabaseAuthAdapter } =
      await import("./server/auth/adapter.ts");
    const db = new PrismaClient();
    try {
      const a = new LocalDatabaseAuthAdapter(prisma),
        b = new LocalDatabaseAuthAdapter(db),
        token = await a.createSession(users.admin);
      assert.ok(await b.validateSession(token));
      await a.destroySession(token);
      assert.equal(await b.validateSession(token), null);
    } finally {
      await db.$disconnect();
    }
  });
  test("logout cookie replay fails", async () => {
    const r = await request("", "/api/auth/login", "POST", {
      username: "admin",
      password: "snappfood123",
    });
    cookies.temp = r.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (await request("temp", "/api/auth/logout", "POST", {})).status,
      200,
    );
    assert.equal((await request("temp", "/api/agents")).status, 401);
  });
  test("full origin scheme/host/port enforced", async () => {
    const a = await fixture();
    for (const Origin of [
      "https://evil.example",
      base.replace("http:", "https:"),
    ])
      assert.equal(
        (
          await request(
            "supervisor",
            "/api/assessments/" + a.id,
            "PUT",
            { revision: a.revision, result_comment: "x" },
            { Origin },
          )
        ).status,
        403,
      );
  });
});
describe("Authoritative API scoring, settings, validation and transactions", () => {
  test("valid support/sales both total 100", async () => {
    assert.equal((await fixture()).total_score, 100);
    assert.equal((await fixture({}, "supervisor", support)).total_score, 100);
  });
  test("direct 999 total is rejected", async () => {
    const a = await fixture();
    const r = await request("supervisor", "/api/assessments/" + a.id, "PUT", {
      revision: a.revision,
      total_score: 999,
    });
    assert.equal(r.status, 400);
    assert.equal((await detail(a.id)).total_score, 100);
  });
  test("fraud-only update recalculates zero and clear recalculates", async () => {
    const a = await fixture();
    const r = await request("supervisor", "/api/assessments/" + a.id, "PUT", {
      revision: a.revision,
      is_fraud: true,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.data.total_score, 0);
    const clear = await request(
      "supervisor",
      "/api/assessments/" + a.id,
      "PUT",
      { revision: r.data.data.revision, is_fraud: false },
    );
    assert.equal(clear.data.data.total_score, 100);
  });
  test("critical-only update recalculates zero", async () => {
    const a = await fixture();
    const fault = await prisma.fault.findFirstOrThrow({
      where: { is_critical: true, department: { in: ["sales", "both"] } },
    });
    const r = await request("supervisor", "/api/assessments/" + a.id, "PUT", {
      revision: a.revision,
      fault_id: fault.id,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.data.total_score, 0);
  });
  test("mistake-only update persists and recalculates", async () => {
    const a = await fixture();
    const r = await request("supervisor", "/api/assessments/" + a.id, "PUT", {
      revision: a.revision,
      mistake_count: 2,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.data.total_score, 90);
    assert.equal(r.data.data.mistake_count, 2);
  });
  test("stale revision rejected", async () => {
    const a = await fixture();
    const r = await request("supervisor", "/api/assessments/" + a.id, "PUT", {
      revision: a.revision,
      mistake_count: 1,
    });
    assert.equal(r.status, 200);
    assert.equal(
      (
        await request("supervisor", "/api/assessments/" + a.id, "PUT", {
          revision: a.revision,
          mistake_count: 2,
        })
      ).status,
      409,
    );
  });
  test("revision required for edits", async () => {
    const a = await fixture();
    assert.equal(
      (
        await request("supervisor", "/api/assessments/" + a.id, "PUT", {
          is_fraud: true,
        })
      ).status,
      428,
    );
  });
  test("wrong form and form ID rejected", async () => {
    assert.equal(
      (
        await create({
          form_type: "support",
          form_id: forms.supportFormId,
          support_scores: full(forms.supportRubric),
        })
      ).status,
      400,
    );
    assert.equal((await create({ form_id: forms.supportFormId })).status, 400);
  });
  test("unknown/out-of-range/fractional item scores rejected", async () => {
    for (const values of [
      { ...full(forms.salesRubric), unknown: 100 },
      {
        ...full(forms.salesRubric),
        [Object.keys(full(forms.salesRubric))[0]]: 999,
      },
      {
        ...full(forms.salesRubric),
        [Object.keys(full(forms.salesRubric))[0]]: 0.5,
      },
    ])
      assert.equal((await create({ sales_scores: values })).status, 400);
  });
  for (const count of [-1, 0.5, "2"])
    test("invalid mistake_count " + JSON.stringify(count), async () =>
      assert.equal((await create({ mistake_count: count })).status, 400),
    );
  test("boolean strings not coerced to true", async () =>
    assert.equal((await create({ is_fraud: "false" })).status, 400));
  test("required metadata missing is 400", async () => {
    assert.equal((await create({ vendor_id: "" })).status, 400);
    assert.equal(
      (await create({ ticket_number: "" }, "supervisor", support)).status,
      400,
    );
    assert.equal((await create({ registration_date: "" })).status, 400);
  });
  test("impossible dates rejected", async () => {
    for (const date of ["not-a-date", "2026-02-31", "1404/12/30", "1405/13/01"])
      assert.equal((await create({ check_date: date })).status, 400);
  });
  test("actual settings table is consumed and old policy snapshot retained", async () => {
    const a = await fixture();
    const table = { 0: 30, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const r = await request("supervisor", "/api/settings", "PUT", {
      settings: { sales_mistake_deductions: table },
    });
    assert.equal(r.status, 200);
    const fresh = await fixture({ mistake_count: 1 });
    assert.equal(fresh.total_score, 70);
    const old = await request("supervisor", "/api/assessments/" + a.id, "PUT", {
      revision: a.revision,
      mistake_count: 1,
    });
    assert.equal(old.data.data.total_score, 95);
    await request("supervisor", "/api/settings", "PUT", {
      settings: {
        sales_mistake_deductions: { 0: 30, 1: 25, 2: 20, 3: 15, 4: 10, 5: 0 },
      },
    });
  });
  test("idempotency prevents retry duplication and rejects payload reuse", async () => {
    const body = {
      agent_id: sales.id,
      form_type: "sales",
      form_id: forms.salesFormId,
      sample_name: "Random Sampling",
      vendor_id: "123",
      phone_number: "0912",
      project: "NCR",
      registration_date: "1405/07/01",
      execution_date: "1405/07/01",
      check_date: "1405/07/01",
      result: "No problem",
      sales_scores: full(forms.salesRubric),
    };
    const h = { "Idempotency-Key": "test-retry" };
    const a = await request("supervisor", "/api/assessments", "POST", body, h),
      b = await request("supervisor", "/api/assessments", "POST", body, h);
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(a.data.data.id, b.data.data.id);
    assert.equal(
      (
        await request(
          "supervisor",
          "/api/assessments",
          "POST",
          { ...body, result_comment: "different" },
          h,
        )
      ).status,
      409,
    );
  });
  test("duplicate ticket requires deliberate confirmation", async () => {
    await fixture({ ticket_number: "dup-ticket" }, "supervisor", support);
    assert.equal(
      (await create({ ticket_number: "dup-ticket" }, "supervisor", support))
        .status,
      409,
    );
    assert.equal(
      (
        await create(
          { ticket_number: "dup-ticket", confirm_duplicate: true },
          "supervisor",
          support,
        )
      ).status,
      201,
    );
  });
  test("audit failure rolls back assessment and scores", async () => {
    const count = await prisma.assessment.count();
    await prisma.$executeRawUnsafe(
      "CREATE TRIGGER fail_audit BEFORE INSERT ON AuditLog BEGIN SELECT RAISE(ABORT, 'test audit failure'); END",
    );
    try {
      const r = await create();
      assert.ok(r.status >= 400);
      assert.equal(await prisma.assessment.count(), count);
    } finally {
      await prisma.$executeRawUnsafe("DROP TRIGGER fail_audit");
    }
  });
  test("score rows match JSON and total after edit", async () => {
    const a = await fixture();
    const key = Object.keys(a.sales_scores)[0];
    const r = await request("supervisor", "/api/assessments/" + a.id, "PUT", {
      revision: a.revision,
      sales_scores: { [key]: 0 },
    });
    assert.equal(r.status, 200);
    const stored = await prisma.assessment.findUniqueOrThrow({
      where: { id: a.id },
      include: { scores: true },
    });
    assert.equal(
      stored.scores.find((s) => s.item_id === key)!.awarded_score,
      0,
    );
    assert.equal(JSON.parse(stored.sales_scores_json!)[key], 0);
    assert.equal(stored.total_score, 99);
  });
});
describe("Disputes and soft-delete policies", () => {
  async function disputed(fraud = false) {
    const a = await fixture({ is_fraud: fraud });
    const item = Object.keys(a.sales_scores)[0];
    const r = await request(
      "mahya",
      "/api/assessments/" + a.id + "/dispute",
      "POST",
      { criterion_id: item, agent_comment: "Please review this item" },
    );
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return { a, d: r.data.data, item };
  }
  test("agent files valid own dispute with canonical open state", async () =>
    assert.equal((await disputed()).d.status, "open"));
  test("outside window rejected on server", async () => {
    const a = await fixture();
    await prisma.assessment.update({
      where: { id: a.id },
      data: { created_at: new Date(Date.now() - 4 * 86400000) },
    });
    assert.equal(
      (
        await request(
          "mahya",
          "/api/assessments/" + a.id + "/dispute",
          "POST",
          {
            criterion_id: Object.keys(a.sales_scores)[0],
            agent_comment: "late",
          },
        )
      ).status,
      400,
    );
  });
  test("unknown criterion rejected", async () => {
    const a = await fixture();
    assert.equal(
      (
        await request(
          "mahya",
          "/api/assessments/" + a.id + "/dispute",
          "POST",
          { criterion_id: "wrong", agent_comment: "x" },
        )
      ).status,
      400,
    );
  });
  test("duplicate active dispute rejected", async () => {
    const { a, item } = await disputed();
    assert.equal(
      (
        await request(
          "mahya",
          "/api/assessments/" + a.id + "/dispute",
          "POST",
          { criterion_id: item, agent_comment: "duplicate" },
        )
      ).status,
      409,
    );
  });
  test("supervisor cannot file disputes as an agent", async () => {
    const a = await fixture();
    assert.equal(
      (
        await request(
          "supervisor",
          "/api/assessments/" + a.id + "/dispute",
          "POST",
          { criterion_id: "x", agent_comment: "x" },
        )
      ).status,
      403,
    );
  });
  test("arbitrary revised total rejected", async () => {
    const { a, d } = await disputed();
    assert.equal(
      (
        await request(
          "supervisor",
          "/api/disputes/" + d.id + "/resolve",
          "PUT",
          {
            status: "accepted",
            controller_comment: "x",
            revision: a.revision,
            revised_score: 999,
          },
        )
      ).status,
      400,
    );
  });
  test("item corrections recompute total and preserve fraud override", async () => {
    for (const fraud of [false, true]) {
      const { a, d, item } = await disputed(fraud);
      const r = await request(
        "supervisor",
        "/api/disputes/" + d.id + "/resolve",
        "PUT",
        {
          status: "accepted",
          controller_comment: "Re-listened",
          revision: a.revision,
          item_scores: { [item]: 0 },
        },
      );
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.data.total_score, fraud ? 0 : 99);
      assert.equal(r.data.data.dispute.status, "accepted");
      assert.equal(r.data.data.sales_scores[item], 0);
    }
  });
  test("wrong item/max and unauthorized resolver rejected", async () => {
    const { a, d, item } = await disputed();
    assert.equal(
      (
        await request(
          "supervisor",
          "/api/disputes/" + d.id + "/resolve",
          "PUT",
          {
            status: "accepted",
            controller_comment: "x",
            revision: a.revision,
            item_scores: { [item]: 5 },
          },
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request("asal", "/api/disputes/" + d.id + "/resolve", "PUT", {
          status: "rejected",
          controller_comment: "x",
          revision: a.revision,
        })
      ).status,
      403,
    );
  });
  test("terminal dispute cannot silently change decision", async () => {
    const { a, d } = await disputed();
    const r = await request(
      "supervisor",
      "/api/disputes/" + d.id + "/resolve",
      "PUT",
      {
        status: "rejected",
        controller_comment: "No correction",
        revision: a.revision,
      },
    );
    assert.equal(r.status, 200);
    assert.equal(
      (
        await request(
          "supervisor",
          "/api/disputes/" + d.id + "/resolve",
          "PUT",
          {
            status: "in_review",
            controller_comment: "reopen",
            revision: r.data.data.revision,
          },
        )
      ).status,
      409,
    );
  });
  test("agent cannot retrieve or dispute deleted records", async () => {
    const a = await fixture();
    assert.equal(
      (
        await request("supervisor", "/api/assessments/" + a.id, "DELETE", {
          revision: a.revision,
        })
      ).status,
      200,
    );
    assert.equal(
      (await request("mahya", "/api/assessments/" + a.id)).status,
      404,
    );
    const list = await request(
      "mahya",
      "/api/assessments?include_deleted=true&limit=100",
    );
    assert.ok(!list.data.data.some((r: any) => r.id === a.id));
    assert.equal(
      (
        await request(
          "mahya",
          "/api/assessments/" + a.id + "/dispute",
          "POST",
          { criterion_id: "x", agent_comment: "x" },
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          "supervisor",
          "/api/assessments/" + a.id + "/restore",
          "POST",
          {},
        )
      ).status,
      200,
    );
  });
});
describe("Forms, dates, reports, imports and audit", () => {
  test("standard Sales rubric saves with canonical response", async () => {
    const r = await request("supervisor", "/api/forms/sales", "PUT", {
      sections: forms.salesRubric,
      expected_version: forms.salesFormVersion,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(r.data.formId);
    assert.ok(r.data.canonicalRubric);
    forms = (await request("supervisor", "/api/forms")).data;
    assert.equal((await fixture()).form_id, forms.salesFormId);
  });
  test("invalid recursive sums rejected, transaction leaves versions intact", async () => {
    const sections = structuredClone(forms.salesRubric);
    sections[0].criteria[0].items[0].maxPoints = 20;
    const count = await prisma.assessmentForm.count();
    assert.equal(
      (await request("supervisor", "/api/forms/sales", "PUT", { sections }))
        .status,
      400,
    );
    assert.equal(await prisma.assessmentForm.count(), count);
  });
  test("historical rubric stays unchanged after active title change", async () => {
    const a = await fixture();
    const title = a.rubric[0].criteria[0].title;
    const sections = structuredClone(forms.salesRubric);
    sections[0].criteria[0].title = "A changed title";
    const r = await request("supervisor", "/api/forms/sales", "PUT", {
      sections,
    });
    assert.equal(r.status, 200);
    forms = (await request("supervisor", "/api/forms")).data;
    const old = await detail(a.id);
    assert.equal(old.rubric[0].criteria[0].title, title);
    assert.equal(old.form_id, a.form_id);
  });
  test("month boundary follows Tehran business date", async () => {
    const a = await fixture({ check_date: "2026-10-22T21:00:00Z" });
    assert.equal(a.check_date_jalali_plain, "1405/08/01");
    assert.ok(
      !(
        await request(
          "supervisor",
          "/api/assessments?year=1405&month=7&limit=100",
        )
      ).data.data.some((r: any) => r.id === a.id),
    );
    assert.ok(
      (
        await request(
          "supervisor",
          "/api/assessments?year=1405&month=8&limit=100",
        )
      ).data.data.some((r: any) => r.id === a.id),
    );
  });
  test("invalid month is 400, not unfiltered data", async () =>
    assert.equal(
      (await request("supervisor", "/api/assessments?year=1405&month=13"))
        .status,
      400,
    ));
  test("server pagination capped and returns totals", async () => {
    const r = await request("supervisor", "/api/assessments?page=1&limit=2");
    assert.equal(r.data.data.length, 2);
    assert.ok(r.data.total > 2);
    assert.equal(
      (await request("supervisor", "/api/assessments?limit=100000")).data.limit,
      100,
    );
  });
  test("monthly export differs by selected month and matches service", async () => {
    const empty = await request(
      "admin",
      "/api/export/monthly-scores.xlsx?year=1390&month=1",
    );
    const current = await request(
      "admin",
      "/api/export/monthly-scores.xlsx?year=1405&month=7",
    );
    assert.equal(empty.status, 200);
    assert.equal(current.status, 200);
    const rows = async (b: Buffer) => {
      const w = new ExcelJS.Workbook();
      await w.xlsx.load(b as any);
      return (w.worksheets[0].getSheetValues() as any[])
        .slice(1)
        .map((r) => r.slice(1));
    };
    assert.notDeepEqual(await rows(empty.buffer), await rows(current.buffer));
    const report = await request(
      "admin",
      "/api/monthly-scores?year=1405&month=7",
    );
    const row: any = (await rows(current.buffer)).find(
      (r: any) => r[0] === sales.source_id,
    );
    const metric = report.data.data.rows.find(
      (r: any) => r.agent.id === sales.id,
    );
    assert.equal(row[10], metric.finalMonthlyScore ?? "");
  });
  test("empty month has null final scores", async () => {
    const r = await request("mahya", "/api/monthly-scores?year=1390&month=1");
    assert.equal(r.data.data.rows.length, 1);
    assert.equal(r.data.data.rows[0].finalMonthlyScore, null);
  });
  test("CSV supports quoted commas/newlines and neutralizes formula cells", async () => {
    const a = await fixture({ vendor_title: "=SUM(1,2)\nsecond line" });
    const r = await request(
      "admin",
      "/api/export/assessments.csv?search=" + a.id,
    );
    const parsed: any[] = parseCsv(r.buffer.toString(), {
      bom: true,
      columns: true,
    });
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]["نام وندور"], "'=SUM(1,2)\nsecond line");
  });
  test("aggregate history import preserves controller/flags, is idempotent and excludes invented details", async () => {
    const row = {
      source_id: sales.source_id,
      controller_id: "meysam",
      check_date: "1404/01/01",
      total_score: 0,
      is_fraud: true,
      backend_general: true,
      vendor_id: "0000123",
      vendor_title: "with,comma\nand newline",
      result: "No problem",
      phone_number: "09120000000",
    };
    const preview = await request(
      "supervisor",
      "/api/assessments/import",
      "POST",
      { rows: [row], dryRun: true },
    );
    assert.equal(preview.status, 200);
    assert.equal(preview.data.errorCount, 0);
    const first = await request(
      "supervisor",
      "/api/assessments/import",
      "POST",
      { rows: [row], dryRun: false },
    );
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.equal(first.data.importedCount, 1);
    const repeat = await request(
      "supervisor",
      "/api/assessments/import",
      "POST",
      { rows: [row], dryRun: false },
    );
    assert.equal(repeat.data.importedCount, 0);
    const stored = await prisma.assessment.findFirstOrThrow({
      where: { vendor_title: row.vendor_title },
    });
    assert.equal(stored.controller_id, users.meysam.id);
    assert.equal(stored.legacy_aggregate, true);
    assert.equal(stored.form_id, null);
    assert.equal(stored.is_fraud, true);
  });
  test("import is atomic when one row is invalid", async () => {
    const count = await prisma.assessment.count();
    const r = await request("supervisor", "/api/assessments/import", "POST", {
      rows: [
        {
          source_id: sales.source_id,
          controller_id: "meysam",
          check_date: "bad",
          total_score: 99,
        },
      ],
      dryRun: false,
    });
    assert.equal(r.status, 400);
    assert.equal(await prisma.assessment.count(), count);
  });
  test("admin cannot bypass assessment creation using import", async () =>
    assert.equal(
      (
        await request("admin", "/api/assessments/import", "POST", {
          rows: [],
          dryRun: false,
        })
      ).status,
      403,
    ));
  test("controller audit is restricted to own authored assessment IDs", async () => {
    const r = await request("meysam", "/api/audit-logs?limit=100");
    assert.equal(r.status, 200);
    for (const log of r.data.data) {
      if (log.user_id === users.meysam.id) continue;
      const a = await prisma.assessment.findUnique({
        where: { id: log.entity_id },
      });
      assert.equal(a?.controller_id, users.meysam.id);
    }
  });
  test("structured audit records capture field before/after", async () => {
    const a = await fixture();
    await request("supervisor", "/api/assessments/" + a.id, "PUT", {
      revision: a.revision,
      is_fraud: true,
    });
    const logs = await prisma.auditLog.findMany({
      where: { entity_id: a.id, action: "update" },
    });
    assert.ok(
      logs.some(
        (l) =>
          l.field === "is_fraud" &&
          l.old_value === "false" &&
          l.new_value === "true",
      ),
    );
    assert.ok(
      logs.some(
        (l) =>
          l.field === "total_score" &&
          l.old_value === "100" &&
          l.new_value === "0",
      ),
    );
  });
  test("impossible Jalali leap and Gregorian dates are null", () => {
    assert.equal(parseJalaliOrGregorianDate("2026-02-31"), null);
    assert.equal(parseJalaliOrGregorianDate("1404/12/30"), null);
    assert.equal(
      dateToJalali(jalaliMonthRange(1405, 8).gte).jalaliStr,
      "1405/08/01",
    );
  });
});

describe("Administration, migration boundaries and safe metadata", () => {
  test("team and fault CRUD are audited and history-protected", async () => {
    const team = await request("admin", "/api/teams", "POST", {
      name: "Test disposable team",
      department: "support",
      lead_id: users.negin.id,
    });
    assert.equal(team.status, 201);
    const renamed = await request(
      "admin",
      "/api/teams/" + team.data.data.id,
      "PUT",
      { name: "Renamed disposable team" },
    );
    assert.equal(renamed.status, 200);
    assert.equal(
      (await request("admin", "/api/teams/" + team.data.data.id, "DELETE", {}))
        .status,
      200,
    );
    const fault = await request("supervisor", "/api/faults", "POST", {
      title: "Disposable fault",
      department: "both",
      category: "Process problem",
      is_critical: false,
    });
    assert.equal(fault.status, 201);
    assert.equal(
      (
        await request(
          "supervisor",
          "/api/faults/" + fault.data.data.id,
          "PUT",
          { is_critical: true },
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "supervisor",
          "/api/faults/" + fault.data.data.id,
          "DELETE",
          {},
        )
      ).status,
      200,
    );
    assert.ok(
      await prisma.auditLog.count({
        where: { entity_id: fault.data.data.id, action: "delete" },
      }),
    );
  });
  test("user role and privileged unknown-field injection rejected", async () => {
    assert.equal(
      (
        await request("admin", "/api/users", "POST", {
          username: "injected",
          password: "test-secure-password",
          name: "Wrong",
          role: "root",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("admin", "/api/agents/" + sales.id, "PUT", {
          user: { connect: { id: users.admin.id } },
        })
      ).status,
      400,
    );
  });
  test("roster import parses quoted names/newlines and resolves immutable assignments", async () => {
    const csv =
      'name,source_id,team,department,team_lead,controller,operator_panel,sample_name,check_process,min_monthly_reviews\n"Name, with\nnewline",009999,Technical,support,حسین جدیری,asal,Jira,Random Sampling,if needed,40';
    const preview = await request("admin", "/api/agents/import-csv", "POST", {
      csvText: csv,
      dryRun: true,
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.errors.length, 0);
    const imported = await request("admin", "/api/agents/import-csv", "POST", {
      csvText: csv,
      dryRun: false,
    });
    assert.equal(imported.status, 200, JSON.stringify(imported.data));
    const a = await prisma.agent.findUniqueOrThrow({
      where: { source_id: "009999" },
    });
    assert.equal(a.name, "Name, with\nnewline");
    assert.equal(a.controller_id, users.asal.id);
  });
  test("malformed CSV and duplicate headers are 400, not server errors", async () => {
    for (const csvText of ['a,b\n"unterminated', "source_id,source_id\n1,2"])
      assert.equal(
        (
          await request("admin", "/api/agents/import-csv", "POST", {
            csvText,
            dryRun: true,
          })
        ).status,
        400,
      );
  });
  test("complete historical scores use explicit original version and stay detailed", async () => {
    const row = {
      source_id: sales.source_id,
      controller_id: "meysam",
      form_id: forms.salesFormId,
      check_date: "1404/02/01",
      registration_date: "1404/01/30",
      execution_date: "1404/02/01",
      project: "NCR",
      total_score: 100,
      vendor_id: "000123",
      phone_number: "0912",
      result: "No problem",
      sales_scores: full(forms.salesRubric),
    };
    const r = await request("supervisor", "/api/assessments/import", "POST", {
      rows: [row],
      dryRun: false,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const a = await prisma.assessment.findFirstOrThrow({
      where: { sample_name: "Historical Import", legacy_aggregate: false },
    });
    assert.equal(a.form_id, forms.salesFormId);
    assert.ok(
      await prisma.assessmentScore.count({ where: { assessment_id: a.id } }),
    );
  });
  test("agent history endpoint exposes only its own assessment changes", async () => {
    const a = await fixture(),
      other = await fixture({}, "supervisor", support);
    const own = await request("mahya", "/api/assessments/" + a.id + "/history");
    assert.equal(own.status, 200);
    assert.ok(own.data.data.length > 0);
    assert.equal(
      (await request("mahya", "/api/assessments/" + other.id + "/history"))
        .status,
      404,
    );
  });
  test("all monthly boundaries have the right Tehran date and preceding month", () => {
    for (const year of [1399, 1404, 1405])
      for (let month = 1; month <= 12; month++) {
        const interval = jalaliMonthRange(year, month),
          first = dateToJalali(interval.gte),
          before = dateToJalali(new Date(interval.gte.getTime() - 1));
        assert.equal(first.year, year);
        assert.equal(first.month, month);
        assert.equal(first.day, 1);
        assert.ok(before.month !== month || before.year !== year);
      }
  });
});

describe("Restored interface data contracts", () => {
  test("monthly dashboard detail is complete within the same authorized period and scope", async () => {
    const result = await request(
      "mahya",
      "/api/monthly-scores?year=1405&month=7&include_assessments=true",
    );
    assert.equal(result.status, 200);
    const report = result.data.data;
    assert.equal(report.assessments.length, report.assessmentCount);
    assert.ok(
      report.assessments.every(
        (a: any) =>
          a.agent_id === users.mahya.agent_id &&
          !a.deleted_at &&
          a.check_date_year === 1405 &&
          a.check_date_month_num === 7,
      ),
    );
    const plain = await request(
      "mahya",
      "/api/monthly-scores?year=1405&month=7",
    );
    assert.deepEqual(report.rows, plain.data.data.rows);
    assert.equal(plain.data.data.assessments, undefined);
  });
  test("inclusive report date filtering and exports use the same Tehran interval", async () => {
    const a = await fixture({ check_date: "2026-10-21T21:00:00Z" });
    const query = "start_date=1405%2F07%2F30&end_date=1405%2F07%2F30&limit=100";
    const list = await request("supervisor", "/api/assessments?" + query);
    assert.equal(list.status, 200);
    assert.ok(list.data.data.some((r: any) => r.id === a.id));
    const next = await request(
      "supervisor",
      "/api/assessments?start_date=1405%2F08%2F01&end_date=1405%2F08%2F01&limit=100",
    );
    assert.ok(!next.data.data.some((r: any) => r.id === a.id));
    assert.equal(
      (await request("supervisor", "/api/assessments?start_date=invalid"))
        .status,
      400,
    );
    const csv = await request(
      "supervisor",
      "/api/export/assessments.csv?" + query,
    );
    assert.equal(csv.status, 200);
    assert.ok(csv.buffer.toString().includes(a.id));
  });
  test("table formatting export is authenticated, validates shape and creates safe XLSX", async () => {
    const payload = {
      title: "گزارش",
      headers: ["کارشناس", "نمره"],
      rows: [['=HYPERLINK("x")', 87.5]],
    };
    assert.equal(
      (await request("", "/api/export/report-table.xlsx", "POST", payload))
        .status,
      401,
    );
    assert.equal(
      (await request("mahya", "/api/export/report-table.xlsx", "POST", payload))
        .status,
      403,
    );
    assert.equal(
      (
        await request("admin", "/api/export/report-table.xlsx", "POST", {
          ...payload,
          rows: [[1]],
        })
      ).status,
      400,
    );
    const r = await request(
      "admin",
      "/api/export/report-table.xlsx",
      "POST",
      payload,
    );
    assert.equal(r.status, 200);
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(r.buffer as any);
    assert.equal(workbook.worksheets[0].getCell("B3").value, 87.5);
    assert.equal(
      workbook.worksheets[0].getCell("A3").value,
      '\'=HYPERLINK("x")',
    );
  });
});
