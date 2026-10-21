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
