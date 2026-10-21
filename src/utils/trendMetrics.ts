/**
 * Utility for aggregating historical assessment data into weekly and monthly team performance metrics.
 */
import { calculateAgentMonthlyScoreDetailed } from "./scoring.ts";
import type { Assessment, Agent, DepartmentType } from "../types/index.ts";
import {
  toEnglishDigits,
  toPersianDigits,
  JALALI_MONTHS,
  dateToJalali,
  parseJalaliOrGregorianDate,
} from "./persian.ts";

export interface TrendDataPoint {
  key: string;
  label: string;
  fullTitle: string;
  avgScore: number;
  volume: number;
  targetScore: number;
  lowScoreCount: number;
  fraudCount: number;
  minScore: number;
  maxScore: number;
  periodYear: number;
  periodMonth: number;
  periodWeek?: number;
}

export interface TrendSummary {
  totalVolume: number;
  overallAvgScore: number;
  currentAvgScore: number;
  previousAvgScore: number;
  scoreDelta: number;
  currentVolume: number;
  previousVolume: number;
  volumeDelta: number;
  bestPeriod: { label: string; score: number } | null;
  lowestPeriod: { label: string; score: number } | null;
}

export interface FilterOptions {
  team?: string | "all";
  department?: DepartmentType | "all";
  agentId?: string | "all";
  leadName?: string | "all";
}

/**
 * Parses Jalali date string (e.g., '۱۴۰۵/۰۷/۲۷' or '1405/07/27' or ISO string '2026-10-19T00:00:00.000Z')
 * Accurately projects ISO UTC timestamps into Tehran business Jalali date (e.g. 2026-10-19 -> 1405/07/27).
 * Rejects invalid dates by returning null.
 */
export function parseJalaliDate(
  dateStr: string,
): { year: number; month: number; day: number } | null {
  const date = parseJalaliOrGregorianDate(dateStr);
  if (!date) return null;
  const { year, month, day } = dateToJalali(date);
  return { year, month, day };
}

