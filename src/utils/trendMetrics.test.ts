import test from "node:test";
import assert from "node:assert";
import {
  parseJalaliDate,
  getWeekOfMonth,
  getPersianMonthName,
  calculatePerformanceTrend,
} from "./trendMetrics.ts";
import type { Assessment, Agent } from "../types/index.ts";

test("parseJalaliDate parses Persian and English digits correctly", () => {
  const p1 = parseJalaliDate("۱۴۰۳/۰۷/۲۲");
  assert.deepStrictEqual(p1, { year: 1403, month: 7, day: 22 });

  const p2 = parseJalaliDate("1403/06/15");
  assert.deepStrictEqual(p2, { year: 1403, month: 6, day: 15 });

  const p3 = parseJalaliDate("");
  assert.strictEqual(p3, null);

  // ISO date UTC conversion to Asia/Tehran Jalali date (PRD requirement 8)
  const pIso = parseJalaliDate("2026-10-19T00:00:00.000Z");
  assert.deepStrictEqual(pIso, { year: 1405, month: 7, day: 27 });

  // Invalid date rejection
  assert.strictEqual(parseJalaliDate("not-a-date"), null);
  assert.strictEqual(parseJalaliDate("1405/13/45"), null);
});

test("getWeekOfMonth correctly partitions calendar days into weeks 1-4", () => {
  assert.strictEqual(getWeekOfMonth(1), 1);
  assert.strictEqual(getWeekOfMonth(7), 1);
  assert.strictEqual(getWeekOfMonth(8), 2);
  assert.strictEqual(getWeekOfMonth(14), 2);
  assert.strictEqual(getWeekOfMonth(15), 3);
  assert.strictEqual(getWeekOfMonth(21), 3);
  assert.strictEqual(getWeekOfMonth(22), 4);
  assert.strictEqual(getWeekOfMonth(31), 4);
});

test("getPersianMonthName returns proper Persian names", () => {
  assert.strictEqual(getPersianMonthName(5), "مرداد");
  assert.strictEqual(getPersianMonthName(6), "شهریور");
  assert.strictEqual(getPersianMonthName(7), "مهر");
});

test("calculatePerformanceTrend aggregates weekly and monthly scores & volume", () => {
  const dummyAgents: Agent[] = [
    {
      id: "ag-1",
      source_id: "101",
      name: "علی تستی",
      department: "sales",
      team: "Campaign",
      team_lead: "میلاد حاتمی",
      controller: "meysam",
      operator_panel: "CRM Sales",
      min_monthly_reviews: 40,
      active: true,
    },
    {
      id: "ag-2",
      source_id: "102",
      name: "سارا تستی",
      department: "sales",
      team: "Campaign",
      team_lead: "میلاد حاتمی",
      controller: "meysam",
      operator_panel: "CRM Sales",
      min_monthly_reviews: 40,
      active: true,
    },
  ];

  const dummyAssessments: Assessment[] = [
    {
      id: "ass-1",
      agent_id: "ag-1",
      controller_id: "meysam",
      form_type: "sales",
      sample_name: "Random Sampling",
      vendor_id: "10",
      vendor_title: "test vendor",
      check_date: "۱۴۰۳/۰۷/۰۵", // Week 1 Mehr
      phone_number: "09120000000",
      project: "Campaign",
      backend_general: false,
      is_fraud: false,
      result: "No problem",
      result_comment: "Good",
      total_score: 90,
      created_at: new Date().toISOString(),
    },
    {
      id: "ass-2",
      agent_id: "ag-1",
      controller_id: "meysam",
      form_type: "sales",
      sample_name: "Random Sampling",
      vendor_id: "10",
      vendor_title: "test vendor",
      check_date: "۱۴۰۳/۰۷/۰۶", // Week 1 Mehr
      phone_number: "09120000000",
      project: "Campaign",
      backend_general: false,
      is_fraud: false,
      result: "No problem",
      result_comment: "Good",
      total_score: 100,
      created_at: new Date().toISOString(),
    },
    {
      id: "ass-3",
      agent_id: "ag-2",
      controller_id: "meysam",
      form_type: "sales",
      sample_name: "Random Sampling",
      vendor_id: "10",
      vendor_title: "test vendor",
      check_date: "۱۴۰۳/۰۷/۱۶", // Week 3 Mehr
      phone_number: "09120000000",
      project: "Campaign",
      backend_general: false,
      is_fraud: false,
      result: "No problem",
      result_comment: "Good",
      total_score: 80,
      created_at: new Date().toISOString(),
    },
  ];

  // Weekly test
  const weekly = calculatePerformanceTrend(
    dummyAssessments,
    dummyAgents,
    { team: "Campaign" },
    "weekly",
  );
  assert.strictEqual(weekly.data.length, 2);
  assert.strictEqual(weekly.data[0].volume, 2);
  assert.strictEqual(weekly.data[0].avgScore, 95); // (90 + 100)/2
  assert.strictEqual(weekly.data[1].volume, 1);
  assert.strictEqual(weekly.data[1].avgScore, 80);
  assert.strictEqual(weekly.summary.totalVolume, 3);
  assert.strictEqual(weekly.summary.overallAvgScore, 90); // (90+100+80)/3

  // Monthly test
  const monthly = calculatePerformanceTrend(
    dummyAssessments,
    dummyAgents,
    { team: "Campaign" },
    "monthly",
  );
  assert.strictEqual(monthly.data.length, 1);
  assert.strictEqual(monthly.data[0].volume, 3);
  // Agent 1: (90+100)/2=95; Agent 2: 80. Team monthly score gives each agent equal weight.
  assert.strictEqual(monthly.data[0].avgScore, 87.5);
});
