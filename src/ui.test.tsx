import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { AppContext } from "./context/AppContext.tsx";
import { TeamLeadDashboard } from "./components/dashboards/TeamLeadDashboard.tsx";
import { AgentDashboard } from "./components/dashboards/AgentDashboard.tsx";
import { LoginModal } from "./components/auth/LoginModal.tsx";
import { ScoreCorrectionEditor } from "./components/ScoreCorrectionEditor.tsx";
import { DEFAULT_SETTINGS } from "./data/seedData.ts";
import { SALES_RUBRIC, getDefaultSalesScores } from "./utils/scoring.ts";
const empty: any = {
  currentUser: {
    id: "lead-second",
    username: "lead2",
    role: "team_lead",
    active: true,
  },
  role: "team_lead",
  settings: DEFAULT_SETTINGS,
  activeTab: "team_view",
  agents: [],
  teams: [],
  controllers: [],
  teamLeads: [],
  assessments: [],
  faults: [],
  allAssessments: [],
  updateAssessment: async () => {},
  deleteAssessment: async () => {},
  restoreAssessment: async () => {},
  refreshData: async () => {},
  login: async () => {},
};
const render = (element: React.ReactNode, context = empty) =>
  renderToString(
    <AppContext.Provider value={context}>{element}</AppContext.Provider>,
  );
test("empty lead dashboard renders safely without another-lead fallback", () => {
  const html = render(<TeamLeadDashboard />);
  assert.ok(html.includes("داشبورد تیم من"));
  assert.ok(!html.includes("First Lead"));
});
test("agent without profile/data renders empty/loading, not a fabricated score", () => {
  const html = render(<AgentDashboard />, {
    ...empty,
    currentUser: { id: "agent-user", role: "agent" },
    role: "agent",
  });
  assert.ok(html.includes("کارنامه و نمرات من"));
  assert.ok(!html.includes("۹۲"));
});
test("login has empty fields and no demo password/quick credentials", () => {
  const html = render(<LoginModal isOpen />);
  assert.ok(!html.includes("snappfood123"));
  assert.ok(!html.includes('value="admin"'));
  assert.ok(html.includes('type="password"'));
});
test("legacy aggregate shows unavailable detail instead of full scores", () => {
  const html = render(
    <ScoreCorrectionEditor
      assessment={{ legacy_aggregate: true } as any}
      scores={{}}
      onChange={() => {}}
    />,
  );
  assert.ok(html.includes("اصلاح نمره ممکن نیست"));
});
test("correction editor respects original item maximum and criterion scope", () => {
  const rubric = structuredClone(SALES_RUBRIC);
  const item = rubric[0].criteria[0].items[0];
  const html = render(
    <ScoreCorrectionEditor
      assessment={
        {
          rubric,
          form_type: "sales",
          sales_scores: getDefaultSalesScores(rubric),
        } as any
      }
      criterionId={item.id}
      scores={{}}
      onChange={() => {}}
    />,
  );
  assert.ok(html.includes('max="1"'));
  assert.equal((html.match(/type="number"/g) || []).length, 1);
});
test("authentication bootstrap contains no automatic credential login", () => {
  const src = readFileSync(
    new URL("./context/AppContext.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(!src.includes("username: 'admin'"));
  assert.ok(!src.includes("snappfood123"));
  assert.ok(src.includes("useState<boolean>(false)"));
});
test("API helper rejects HTTP errors and signals session expiry", async () => {
  const savedFetch = globalThis.fetch,
    savedWindow = (globalThis as any).window;
  const events = new EventTarget();
  (globalThis as any).window = events;
  let expired = false;
  events.addEventListener("qa-session-expired", () => {
    expired = true;
  });
  const { api } = await import("./utils/api.ts");
  try {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ success: false, message: "Validation rejected" }),
        { status: 400 },
      )) as any;
    await assert.rejects(() => api("/test", "POST", {}), /Validation rejected/);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ success: false, message: "Expired" }), {
        status: 401,
      })) as any;
    await assert.rejects(() => api("/test"));
    assert.equal(expired, true);
  } finally {
    globalThis.fetch = savedFetch;
    (globalThis as any).window = savedWindow;
  }
});

test("restored manager dashboard retains the original quality matrix and fault cards", async () => {
  const { ManagerDashboard } =
    await import("./components/dashboards/ManagerDashboard.tsx");
  const html = render(<ManagerDashboard />, {
    ...empty,
    currentManagerDept: "sales",
    setCurrentManagerDept: () => {},
  });
  assert.ok(html.includes("High / Low Quality Matrix"));
  assert.ok(html.includes("Fault Categories"));
  assert.ok(html.includes("Faults Matrix"));
  assert.ok(html.includes("bg-emerald-50"));
});
test("restored history retains filters, actions and assessment table", async () => {
  const { AuditsHistory } = await import("./components/AuditsHistory.tsx");
  const html = render(<AuditsHistory />);
  assert.ok(html.includes("Assessments List"));
  assert.ok(html.includes("همه نتایج ارزیابی"));
  assert.ok(html.includes("<table"));
});
test("absent months are excluded from rolling averages, including real zero scores", async () => {
  const { meanPresent } = await import("./context/useDashboardData.ts");
  assert.equal(meanPresent([null, 100, 0]), 50);
  assert.equal(meanPresent([null, undefined]), null);
});
test("CSV exports quote delimiters and neutralize spreadsheet formulas", async () => {
  const { csvCell } = await import("./utils/downloadTable.ts");
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
});
test("Tehran inclusive report dates exclude the following local day", async () => {
  const { tehranDateRange } = await import("./utils/persian.ts");
  assert.deepEqual(tehranDateRange("1405/07/01", "1405/07/01"), {
    gte: new Date("2026-09-22T20:30:00Z"),
    lt: new Date("2026-09-23T20:30:00Z"),
  });
  assert.throws(() => tehranDateRange("1405/07/02", "1405/07/01"));
  assert.throws(() => tehranDateRange("1405/12/30"));
});
test("Codespaces origin is allowed exactly in development and never enabled implicitly in production", async () => {
  const { validateCsrfOrigin } = await import("./server/auth/middleware.ts");
  const names = [
    "NODE_ENV",
    "APP_URL",
    "CODESPACE_NAME",
    "GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN",
    "PORT",
  ];
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  try {
    Object.assign(process.env, {
      NODE_ENV: "development",
      APP_URL: "http://localhost:3000",
      CODESPACE_NAME: "qa-demo",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
      PORT: "3000",
    });
    const check = (origin: string) => {
      let status = 200,
        next = false;
      const res: any = {
        status(n: number) {
          status = n;
          return this;
        },
        json() {},
      };
      validateCsrfOrigin(
        {
          method: "POST",
          path: "/auth/login",
          headers: { origin },
          cookies: {},
          signedCookies: {},
        } as any,
        res,
        () => {
          next = true;
        },
      );
      return { status, next };
    };
    assert.equal(check("https://qa-demo-3000.app.github.dev").next, true);
    assert.equal(check("https://evil-3000.app.github.dev").status, 403);
    assert.equal(check("http://localhost:3000.attacker.invalid").status, 403);
    process.env.NODE_ENV = "production";
    assert.equal(check("https://qa-demo-3000.app.github.dev").status, 403);
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
