import {
  useDashboardData,
  meanPresent,
} from "../../context/useDashboardData.ts";
import { DataState } from "../shared/DataState.tsx";
import { downloadCsv } from "../../utils/downloadTable.ts";
import React, { useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  Layers,
  Award,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Download,
  Calendar,
  Filter,
  Users,
  Target,
  Sparkles,
  Zap,
} from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";
import { DepartmentType, Agent } from "../../types/index.ts";
import {
  toPersianDigits,
  toEnglishDigits,
  formatScoreBadge,
  dateToJalali,
  JALALI_MONTHS,
} from "../../utils/persian.ts";
import { exportMonthlyScoresToExcel } from "../../utils/exportExcel.ts";
import { TeamTrendChart } from "../charts/TeamTrendChart.tsx";

export const ManagerDashboard: React.FC = () => {
  const {
    role,
    currentManagerDept,
    setCurrentManagerDept,
    teams,
    agents,
    faults,
    controllers,
    settings,
  } = useApp();

  const [selectedDept, setSelectedDept] = useState<DepartmentType | "all">(
    currentManagerDept,
  );
  const [timePeriod, setTimePeriod] = useState<
    "current_month" | "three_months"
  >("current_month");
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");

  const dashboard = useDashboardData();
  const { assessments, targetYear, targetMonth } = dashboard;
  const currentMonthName = JALALI_MONTHS[targetMonth - 1];
  const prev2MonthName = JALALI_MONTHS[(targetMonth + 9) % 12];

  // Filter assessments based on derived Jalali period and dept (zero string parsing)
  const periodAssessments = useMemo(() => {
    const targetVal = targetYear * 12 + targetMonth;

    return assessments.filter((a) => {
      const j =
        a.check_date_year && a.check_date_month_num
          ? { year: a.check_date_year, month: a.check_date_month_num }
          : dateToJalali(a.check_date);

      const aVal = j.year * 12 + j.month;

      // Period filter
      if (timePeriod === "current_month") {
        if (aVal !== targetVal) return false;
      } else {
        // 3 months rolling up to target
        if (aVal <= targetVal - 3 || aVal > targetVal) return false;
      }

      // Dept filter
      if (selectedDept !== "all" && a.form_type !== selectedDept) return false;

      return true;
    });
  }, [assessments, timePeriod, selectedDept, targetYear, targetMonth]);

  // Overall Quality Average
  const relevantAgents = agents.filter(
    (a) => selectedDept === "all" || a.department === selectedDept,
  );
  const agentScore = (id: string) =>
    timePeriod === "current_month"
      ? dashboard.score(id)
      : dashboard.rolling(id);
  const overallAvg = meanPresent(relevantAgents.map((a) => agentScore(a.id)));

  // Team benchmark stats
  const deptTeams = useMemo(() => {
    if (selectedDept === "all") return teams;
    return teams.filter((t) => t.department === selectedDept);
  }, [teams, selectedDept]);

  const teamStats = useMemo(() => {
    const minReviewsPerAgent = settings?.min_monthly_reviews_default ?? 40;
    return deptTeams.map((team) => {
      const teamAgentsList = agents.filter((a) => a.team === team.name);
      const teamAgentIds = teamAgentsList.map((a) => a.id);
      const teamAudits = periodAssessments.filter((a) =>
        teamAgentIds.includes(a.agent_id),
      );
      const avg = meanPresent(teamAgentsList.map((a) => agentScore(a.id)));
      const totalTarget =
        teamAgentsList.reduce(
          (n, a) =>
            n + (a.min_monthly_reviews ?? settings.min_monthly_reviews_default),
          0,
        ) * (timePeriod === "three_months" ? 3 : 1);
      const coveragePercent =
        totalTarget > 0
          ? Math.round((teamAudits.length / totalTarget) * 100)
          : 0;

      return {
        team,
        agentCount: teamAgentIds.length,
        auditCount: teamAudits.length,
        avgScore: avg,
        coveragePercent,
      };
    });
  }, [
    deptTeams,
    agents,
    periodAssessments,
    settings,
    dashboard.reports,
    timePeriod,
  ]);

  // Dynamic High Quality vs Low Quality Agent Classification using Settings table
  const { highQualityAgents, lowQualityAgents } = useMemo(() => {
    const highThreshold = settings?.high_quality_threshold ?? 90;
    const lowThreshold = settings?.low_quality_threshold ?? 70;

    const relevantAgents =
      selectedDept === "all"
        ? agents
        : agents.filter((a) => a.department === selectedDept);

    const high: Array<{ agent: Agent; avg: number; auditCount: number }> = [];
    const low: Array<{ agent: Agent; avg: number; auditCount: number }> = [];

    relevantAgents.forEach((ag) => {
      if (selectedTeamFilter !== "all" && ag.team !== selectedTeamFilter)
        return;

      const agentAudits = periodAssessments.filter((a) => a.agent_id === ag.id);
      if (agentAudits.length === 0) return;

      const avg = agentScore(ag.id);
      if (avg === null) return;

      if (avg >= highThreshold) {
        high.push({ agent: ag, avg, auditCount: agentAudits.length });
      } else if (avg < lowThreshold) {
        low.push({ agent: ag, avg, auditCount: agentAudits.length });
      }
    });

    return {
      highQualityAgents: high.sort((a, b) => b.avg - a.avg),
      lowQualityAgents: low.sort((a, b) => a.avg - b.avg),
    };
  }, [
    agents,
    selectedDept,
    selectedTeamFilter,
    periodAssessments,
    settings,
    dashboard.reports,
  ]);

  // Root Cause: Support Fault Categories Distribution
  const supportCategoryStats = useMemo(() => {
    const categories: Record<string, number> = {
      "Snappfood problem": 0,
      "Vendor problem": 0,
      "Policy problem": 0,
      "Process problem": 0,
      "Support problem": 0,
      "Other teams": 0,
    };

    let totalCatCount = 0;

    periodAssessments.forEach((a) => {
      if (a.form_type === "support" && a.fault_categories) {
        a.fault_categories.forEach((cat) => {
          if (categories[cat] !== undefined) {
            categories[cat] += 1;
            totalCatCount += 1;
          }
        });
      }
    });

    const categoryLabels: Record<string, string> = {
      "Snappfood problem": "مشکل داخلی اسنپ‌فود (Snappfood)",
      "Vendor problem": "قصور یا عدم همکاری وندور (Vendor)",
      "Policy problem": "محدودیت یا خط‌مشی قوانین (Policy)",
      "Process problem": "نقص در گردش کار فرایندی (Process)",
      "Support problem": "اشتباه کارشناس پشتیبانی (Support)",
      "Other teams": "ناهماهنگی با سایر تیم‌ها (Other teams)",
    };

    return Object.entries(categories).map(([catKey, count]) => {
      const pct =
        totalCatCount > 0 ? Math.round((count / totalCatCount) * 100) : 0;
      return {
        key: catKey,
        label: categoryLabels[catKey] || catKey,
        count,
        percent: pct,
      };
    });
  }, [periodAssessments]);

  // Frequency of backend_general
  const backendGeneralStats = useMemo(() => {
    const total = periodAssessments.length;
    const bgCount = periodAssessments.filter((a) => a.backend_general).length;
    const pct = total > 0 ? Math.round((bgCount / total) * 100) : 0;
    return { count: bgCount, percent: pct, total };
  }, [periodAssessments]);

  // Faults frequency list
  const faultFrequency = useMemo(() => {
    const map: Record<
      string,
      { title: string; count: number; is_critical: boolean }
    > = {};
    periodAssessments.forEach((a) => {
      if (a.fault_id) {
        const f = faults.find((item) => item.id === a.fault_id);
        const title = f?.title || a.fault_id;
        if (!map[title]) {
          map[title] = {
            title,
            count: 0,
            is_critical: f?.is_critical || false,
          };
        }
        map[title].count += 1;
      }
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [periodAssessments, faults]);

  // QA Controller Productivity
  const controllerProductivity = useMemo(() => {
    const targetMonthly =
      (settings.controller_monthly_target || 200) *
      (timePeriod === "three_months" ? 3 : 1); // Standard monthly target per QA controller

    return controllers.map((ctrl) => {
      const ctrlAudits = periodAssessments.filter(
        (a) => a.controller_id === ctrl.id,
      );
      const supportAudits = ctrlAudits.filter(
        (a) => a.form_type === "support",
      ).length;
      const salesAudits = ctrlAudits.filter(
        (a) => a.form_type === "sales",
      ).length;
      const totalChecked = ctrlAudits.length;
      const pct = Math.min(
        100,
        Math.round((totalChecked / targetMonthly) * 100),
      );

      const scores = ctrlAudits.map((a) => a.total_score);
      const avgScoreChecked =
        scores.length > 0
          ? Math.round(
              (scores.reduce((a, b) => a + b, 0) / scores.length) * 10,
            ) / 10
          : 0;

      return {
        controller: ctrl,
        totalChecked,
        supportAudits,
        salesAudits,
        targetMonthly,
        percent: pct,
        avgScoreChecked,
      };
    });
  }, [controllers, periodAssessments, settings, timePeriod]);

  // CSV Exporter for Quality Lists
  const handleExportQualityList = () => {
    const headers = [
      "دسته کیفی",
      "نام کارشناس",
      "کد سورس",
      "تیم",
      "واحد",
      "میانگین نمره",
      "تعداد ارزیابی",
    ];
    const rows: string[][] = [];

    highQualityAgents.forEach((item) => {
      rows.push([
        "کیفیت عالی (>= 95)",
        item.agent.name,
        item.agent.source_id,
        item.agent.team,
        item.agent.department === "support" ? "پشتیبانی" : "فروش",
        item.avg.toString(),
        item.auditCount.toString(),
      ]);
    });

    lowQualityAgents.forEach((item) => {
      rows.push([
        `نیازمند بهبود (< ${settings.low_quality_threshold})`,
        item.agent.name,
        item.agent.source_id,
        item.agent.team,
        item.agent.department === "support" ? "پشتیبانی" : "فروش",
        item.avg.toString(),
        item.auditCount.toString(),
      ]);
    });

    downloadCsv(
      headers,
      rows,
      `SnappFood_Quality_Classifications_${timePeriod}.csv`,
    );
  };

  // CSV Exporter for QA Productivity
  const handleExportControllerProductivity = () => {
    const headers = [
      "نام کنترلر",
      "ارزیابی پشتیبانی",
      "ارزیابی فروش",
      "مجموع بررسی",
      "هدف ماهانه",
      "درصد تحقق",
      "میانگین نمرات",
    ];
    const rows = controllerProductivity.map((item) => [
      item.controller.display_name,
      item.supportAudits.toString(),
      item.salesAudits.toString(),
      item.totalChecked.toString(),
      item.targetMonthly.toString(),
      `${item.percent}%`,
      item.avgScoreChecked.toString(),
    ]);

    downloadCsv(headers, rows, `SnappFood_QA_Productivity_${timePeriod}.csv`);
  };

  const scoreBadge =
    overallAvg === null
      ? {
          badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-500",
          label: "فاقد ارزیابی",
        }
      : formatScoreBadge(overallAvg, {
          high: settings.high_quality_threshold,
          low: settings.low_quality_threshold,
        });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <DataState loading={dashboard.loading} error={dashboard.error} />
      {/* 1. Header Banner & Filters */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              گزارش‌های مدیریتی و تحلیل عملکرد ۳ ماهه تجاری
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 font-semibold">
              سطح مدیران (Executive Analytics)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تحلیل ریشه‌ای خطاها (Root Cause)، لیست کارشناسان High/Low Quality،
            بهره‌وری کنترلرها و بنچمارک تیم‌ها
          </p>
        </div>

        {/* Period & Department Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTimePeriod("current_month")}
              className={`px-3 py-1.5 rounded-lg transition ${
                timePeriod === "current_month"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              ماه جاری ({currentMonthName})
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod("three_months")}
              className={`px-3 py-1.5 rounded-lg transition ${
                timePeriod === "three_months"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              تحلیل ۳ ماهه ({prev2MonthName} تا {currentMonthName})
            </button>
          </div>

          {/* Department Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              type="button"
              disabled={role === "manager"}
              onClick={() => {
                setSelectedDept("all");
                setCurrentManagerDept("sales");
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedDept === "all"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              همه واحدها
            </button>
            <button
              type="button"
              disabled={role === "manager"}
              onClick={() => {
                setSelectedDept("sales");
                setCurrentManagerDept("sales");
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedDept === "sales"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              فروش (Sales)
            </button>
            <button
              type="button"
              disabled={role === "manager"}
              onClick={() => {
                setSelectedDept("support");
                setCurrentManagerDept("support");
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                selectedDept === "support"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              پشتیبانی (Support)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="text-xs text-slate-400">میانگین کیفیت تجاری کل</div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
              {toPersianDigits(overallAvg ?? "—")}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-semibold ${scoreBadge.badgeClass}`}
            >
              {scoreBadge.label}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            بازه انتخابی:{" "}
            {timePeriod === "current_month" ? "ماه جاری (مهر)" : "۳ ماهه تجاری"}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="text-xs text-slate-400">کل ارزیابی‌های انجام‌شده</div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
              {toPersianDigits(periodAssessments.length)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-semibold">
              پوشش داده
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            تعداد کارشناسان ارزیابی‌شده: {toPersianDigits(agents.length)} نفر
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="text-xs text-slate-400">
            کارشناسان برتر (High Quality)
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {toPersianDigits(highQualityAgents.length)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
              نمره ۹۵ و بالاتر
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            الگوهای انطباق و مهارت
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="text-xs text-slate-400">
            نیازمند اقدام اصلاحی (Low Quality)
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold text-rose-600 dark:text-rose-400">
              {toPersianDigits(lowQualityAgents.length)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold">
              نمره کمتر از ۸۰
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            اولویت اصلی جلسات کوچینگ
          </div>
        </div>
      </div>

      {/* 2.5 TREND CHART: Weekly and Monthly Team & Department Performance Metrics (Recharts) */}
      <TeamTrendChart
        title="روند عملکرد کیفی و حجم ارزیابی‌های تیم‌های تجاری"
        subtitle="تحلیل نمرات میانگین کیفیت و تعداد کل تماس‌های ارزیابی‌شده در دوره‌های هفتگی و ماهانه بر مبنای سوابق تاریخی پایگاه داده"
        assessments={assessments}
        agents={agents}
        showScopeSelector={true}
        availableTeams={[
          "Content",
          "General",
          "Technical",
          "Campaign",
          "Promotion",
          "NCR",
          "Vendor Success",
        ]}
        selectedTeam={selectedTeamFilter}
        onSelectTeam={setSelectedTeamFilter}
        selectedDept={selectedDept}
        onSelectDept={setSelectedDept}
        defaultGranularity="weekly"
      />

      {/* 3. HIGH QUALITY & LOW QUALITY CLASSIFICATION LISTS */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-sky-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                طبقه‌بندی کارشناسان با کیفیت بالا و پایین (High / Low Quality
                Matrix)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              تفکیک خودکار کارشناسان بر مبنای عملکرد در بازه{" "}
              {timePeriod === "current_month" ? "ماه جاری" : "۳ ماهه اخیر"} در
              تیم‌های ۷ گانه
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Team filter dropdown */}
            <select
              value={selectedTeamFilter}
              onChange={(e) => setSelectedTeamFilter(e.target.value)}
              className="text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
            >
              <option value="all">همه تیم‌ها (۷ تیم)</option>
              <option value="Content">Content</option>
              <option value="General">General</option>
              <option value="Technical">Technical</option>
              <option value="Campaign">Campaign</option>
              <option value="Promotion">Promotion</option>
              <option value="NCR">NCR</option>
              <option value="Vendor Success">Vendor Success</option>
            </select>

            <button
              type="button"
              onClick={() =>
                window.location.assign(
                  `/api/export/monthly-scores.xlsx?year=${targetYear}&month=${targetMonth}&form_type=${selectedDept}`,
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold transition"
              title="خروجی فایل اکسل (.xlsx) عملکرد و نمرات ماهانه کارشناسان"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>خروجی اکسل (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleExportQualityList}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-xs font-semibold transition"
            >
              <Download className="w-4 h-4" />
              <span>خروجی CSV</span>
            </button>
          </div>
        </div>

        {/* Split Grid: High Quality (>=95) & Low Quality (<80) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* High Quality Box */}
          <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>کارشناسان عالی (High Quality: نمره ۹۵ تا ۱۰۰)</span>
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                {toPersianDigits(highQualityAgents.length)} نفر
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {highQualityAgents.length > 0 ? (
                highQualityAgents.map((item) => (
                  <div
                    key={item.agent.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs shadow-2xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {item.agent.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        کد سورس: {toPersianDigits(item.agent.source_id)} · تیم:{" "}
                        {item.agent.team}
                      </div>
                    </div>
                    <div className="text-left font-mono font-bold">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {toPersianDigits(item.avg)} / ۱۰۰
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  در این فیلتر موردی یافت نشد.
                </div>
              )}
            </div>
          </div>

          {/* Low Quality Box */}
          <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>کارشناسان نیازمند بهبود (Low Quality: نمره زیر ۸۰)</span>
              </span>
              <span className="text-xs font-mono font-bold text-rose-700 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-full">
                {toPersianDigits(lowQualityAgents.length)} نفر
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {lowQualityAgents.length > 0 ? (
                lowQualityAgents.map((item) => (
                  <div
                    key={item.agent.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/40 flex items-center justify-between text-xs shadow-2xs"
                  >
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {item.agent.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        کد سورس: {toPersianDigits(item.agent.source_id)} · تیم:{" "}
                        {item.agent.team}
                      </div>
                    </div>
                    <div className="text-left font-mono font-bold">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        {toPersianDigits(item.avg)} / ۱۰۰
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  خوشبختانه کارشناسی با نمره زیر ۸۰ در این فیلتر وجود ندارد.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. ROOT CAUSE & FAULT BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Support Fault Categories Distribution */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              <span>
                تحلیل ریشه‌ای خطاها در پشتیبانی تجاری (Fault Categories)
              </span>
            </h3>
            <span className="text-[11px] text-slate-400">
              توزیع درصدی دلایل ریشه‌ای
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {supportCategoryStats.map((item) => (
              <div key={item.key} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {item.label}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {toPersianDigits(item.count)} مورد (
                    {toPersianDigits(item.percent)}٪)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-300"
                    style={{ width: `${Math.max(4, item.percent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Backend General Metric Card */}
          <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                خطای فنی سراسری سامانه (Backend General)
              </span>
              <span className="text-[11px] text-slate-500">
                اختلال زیرساخت سرور و شبکه که منجر به کسر نمره از کارشناس
                نمی‌شود
              </span>
            </div>
            <div className="text-left font-mono font-bold">
              <span className="px-2.5 py-1 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                {toPersianDigits(backendGeneralStats.count)} مورد (
                {toPersianDigits(backendGeneralStats.percent)}٪ از کل)
              </span>
            </div>
          </div>
        </div>

        {/* Common Faults Frequency */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>بیشترین عناوین خطاهای ثبت‌شده (Faults Matrix)</span>
          </h3>

          <div className="space-y-2.5 pt-1 max-h-80 overflow-y-auto pr-1">
            {faultFrequency.length > 0 ? (
              faultFrequency.map((item) => (
                <div
                  key={item.title}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-medium text-slate-800 dark:text-slate-200 block">
                      {item.title}
                    </span>
                    {item.is_critical && (
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                        خطای بحرانی (Zero-Tolerance)
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 shrink-0">
                    {toPersianDigits(item.count)} مرتبه
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-xs text-slate-400 text-center">
                خطایی در این بازه ثبت نشده است.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. QA CONTROLLER PRODUCTIVITY (TABLE & PROGRESS) */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-sky-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                بهره‌وری کنترلرهای کیفیت (QA Controller Productivity)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              مقایسه حجم ارزیابی‌های ثبت‌شده هر کنترلر نسبت به سهمیه ماهانه
              (تارگت: ۱۶۰ ارزیابی)
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportControllerProductivity}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-xs font-semibold transition"
          >
            <Download className="w-4 h-4" />
            <span>خروجی اکسل / CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
                <th className="py-3 px-3">نام کنترلر</th>
                <th className="py-3 px-3">ارزیابی پشتیبانی</th>
                <th className="py-3 px-3">ارزیابی فروش</th>
                <th className="py-3 px-3">مجموع بررسی</th>
                <th className="py-3 px-3">پیشرفت تارگت ماهانه (۱۶۰)</th>
                <th className="py-3 px-3">میانگین نمرات اعطایی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {controllerProductivity.map((item) => (
                <tr
                  key={item.controller.name}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition"
                >
                  <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">
                    {item.controller.display_name} ({item.controller.name})
                  </td>
                  <td className="py-3 px-3 font-mono">
                    {toPersianDigits(item.supportAudits)} مورد
                  </td>
                  <td className="py-3 px-3 font-mono">
                    {toPersianDigits(item.salesAudits)} مورد
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                    {toPersianDigits(item.totalChecked)} مورد
                  </td>
                  <td className="py-3 px-3">
                    <div className="w-40 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono">
                          {toPersianDigits(item.percent)}٪
                        </span>
                        <span className="font-mono">
                          {toPersianDigits(item.totalChecked)} از{" "}
                          {toPersianDigits(item.targetMonthly)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.percent >= 100
                              ? "bg-emerald-500"
                              : item.percent >= 60
                                ? "bg-sky-500"
                                : "bg-amber-500"
                          }`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {toPersianDigits(item.avgScoreChecked)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. TEAM BENCHMARKS TABLE */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          مقایسه عملکرد تیم‌های عملیاتی (Team Benchmarks)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
                <th className="py-2.5 px-3">نام تیم</th>
                <th className="py-2.5 px-3">واحد</th>
                <th className="py-2.5 px-3">سرپرست تیم (Lead)</th>
                <th className="py-2.5 px-3">تعداد کارشناس</th>
                <th className="py-2.5 px-3">حجم ارزیابی</th>
                <th className="py-2.5 px-3">میانگین کیفیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {teamStats.map((item) => {
                const badge =
                  item.avgScore === null
                    ? {
                        badgeClass:
                          "bg-slate-100 dark:bg-slate-800 text-slate-500",
                        label: "فاقد ارزیابی",
                      }
                    : formatScoreBadge(item.avgScore);
                return (
                  <tr
                    key={item.team.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition"
                  >
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">
                      {item.team.name}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {item.team.department === "support" ? "پشتیبانی" : "فروش"}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {item.team.lead_name}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {toPersianDigits(item.agentCount)} نفر
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold">
                      {toPersianDigits(item.auditCount)} ارزیابی
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded ${badge.badgeClass}`}
                      >
                        {toPersianDigits(item.avgScore ?? "—")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
