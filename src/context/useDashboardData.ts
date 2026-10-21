import { useEffect, useState } from "react";
import { useApp } from "./AppContext.tsx";
import { api } from "../utils/api.ts";
import { dateToJalali } from "../utils/persian.ts";
import type { Assessment } from "../types/index.ts";
export interface MonthlyRow {
  agent: { id: string; team_id: string; department: string };
  finalMonthlyScore: number | null;
  assessmentCount: number;
  fraudCount: number;
  target: number;
}
export interface MonthlyReport {
  rows: MonthlyRow[];
  assessments: Assessment[];
  criteriaLoss: { title: string; lostPoints: number; count: number }[];
}
export function meanPresent(values: (number | null | undefined)[]) {
  const actual = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  return actual.length
    ? Math.round((actual.reduce((n, v) => n + v, 0) / actual.length) * 10) / 10
    : null;
}
export function useDashboardData() {
  const { currentUser, assessments: changes, agents, settings } = useApp();
  const now = dateToJalali(new Date());
  const [state, setState] = useState<{
    key: string;
    reports: MonthlyReport[];
    loading: boolean;
    error: string;
  }>({ key: "", reports: [], loading: true, error: "" });
  const key = currentUser?.id + ":" + now.year + ":" + now.month;
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    setState({ key, reports: [], loading: true, error: "" });
    Promise.all(
      [0, 1, 2].map((offset) => {
        const value = now.year * 12 + now.month - 1 - offset;
        return api(
          `/api/monthly-scores?year=${Math.floor(value / 12)}&month=${(value % 12) + 1}&include_assessments=true`,
          "GET",
          undefined,
          {},
          { signal: abort.signal },
        ).then((r) => r.data);
      }),
    )
      .then((reports) => {
        if (active) setState({ key, reports, loading: false, error: "" });
      })
      .catch((e) => {
        if (active)
          setState({ key, reports: [], loading: false, error: e.message });
      });
    return () => {
      active = false;
      abort.abort();
    };
  }, [key, changes, agents, settings]);
  const reports = state.key === key ? state.reports : [];
  const score = (id: string, offset = 0) =>
    reports[offset]?.rows.find((r) => r.agent.id === id)?.finalMonthlyScore ??
    null;
  return {
    assessments: reports.flatMap((r) => r.assessments || []),
    reports,
    score,
    rolling: (id: string) => meanPresent(reports.map((_, i) => score(id, i))),
    targetYear: now.year,
    targetMonth: now.month,
    loading: state.key !== key || state.loading,
    error: state.key === key ? state.error : "",
  };
}