export function getWeekOfMonth(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export function getPersianMonthName(monthNumber: number): string {
  const index = monthNumber - 1;
  if (index >= 0 && index < JALALI_MONTHS.length) {
    return JALALI_MONTHS[index];
  }
  return `ماه ${monthNumber}`;
}

/**
 * Filters assessments according to the provided criteria
 */
export function filterAssessmentsForTrend(
  assessments: Assessment[],
  agents: Agent[],
  filters: FilterOptions,
): Assessment[] {
  const agentMap = new Map<string, Agent>();
  agents.forEach((ag) => agentMap.set(ag.id, ag));

  return assessments.filter((audit) => {
    // Ignore soft-deleted assessments
    if (audit.deleted_at) return false;

    const agent = agentMap.get(audit.agent_id);

    // Filter by specific agent
    if (filters.agentId && filters.agentId !== "all") {
      if (audit.agent_id !== filters.agentId) return false;
    }

    // Filter by team lead
    if (filters.leadName && filters.leadName !== "all") {
      if (!agent || agent.team_lead !== filters.leadName) return false;
    }

    // Filter by team
    if (filters.team && filters.team !== "all") {
      if (!agent || agent.team !== filters.team) return false;
    }

    // Filter by department
    if (filters.department && filters.department !== "all") {
      if (audit.form_type !== filters.department) return false;
    }

    return true;
  });
}

/**
 * Calculates weekly or monthly performance trend metrics
 */
export function calculatePerformanceTrend(
  assessments: Assessment[],
  agents: Agent[],
  filters: FilterOptions = {},
  granularity: "weekly" | "monthly" = "weekly",
): { data: TrendDataPoint[]; summary: TrendSummary } {
  const filtered = filterAssessmentsForTrend(assessments, agents, filters);

  const bucketMap = new Map<
    string,
    {
      key: string;
      label: string;
      fullTitle: string;
      scores: number[];
      fraudCount: number;
      lowScoreCount: number;
      year: number;
      month: number;
      week?: number;
      orderKey: number;
    }
  >();

  filtered.forEach((audit) => {
    const parsed = parseJalaliDate(audit.check_date);
    if (!parsed) return;

    const { year, month, day } = parsed;
    const monthName = getPersianMonthName(month);

    if (granularity === "monthly") {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const orderKey = year * 100 + month;
      const label = `${monthName} ${toPersianDigits(year)}`;
      const fullTitle = `عملکرد ${monthName} ماه سال ${toPersianDigits(year)}`;

      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          key,
          label,
          fullTitle,
          scores: [],
          fraudCount: 0,
          lowScoreCount: 0,
          year,
          month,
          orderKey,
        });
      }

      const b = bucketMap.get(key)!;
      b.scores.push(audit.total_score);
      if (audit.is_fraud) b.fraudCount += 1;
      if (audit.total_score < 80) b.lowScoreCount += 1;
    } else {
      // Weekly granularity
      const week = getWeekOfMonth(day);
      const key = `${year}-${String(month).padStart(2, "0")}-w${week}`;
      const orderKey = year * 1000 + month * 10 + week;
      const weekLabelFa =
        week === 1
          ? "هفته ۱"
          : week === 2
            ? "هفته ۲"
            : week === 3
              ? "هفته ۳"
              : "هفته ۴";
      const label = `${weekLabelFa} ${monthName}`;
      const fullTitle = `${weekLabelFa} ماه ${monthName} سال ${toPersianDigits(year)}`;

      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          key,
          label,
          fullTitle,
          scores: [],
          fraudCount: 0,
          lowScoreCount: 0,
          year,
          month,
          week,
          orderKey,
        });
      }

      const b = bucketMap.get(key)!;
      b.scores.push(audit.total_score);
      if (audit.is_fraud) b.fraudCount += 1;
      if (audit.total_score < 80) b.lowScoreCount += 1;
    }
  });

  // Sort buckets chronologically
  const sortedBuckets = Array.from(bucketMap.values()).sort(
    (a, b) => a.orderKey - b.orderKey,
  );

  const data: TrendDataPoint[] = sortedBuckets.map((b) => {
    const volume = b.scores.length;
    const sum = b.scores.reduce((acc, s) => acc + s, 0);
    const monthAudits = filtered.filter((a) => {
      const j = parseJalaliDate(a.check_date);
      return j?.year === b.year && j.month === b.month;
    });
    const perAgent = [...new Set(monthAudits.map((a) => a.agent_id))]
      .map((id) => {
        const list = monthAudits.filter((a) => a.agent_id === id);
        return calculateAgentMonthlyScoreDetailed(list, list[0].form_type)
          .finalMonthlyScore;
      })
      .filter((n): n is number => n !== null);
    const avgScore =
      granularity === "monthly" && perAgent.length
        ? Math.round(
            (perAgent.reduce((n, v) => n + v, 0) / perAgent.length) * 10,
          ) / 10
        : volume > 0
          ? Math.round((sum / volume) * 10) / 10
          : 0;
    const minScore = volume > 0 ? Math.min(...b.scores) : 0;
    const maxScore = volume > 0 ? Math.max(...b.scores) : 0;

    return {
      key: b.key,
      label: b.label,
      fullTitle: b.fullTitle,
      avgScore,
      volume,
      targetScore: 90,
      lowScoreCount: b.lowScoreCount,
      fraudCount: b.fraudCount,
      minScore,
      maxScore,
      periodYear: b.year,
      periodMonth: b.month,
      periodWeek: b.week,
    };
  });

  // Calculate overall summary metrics
  const totalVolume = data.reduce((acc, d) => acc + d.volume, 0);
  const totalScoreSum = data.reduce((acc, d) => acc + d.avgScore * d.volume, 0);
  const overallAvgScore =
    totalVolume > 0 ? Math.round((totalScoreSum / totalVolume) * 10) / 10 : 0;

  const currentPoint = data.length > 0 ? data[data.length - 1] : null;
  const previousPoint = data.length > 1 ? data[data.length - 2] : null;

  const currentAvgScore = currentPoint?.avgScore ?? 0;
  const previousAvgScore = previousPoint?.avgScore ?? currentAvgScore;
  const scoreDelta = Math.round((currentAvgScore - previousAvgScore) * 10) / 10;

  const currentVolume = currentPoint?.volume ?? 0;
  const previousVolume = previousPoint?.volume ?? currentVolume;
  const volumeDelta = currentVolume - previousVolume;

  let bestPeriod: { label: string; score: number } | null = null;
  let lowestPeriod: { label: string; score: number } | null = null;

  if (data.length > 0) {
    const sortedByScore = [...data].sort((a, b) => b.avgScore - a.avgScore);
    bestPeriod = {
      label: sortedByScore[0].label,
      score: sortedByScore[0].avgScore,
    };
    lowestPeriod = {
      label: sortedByScore[sortedByScore.length - 1].label,
      score: sortedByScore[sortedByScore.length - 1].avgScore,
    };
  }

  const summary: TrendSummary = {
    totalVolume,
    overallAvgScore,
    currentAvgScore,
    previousAvgScore,
    scoreDelta,
    currentVolume,
    previousVolume,
    volumeDelta,
    bestPeriod,
    lowestPeriod,
  };

  return { data, summary };
}
