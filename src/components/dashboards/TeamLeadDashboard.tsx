import { useServerCollection } from "../../context/useServerPage.ts";
import {
  useDashboardData,
  meanPresent,
} from "../../context/useDashboardData.ts";
import { DataState } from "../shared/DataState.tsx";
import React, { useState, useMemo } from "react";
import {
  Users,
  Inbox,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  FileCheck,
  ShieldAlert,
  AlertTriangle,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";
import { Assessment, Agent } from "../../types/index.ts";
import {
  toPersianDigits,
  toEnglishDigits,
  formatScoreBadge,
  dateToJalali,
  formatJalaliDate,
  JALALI_MONTHS,
} from "../../utils/persian.ts";
import { calculateAgentMonthlyScore } from "../../utils/scoring.ts";
import { AuditDetailModal } from "../AuditDetailModal.tsx";
import { TeamTrendChart } from "../charts/TeamTrendChart.tsx";

// Mini SVG sparkline for 3-month scores trend
const Sparkline: React.FC<{ scores: number[] }> = ({ scores }) => {
  if (!scores || scores.length === 0)
    return <span className="text-slate-300">-</span>;

  const min = Math.min(...scores, 70);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = scores
    .map((val, idx) => {
      const x = (idx / (scores.length - 1 || 1)) * (width - 8) + 4;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  const isUp = scores[scores.length - 1] >= scores[0];

  return (
    <div
      className="flex items-center gap-1.5"
      title={`روند ۳ ماهه: ${scores.map((s) => toPersianDigits(s)).join(" ← ")}`}
    >
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={isUp ? "#10B981" : "#F43F5E"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {scores.map((val, idx) => {
          const x = (idx / (scores.length - 1 || 1)) * (width - 8) + 4;
          const y = height - ((val - min) / range) * (height - 8) - 4;
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r="2.5"
              className={isUp ? "fill-emerald-500" : "fill-rose-500"}
            />
          );
        })}
      </svg>
      <span
        className={`text-[10px] font-mono font-bold ${isUp ? "text-emerald-600" : "text-rose-600"}`}
      >
        {isUp ? "↑" : "↓"}
      </span>
    </div>
  );
};

export const TeamLeadDashboard: React.FC = () => {
  const {
    activeTab,
    role,
    currentUser,
    currentTeamLeadId,
    teamLeads,
    teams,
    agents,
    assessments: changes,
    markTeamLeadReviewed,
    settings,
  } = useApp();

  const dashboard = useDashboardData();
  const { assessments, targetYear, targetMonth } = dashboard;
  const currentMonthName = JALALI_MONTHS[targetMonth - 1];
  const prev2MonthName = JALALI_MONTHS[(targetMonth + 9) % 12];

  const [activeSubTab, setActiveSubTab] = useState<
    "team_overview" | "need_to_check"
  >(activeTab === "need_to_check" ? "need_to_check" : "team_overview");

  React.useEffect(() => {
    if (activeTab === "need_to_check") {
      setActiveSubTab("need_to_check");
    } else if (activeTab === "team_view") {
      setActiveSubTab("team_overview");
    }
  }, [activeTab]);
  const [selectedAudit, setSelectedAudit] = useState<Assessment | null>(null);
  const [selectedLeadId, setSelectedLeadId] =
    useState<string>(currentTeamLeadId);

  // Review note modal / state
  const [reviewingAuditId, setReviewingAuditId] = useState<string | null>(null);
  const [teamLeadNoteInput, setTeamLeadNoteInput] = useState<string>("");

  const currentLead =
    teamLeads.find(
      (l) => l.id === (role === "team_lead" ? currentUser.id : selectedLeadId),
    ) || (["admin", "qa_supervisor"].includes(role) ? teamLeads[0] : undefined);

  // Team agents supervised by this lead
  const teamAgents = useMemo(
    () => agents.filter((a) => a.team_lead_id === currentLead?.id),
    [agents, currentLead?.id],
  );

  const teamAgentIds = useMemo(() => teamAgents.map((a) => a.id), [teamAgents]);

  // Team assessments
  const teamAssessments = useMemo(
    () => assessments.filter((a) => teamAgentIds.includes(a.agent_id)),
    [assessments, teamAgentIds],
  );

  const inbox = useServerCollection<Assessment>(
    "/api/assessments",
    "result=Need%20to%20check",
    changes,
  );
  const needToCheckAudits = inbox.rows.filter(
    (a) => teamAgentIds.includes(a.agent_id) && !a.team_lead_reviewed,
  );

  // Submitting review with custom note
  const handleSubmitReview = async (id: string) => {
    if (!teamLeadNoteInput.trim()) {
      alert(
        "لطفاً بازخورد و نتیجه بررسی خود را به عنوان سرپرست تیم یادداشت نمایید.",
      );
      return;
    }
    try {
      await markTeamLeadReviewed(id, teamLeadNoteInput.trim());
    } catch {
      return;
    }
    setReviewingAuditId(null);
    setTeamLeadNoteInput("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <DataState
        loading={dashboard.loading || inbox.loading}
        error={dashboard.error || inbox.error}
      />
      {/* 1. Header Banner & Lead Switcher */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              داشبورد سرپرستی: {currentLead?.name || "داشبورد تیم من"}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-semibold">
              سرپرست تیم (Team Lead)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تیم تحت سرپرستی: {currentLead?.team} (
            {currentLead?.department === "support"
              ? "پشتیبانی تجاری"
              : "فروش و بازاریابی"}
            ) · تعداد کارشناسان: {toPersianDigits(teamAgents.length)} نفر
          </p>
        </div>

        {/* Lead Switcher for testing all leads */}
        {["admin", "qa_supervisor"].includes(role) && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">تغییر سرپرست:</label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              className="text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
            >
              {teamLeads.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {tl.name} ({tl.team})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2. Sub Tabs: "وضعیت اعضای تیم (Team Overview)" vs "کارتابل نیازمند بررسی (Need to Check Inbox)" */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("team_overview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeSubTab === "team_overview"
              ? "bg-sky-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>وضعیت اعضای تیم (Team Overview)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("need_to_check")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeSubTab === "need_to_check"
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>کارتابل نیازمند بررسی (`Need to Check` Queue)</span>
          {needToCheckAudits.length > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeSubTab === "need_to_check"
                  ? "bg-white text-amber-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {toPersianDigits(needToCheckAudits.length)}
            </span>
          )}
        </button>
      </div>

      {/* 3. CONTENT AREA */}
      {activeSubTab === "team_overview" ? (
        <div className="space-y-6">
          {/* Trend Chart using Recharts */}
          <TeamTrendChart
            title={`روند عملکرد و حجم ارزیابی‌های تیم ${currentLead?.team}`}
            subtitle={`تحلیل زمانی هفتگی و ماهانه نمرات کیفیت و تعداد ارزیابی‌های ثبت‌شده برای کارشناسان تیم تحت سرپرستی ${currentLead?.name || "داشبورد تیم من"}`}
            assessments={assessments}
            agents={agents}
            filterOptions={{ leadName: currentLead?.name }}
            defaultGranularity="weekly"
          />

          {/* TAB 1: TEAM OVERVIEW TABLE WITH SPARKLINE & FRAUD & WARNINGS */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  پایش عملکرد، سهمیه ارزیابی‌ها و هشدارهای کیفی تیم{" "}
                  {currentLead?.team}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  حداقل ارزیابی هدف: ۴۰ مورد در ماه · شاخص هشدار: نمرات کمتر از
                  ۹۰ با نشان اخطار مشخص شده‌اند.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
                    <th className="py-3 px-3">کارشناس</th>
                    <th className="py-3 px-3">کد سورس</th>
                    <th className="py-3 px-3">
                      نمره ماه جاری ({currentMonthName})
                    </th>
                    <th className="py-3 px-3">
                      پیشرفت سهمیه (هدف{" "}
                      {toPersianDigits(
                        settings?.min_monthly_reviews_default ?? 40,
                      )}
                      )
                    </th>
                    <th className="py-3 px-3">تقلب (Fraud)</th>
                    <th className="py-3 px-3">وضعیت کیفی</th>
                    <th className="py-3 px-3 text-center">
                      روند ۳ ماهه (Trend)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {teamAgents.map((ag) => {
                    const agentAudits = assessments.filter(
                      (a) => a.agent_id === ag.id,
                    );
                    const currentMonthAudits = agentAudits.filter((a) => {
                      const j =
                        a.check_date_year && a.check_date_month_num
                          ? {
                              year: a.check_date_year,
                              month: a.check_date_month_num,
                            }
                          : dateToJalali(a.check_date);
                      return j.year === targetYear && j.month === targetMonth;
                    });
                    const activeAudits = currentMonthAudits;
                    const scores = activeAudits.map((a) => a.total_score);
                    const frauds = activeAudits.filter(
                      (a) => a.is_fraud,
                    ).length;
                    const hasAudits = scores.length > 0;
                    const currentScore = dashboard.score(ag.id);

                    // 3 Month actual history scores:
                    const prev1M = ((targetMonth - 2 + 12) % 12) + 1;
                    const prev1Y =
                      targetMonth - 1 <= 0 ? targetYear - 1 : targetYear;
                    const prev2M = ((targetMonth - 3 + 12) % 12) + 1;
                    const prev2Y =
                      targetMonth - 2 <= 0 ? targetYear - 1 : targetYear;

                    const prev2Scores = agentAudits
                      .filter((a) => {
                        const j =
                          a.check_date_year && a.check_date_month_num
                            ? {
                                year: a.check_date_year,
                                month: a.check_date_month_num,
                              }
                            : dateToJalali(a.check_date);
                        return j.year === prev2Y && j.month === prev2M;
                      })
                      .map((a) => a.total_score);
                    const prev1Scores = agentAudits
                      .filter((a) => {
                        const j =
                          a.check_date_year && a.check_date_month_num
                            ? {
                                year: a.check_date_year,
                                month: a.check_date_month_num,
                              }
                            : dateToJalali(a.check_date);
                        return j.year === prev1Y && j.month === prev1M;
                      })
                      .map((a) => a.total_score);

                    const trendScores = [
                      dashboard.score(ag.id, 2),
                      dashboard.score(ag.id, 1),
                      currentScore,
                    ].filter((n): n is number => n !== null);

                    const targetCount =
                      ag.min_monthly_reviews ||
                      settings?.min_monthly_reviews_default ||
                      40;
                    const currentCount = activeAudits.length;
                    const progress = Math.min(
                      100,
                      Math.round((currentCount / targetCount) * 100),
                    );

                    const badge =
                      currentScore !== null
                        ? formatScoreBadge(currentScore, {
                            high: settings?.high_quality_threshold,
                            low: settings?.low_quality_threshold,
                          })
                        : {
                            badgeClass:
                              "bg-slate-100 dark:bg-slate-800 text-slate-500",
                            text: "فاقد ارزیابی",
                          };
                    const isLowScore =
                      currentScore !== null &&
                      currentScore < (settings?.low_quality_threshold ?? 70);

                    return (
                      <tr
                        key={ag.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition"
                      >
                        {/* Agent Name */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-100">
                            {ag.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            کنترلر: {ag.controller}
                          </div>
                        </td>

                        {/* Source ID */}
                        <td className="py-3.5 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {toPersianDigits(ag.source_id)}
                        </td>

                        {/* Monthly Score */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            {currentScore !== null ? (
                              <span
                                className={`font-mono font-bold px-2.5 py-1 rounded-lg text-xs ${badge.badgeClass}`}
                              >
                                <span
                                  dir="ltr"
                                  className="inline-flex items-center gap-1"
                                >
                                  <span>{toPersianDigits(currentScore)}</span>
                                  <span className="opacity-60">/</span>
                                  <span>۱۰۰</span>
                                </span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                فاقد ارزیابی
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Progress vs Target 40 */}
                        <td className="py-3.5 px-3">
                          <div className="w-36 space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="font-mono font-bold">
                                {toPersianDigits(currentCount)} از{" "}
                                {toPersianDigits(targetCount)}
                              </span>
                              <span className="font-mono text-[10px]">
                                {toPersianDigits(progress)}٪
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  progress >= 100
                                    ? "bg-emerald-500"
                                    : progress >= 50
                                      ? "bg-sky-500"
                                      : "bg-amber-500"
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Fraud Count Badge */}
                        <td className="py-3.5 px-3">
                          {frauds > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold text-[11px]">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>{toPersianDigits(frauds)} تقلب</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">
                              ۰ تقلب (سالم)
                            </span>
                          )}
                        </td>

                        {/* Low-score warning */}
                        <td className="py-3.5 px-3">
                          {isLowScore ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>هشدار: نمره زیر ۹۰</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>استاندارد مطلوب</span>
                            </span>
                          )}
                        </td>

                        {/* 3-Month Trend Sparkline */}
                        <td className="py-3.5 px-3 flex justify-center items-center">
                          <Sparkline scores={trendScores} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: DEDICATED NEED TO CHECK INBOX WITH NOTE SUBMISSION */
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                کارتابل نیازمند بررسی سرپرست تیم (Need to Check Inbox)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ارزیابی‌هایی که توسط QA Controller به عنوان «Need to check»
                نشانه‌گذاری شده‌اند و نیازمند بررسی مکالمه و ثبت فیدبک سرپرست
                هستند.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-lg">
              {toPersianDigits(needToCheckAudits.length)} مورد در انتظار
            </span>
          </div>

          {needToCheckAudits.length > 0 ? (
            <div className="space-y-4">
              {needToCheckAudits.map((audit) => {
                const agent = agents.find((a) => a.id === audit.agent_id);
                const badge = formatScoreBadge(audit.total_score);
                const isReviewing = reviewingAuditId === audit.id;

                return (
                  <div
                    key={audit.id}
                    className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20 space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {agent?.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            (کد {toPersianDigits(agent?.source_id)})
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {audit.vendor_title || `وندور ${audit.vendor_id}`}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            تاریخ:{" "}
                            {audit.check_date_jalali ||
                              formatJalaliDate(audit.check_date)}
                          </span>
                        </div>

                        <div className="text-xs text-amber-900 dark:text-amber-200 font-medium bg-amber-100/60 dark:bg-amber-900/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
                          <strong>کامنت کنترلر ({audit.controller_id}):</strong>{" "}
                          {audit.result_comment ||
                            "توی مکالمه ابهام وجود دارد، نیازمند بررسی توسط سرپرست تیم."}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono font-bold text-xs px-2.5 py-1 rounded ${badge.badgeClass}`}
                        >
                          نمره: {toPersianDigits(audit.total_score)}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedAudit(audit)}
                          className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 transition shadow-2xs"
                        >
                          شنود صوت و جزئیات
                        </button>

                        {role === "team_lead" && !isReviewing && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewingAuditId(audit.id);
                              setTeamLeadNoteInput("");
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>بررسی شد و فیدبک داده شد</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline note editor when reviewing */}
                    {isReviewing && (
                      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 space-y-3">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          یادداشت و نتیجه فیدبک سرپرست تیم (Team Lead Note):
                        </label>
                        <textarea
                          rows={2}
                          value={teamLeadNoteInput}
                          onChange={(e) => setTeamLeadNoteInput(e.target.value)}
                          placeholder="مثلاً: در جلسه ۱:۱ با کارشناس بررسی شد، عدم هماهنگی با وندور ناشی از کمبود آموزش بود و آموزش مجدد داده شد..."
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setReviewingAuditId(null)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium"
                          >
                            انصراف
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitReview(audit.id)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                          >
                            ثبت نهایی و خروج از کارتابل
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p>
                صندوق نیازمند بررسی خالی است! کلیه موارد تیم رسیدگی و بازخورد
                داده شده‌اند.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Audit Detail Modal */}
      {selectedAudit && (
        <AuditDetailModal
          assessment={selectedAudit}
          onClose={() => setSelectedAudit(null)}
        />
      )}
    </div>
  );
};
