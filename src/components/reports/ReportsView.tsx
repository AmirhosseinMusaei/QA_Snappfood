import { useDashboardData } from "../../context/useDashboardData.ts";
import { useServerCollection } from "../../context/useServerPage.ts";
import { DataState } from "../shared/DataState.tsx";
import { downloadCsv } from "../../utils/downloadTable.ts";
import type { Assessment } from "../../types/index.ts";
import React, { useState, useMemo } from "react";
import {
  BarChart3,
  Award,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Download,
  Calendar,
  Layers,
  PieChart as PieIcon,
  CheckCircle2,
  Filter,
  ShieldAlert,
  ChevronDown,
  Users,
} from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";
import {
  toPersianDigits,
  toEnglishDigits,
  formatScoreBadge,
  dateToJalali,
  formatJalaliDate,
  JALALI_MONTHS,
} from "../../utils/persian.ts";
import { exportReportToExcel } from "../../utils/exportExcel.ts";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";

export const ReportsView: React.FC = () => {
  const {
    assessments: changes,
    agents,
    teams,
    controllers,
    faults,
    settings,
  } = useApp();

  const [activeReportTab, setActiveReportTab] = useState<
    "all_reports" | "three_month" | "assessment_report" | "fault_analytics"
  >("all_reports");

  // Date Range Filters for "all reports"
  const [startDate, setStartDate] = useState(
    () => dateToJalali(new Date()).jalaliStr.slice(0, 8) + "01",
  );
  const [endDate, setEndDate] = useState(
    () => dateToJalali(new Date()).jalaliStr,
  );

  const dashboard = useDashboardData();
  const dates = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  }).toString();
  const dateResource = useServerCollection<Assessment>(
    "/api/assessments",
    dates,
    changes,
  );
  const dateFilteredAudits = dateResource.rows;
  const assessments = dashboard.assessments;

  // --- REPORT 1: all reports (Controller Productivity Matrix) ---
  const teamList = useMemo(() => teams.map((t) => t.name), [teams]);

  const controllerMatrix = useMemo(() => {
    return controllers.map((ctrl) => {
      const ctrlAudits = dateFilteredAudits.filter((a) => {
        return a.controller_id === ctrl.id;
      });

      const teamCounts: Record<string, number> = {};
      teamList.forEach((tm) => {
        const count = ctrlAudits.filter((a) => {
          const ag = agents.find((item) => item.id === a.agent_id);
          return ag?.team === tm;
        }).length;
        teamCounts[tm] = count;
      });

      const totalChecked = ctrlAudits.length;
      const target = ctrl.target || settings.controller_monthly_target || 200;
      const progressPercent = Math.min(
        100,
        Math.round((totalChecked / target) * 100),
      );

      return {
        ctrl,
        teamCounts,
        totalChecked,
        target,
        progressPercent,
      };
    });
  }, [controllers, dateFilteredAudits, teamList, agents, settings]);

  // --- REPORT 2: 3 MONTH (High Quality >= 95 vs Low Quality < 80) ---
  const threeMonthAnalysis = useMemo(() => {
    const highThresh = settings.high_quality_threshold ?? 90;
    const lowThresh = settings.low_quality_threshold ?? 70;

    const { targetYear, targetMonth } = dashboard;

    const m3M = targetMonth;
    const m3Y = targetYear;
    const m2M = ((m3M - 2 + 12) % 12) + 1;
    const m2Y = m3M - 1 <= 0 ? m3Y - 1 : m3Y;
    const m1M = ((m3M - 3 + 12) % 12) + 1;
    const m1Y = m3M - 2 <= 0 ? m3Y - 1 : m3Y;

    const m1Name = JALALI_MONTHS[m1M - 1] || `ماه ${m1M}`;
    const m2Name = JALALI_MONTHS[m2M - 1] || `ماه ${m2M}`;
    const m3Name = JALALI_MONTHS[m3M - 1] || `ماه ${m3M}`;

    const m1Audits = assessments.filter((a) => {
      const j =
        a.check_date_year && a.check_date_month_num
          ? { year: a.check_date_year, month: a.check_date_month_num }
          : dateToJalali(a.check_date);
      return j.year === m1Y && j.month === m1M;
    });
    const m2Audits = assessments.filter((a) => {
      const j =
        a.check_date_year && a.check_date_month_num
          ? { year: a.check_date_year, month: a.check_date_month_num }
          : dateToJalali(a.check_date);
      return j.year === m2Y && j.month === m2M;
    });
    const m3Audits = assessments.filter((a) => {
      const j =
        a.check_date_year && a.check_date_month_num
          ? { year: a.check_date_year, month: a.check_date_month_num }
          : dateToJalali(a.check_date);
      return j.year === m3Y && j.month === m3M;
    });

    const agentAverages = agents.map((ag) => {
      const scoreM1 = dashboard.score(ag.id, 2);
      const scoreM2 = dashboard.score(ag.id, 1);
      const scoreM3 = dashboard.score(ag.id);
      const allScores = [scoreM1, scoreM2, scoreM3].filter(
        (s): s is number => s !== null,
      );
      const rollingAvg =
        allScores.length > 0
          ? Math.round(
              (allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10,
            ) / 10
          : 0;

      return {
        agent: ag,
        scoreM1,
        scoreM2,
        scoreM3,
        rollingAvg,
      };
    });

    const highQuality = agentAverages
      .filter((item) => item.rollingAvg >= highThresh)
      .sort((a, b) => b.rollingAvg - a.rollingAvg);

    const lowQuality = agentAverages
      .filter(
        (item) =>
          item.rollingAvg < lowThresh &&
          [item.scoreM1, item.scoreM2, item.scoreM3].some((s) => s !== null),
      )
      .sort((a, b) => a.rollingAvg - b.rollingAvg);

    return { highQuality, lowQuality, agentAverages, m1Name, m2Name, m3Name };
  }, [assessments, agents, settings, dashboard.reports]);

  // --- REPORT 3: Assessment-Report (Criteria Point Deductions Matrix) ---
  const criteriaDeductions = useMemo(() => {
    const deductionsMap: Record<
      string,
      { title: string; lostPoints: number; count: number; team: string }
    > = {};

    assessments.forEach((audit) => {
      const ag = agents.find((a) => a.id === audit.agent_id);
      const team = ag?.team || "عمومی";

      if (audit.legacy_aggregate || !audit.rubric) return;
      const scores =
        audit.form_type === "sales" ? audit.sales_scores : audit.support_scores;
      for (const section of audit.rubric)
        for (const criterion of section.criteria)
          for (const item of criterion.items) {
            const awarded = scores?.[item.id];
            if (awarded === undefined) continue;
            const lost = item.maxPoints - awarded;
            if (lost <= 0) continue;
            const key = `${audit.form_id}:${item.id}:${team}`;
            if (!deductionsMap[key])
              deductionsMap[key] = {
                title: `${criterion.title} / ${item.title} (v${audit.form_version})`,
                lostPoints: 0,
                count: 0,
                team,
              };
            deductionsMap[key].lostPoints += lost;
            deductionsMap[key].count++;
          }
    });

    return Object.values(deductionsMap).sort(
      (a, b) => b.lostPoints - a.lostPoints,
    );
  }, [assessments, agents]);

  // --- REPORT 4: Root Cause & Fault Analytics ---
  const faultAnalytics = useMemo(() => {
    const categoryCounts: Record<string, number> = {
      "Snappfood problem": 0,
      "Vendor problem": 0,
      "Policy problem": 0,
      "Process problem": 0,
      "Support problem": 0,
      "Other teams": 0,
    };

    let backendGeneralCount = 0;
    let fraudCount = 0;

    assessments.forEach((a) => {
      if (a.backend_general) backendGeneralCount++;
      if (a.is_fraud) fraudCount++;
      if (a.fault_categories) {
        a.fault_categories.forEach((cat) => {
          if (categoryCounts[cat] !== undefined) {
            categoryCounts[cat]++;
          }
        });
      }
    });

    const categoryChartData = Object.entries(categoryCounts).map(
      ([name, count]) => ({
        name,
        تعداد: count,
      }),
    );

    return { categoryChartData, backendGeneralCount, fraudCount };
  }, [assessments]);

  // Export handlers for Reports (Excel and CSV)
  const handleExportExcel = async () => {
    try {
      if (activeReportTab === "all_reports") {
        const headers = [
          "کنترلر کیفیت",
          ...teamList,
          "مجموع بررسی",
          "تارگت ماهانه",
          "درصد تحقق",
        ];
        const rows = controllerMatrix.map((item) => [
          item.ctrl.display_name,
          ...teamList.map((tm) => item.teamCounts[tm] || 0),
          item.totalChecked,
          item.target,
          `${item.progressPercent}%`,
        ]);
        await exportReportToExcel(
          "ماتریس تعداد سمپل‌های بررسی‌شده کنترلرها به تفکیک تیم‌ها",
          headers,
          rows,
          "snappfood_controller_matrix.xlsx",
        );
      } else if (activeReportTab === "three_month") {
        const headers = [
          "کارشناس",
          "تیم",
          "وضعیت کیفی",
          threeMonthAnalysis.m1Name,
          threeMonthAnalysis.m2Name,
          threeMonthAnalysis.m3Name,
          "معدل ۳ ماهه",
        ];
        const rows: (string | number)[][] = [];
        threeMonthAnalysis.highQuality.forEach((item) => {
          rows.push([
            item.agent.name,
            item.agent.team,
            "عالی (High Quality)",
            item.scoreM1 ?? "-",
            item.scoreM2 ?? "-",
            item.scoreM3 ?? "-",
            item.rollingAvg,
          ]);
        });
        threeMonthAnalysis.lowQuality.forEach((item) => {
          rows.push([
            item.agent.name,
            item.agent.team,
            "نیازمند بهبود (Low Quality)",
            item.scoreM1 ?? "-",
            item.scoreM2 ?? "-",
            item.scoreM3 ?? "-",
            item.rollingAvg,
          ]);
        });
        await exportReportToExcel(
          "گزارش عملکرد ۳ ماهه کارشناسان (High/Low Quality)",
          headers,
          rows,
          "snappfood_3month_quality_report.xlsx",
        );
      } else if (activeReportTab === "assessment_report") {
        const headers = [
          "معیار / آیتم ارزیابی",
          "تیم",
          "تعداد دفعات کسر نمره",
          "مجموع نمره از دست رفته",
        ];
        const rows = criteriaDeductions.map((item) => [
          item.title,
          item.team,
          item.count,
          item.lostPoints,
        ]);
        await exportReportToExcel(
          "ماتریس افت نمرات و خطاهای پرتکرار معیارها",
          headers,
          rows,
          "snappfood_criteria_deductions.xlsx",
        );
      } else {
        const headers = ["دسته ریشه‌ای خطا", "تعداد موارد"];
        const rows = faultAnalytics.categoryChartData.map((item) => [
          item.name,
          item.تعداد,
        ]);
        await exportReportToExcel(
          "تحلیل ریشه‌ای خطاها و عدم انطباق‌های عملیاتی",
          headers,
          rows,
          "snappfood_root_cause_faults.xlsx",
        );
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "دریافت خروجی ناموفق بود");
    }
  };

  const handleExportCsv = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let title = "report";

    if (activeReportTab === "all_reports") {
      title = "controller_matrix";
      headers = [
        "کنترلر کیفیت",
        ...teamList,
        "مجموع بررسی",
        "تارگت ماهانه",
        "درصد تحقق",
      ];
      rows = controllerMatrix.map((item) => [
        item.ctrl.display_name,
        ...teamList.map((tm) => item.teamCounts[tm] || 0),
        item.totalChecked,
        item.target,
        `${item.progressPercent}%`,
      ]);
    } else if (activeReportTab === "three_month") {
      title = "three_month_report";
      headers = [
        "کارشناس",
        "تیم",
        "وضعیت کیفی",
        threeMonthAnalysis.m1Name,
        threeMonthAnalysis.m2Name,
        threeMonthAnalysis.m3Name,
        "معدل ۳ ماهه",
      ];
      threeMonthAnalysis.highQuality.forEach((item) => {
        rows.push([
          item.agent.name,
          item.agent.team,
          "عالی (High Quality)",
          item.scoreM1 ?? "-",
          item.scoreM2 ?? "-",
          item.scoreM3 ?? "-",
          item.rollingAvg,
        ]);
      });
      threeMonthAnalysis.lowQuality.forEach((item) => {
        rows.push([
          item.agent.name,
          item.agent.team,
          "نیازمند بهبود (Low Quality)",
          item.scoreM1 ?? "-",
          item.scoreM2 ?? "-",
          item.scoreM3 ?? "-",
          item.rollingAvg,
        ]);
      });
    } else if (activeReportTab === "assessment_report") {
      title = "criteria_deductions";
      headers = [
        "معیار / آیتم ارزیابی",
        "تیم",
        "تعداد دفعات کسر نمره",
        "مجموع نمره از دست رفته",
      ];
      rows = criteriaDeductions.map((item) => [
        item.title,
        item.team,
        item.count,
        item.lostPoints,
      ]);
    } else {
      title = "fault_analytics";
      headers = ["دسته ریشه‌ای خطا", "تعداد موارد"];
      rows = faultAnalytics.categoryChartData.map((item) => [
        item.name,
        item.تعداد,
      ]);
    }

    downloadCsv(headers, rows, `snappfood_${title}_${Date.now()}.csv`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <DataState
        loading={dashboard.loading || dateResource.loading}
        error={dashboard.error || dateResource.error}
      />
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              گزارش‌های جامع مدیریتی (Executive Reports Suite)
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-semibold">
              شیت‌های تحلیلی و ماتریس‌های عملکرد
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            منطبق با تب‌های اصلی شیت کنترل کیفیت اسنپ‌فود: ماتریس کنترلرها (`all
            reports`)، گزارش ۳ ماهه (`3 MONTH`)، افت نمرات معیارها و تحلیل
            ریشه‌ای خطاها
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
            title="خروجی فایل اکسل (.xlsx) منطبق بر این تب گزارش"
          >
            <Download className="w-4 h-4" />
            <span>خروجی اکسل (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-semibold transition"
            title="خروجی فایل متنی CSV"
          >
            <Download className="w-4 h-4" />
            <span>خروجی CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveReportTab("all_reports")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeReportTab === "all_reports"
              ? "bg-sky-600 text-white shadow-xs font-bold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>ماتریس بهره‌وری کنترلرها (All Reports Tab)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab("three_month")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeReportTab === "three_month"
              ? "bg-sky-600 text-white shadow-xs font-bold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>گزارش ۳ ماهه High / Low Quality (3 MONTH Tab)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab("assessment_report")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeReportTab === "assessment_report"
              ? "bg-sky-600 text-white shadow-xs font-bold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>ماتریس افت نمرات معیارها (Assessment-Report)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab("fault_analytics")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeReportTab === "fault_analytics"
              ? "bg-sky-600 text-white shadow-xs font-bold"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>تحلیل ریشه‌ای خطاها (Root Cause & Faults)</span>
        </button>
      </div>

      {/* --- TAB 1: ALL REPORTS (CONTROLLER MATRIX) --- */}
      {activeReportTab === "all_reports" && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                ماتریس تعداد سمپل‌های بررسی‌شده کنترلرها به تفکیک تیم‌ها (QA
                Controller Matrix)
              </h3>
              <p className="text-[11px] text-slate-400">
                پوشش بررسی تماس‌های هر تیم توسط کنترلرها در بازه زمانی انتخابی
              </p>
            </div>

            {/* Jalali Date Range Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">از تاریخ:</span>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-24 p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 font-mono text-center"
              />
              <span className="text-slate-400">تا تاریخ:</span>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-24 p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 font-mono text-center"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium bg-slate-50/50 dark:bg-slate-750/50">
                  <th className="py-2.5 px-3">کنترلر کیفیت (QA)</th>
                  {teamList.map((tm) => (
                    <th key={tm} className="py-2.5 px-3 text-center">
                      {tm}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-center font-bold">
                    مجموع بررسی
                  </th>
                  <th className="py-2.5 px-3 text-center">تارگت ماهانه</th>
                  <th className="py-2.5 px-3 text-center">درصد پوشش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-sans">
                {controllerMatrix.map((item) => (
                  <tr
                    key={item.ctrl.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition"
                  >
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">
                      {item.ctrl.display_name || item.ctrl.name}
                    </td>
                    {teamList.map((tm) => (
                      <td
                        key={tm}
                        className="py-3 px-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {toPersianDigits(item.teamCounts[tm] || 0)}
                      </td>
                    ))}
                    <td className="py-3 px-3 text-center font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20">
                      {toPersianDigits(item.totalChecked)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-500">
                      {toPersianDigits(item.target)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                          item.progressPercent >= 100
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        ٪{toPersianDigits(item.progressPercent)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 2: 3 MONTH (HIGH QUALITY VS LOW QUALITY) --- */}
      {activeReportTab === "three_month" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* High Quality Table (>= 95) */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-emerald-200 dark:border-emerald-800/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-xs text-emerald-950 dark:text-emerald-100">
                    کارشناسان عالی (High Quality &ge; ۹۵)
                  </h3>
                </div>
                <span className="font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded text-xs">
                  {toPersianDigits(threeMonthAnalysis.highQuality.length)} نفر
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-emerald-100 dark:border-emerald-800/60 text-slate-400">
                      <th className="py-2 px-2">کارشناس</th>
                      <th className="py-2 px-2">تیم</th>
                      <th className="py-2 px-2 text-center">
                        {threeMonthAnalysis.m1Name}
                      </th>
                      <th className="py-2 px-2 text-center">
                        {threeMonthAnalysis.m2Name}
                      </th>
                      <th className="py-2 px-2 text-center">
                        {threeMonthAnalysis.m3Name}
                      </th>
                      <th className="py-2 px-2 text-center font-bold">
                        معدل ۳ ماهه
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50 dark:divide-emerald-900/30 font-sans">
                    {threeMonthAnalysis.highQuality.map((item) => (
                      <tr
                        key={item.agent.id}
                        className="hover:bg-emerald-50/40 transition"
                      >
                        <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-100">
                          {item.agent.name}
                        </td>
                        <td className="py-2.5 px-2 text-slate-500">
                          {item.agent.team}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM1 !== null
                            ? toPersianDigits(item.scoreM1)
                            : "-"}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM2 !== null
                            ? toPersianDigits(item.scoreM2)
                            : "-"}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM3 !== null
                            ? toPersianDigits(item.scoreM3)
                            : "-"}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {toPersianDigits(item.rollingAvg)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Low Quality Table (< 80) */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-rose-200 dark:border-rose-800/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h3 className="font-bold text-xs text-rose-950 dark:text-rose-100">
                    کارشناسان نیازمند کوچینگ (Low Quality &lt;{" "}
                    {toPersianDigits(settings?.low_quality_threshold ?? 80)})
                  </h3>
                </div>
                <span className="font-mono font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded text-xs">
                  {toPersianDigits(threeMonthAnalysis.lowQuality.length)} نفر
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-rose-100 dark:border-rose-800/60 text-slate-400">
                      <th className="py-2 px-2">کارشناس</th>
                      <th className="py-2 px-2">تیم</th>
                      <th className="py-2 px-2 text-center">
                        {threeMonthAnalysis.m1Name}
                      </th>
                      <th className="py-2 px-2 text-center">
                        {threeMonthAnalysis.m2Name}
                      </th>
                      <th className="py-2 px-2 text-center">
                        {threeMonthAnalysis.m3Name}
                      </th>
                      <th className="py-2 px-2 text-center font-bold">
                        معدل ۳ ماهه
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50 dark:divide-rose-900/30 font-sans">
                    {threeMonthAnalysis.lowQuality.map((item) => (
                      <tr
                        key={item.agent.id}
                        className="hover:bg-rose-50/40 transition"
                      >
                        <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-100">
                          {item.agent.name}
                        </td>
                        <td className="py-2.5 px-2 text-slate-500">
                          {item.agent.team}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM1 !== null
                            ? toPersianDigits(item.scoreM1)
                            : "-"}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM2 !== null
                            ? toPersianDigits(item.scoreM2)
                            : "-"}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM3 !== null
                            ? toPersianDigits(item.scoreM3)
                            : "-"}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                          {toPersianDigits(item.rollingAvg)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: ASSESSMENT-REPORT (CRITERIA POINT DEDUCTIONS) --- */}
      {activeReportTab === "assessment_report" && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">
              ماتریس ریز افت نمرات معیارها (Points Deduction Breakdown)
            </h3>
            <p className="text-[11px] text-slate-400">
              شناسایی معیارهایی که بیشترین کسر امتیاز را در میان کارشناسان ایجاد
              کرده‌اند جهت تمرکز جلسات بازآموزی
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                  <th className="py-2.5 px-3">رتبه</th>
                  <th className="py-2.5 px-3">معیار یا شناسه رابریک</th>
                  <th className="py-2.5 px-3">تیم بیشتر درگیر</th>
                  <th className="py-2.5 px-3 text-center">
                    تعداد دفعات کسر نمره
                  </th>
                  <th className="py-2.5 px-3 text-center font-bold">
                    مجموع امتیاز کسر شده
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-sans">
                {criteriaDeductions.slice(0, 15).map((cd, idx) => (
                  <tr
                    key={cd.title}
                    className="hover:bg-slate-50/70 transition"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-slate-400">
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">
                      {cd.title}
                    </td>
                    <td className="py-3 px-3 text-slate-500">{cd.team}</td>
                    <td className="py-3 px-3 text-center font-mono">
                      {toPersianDigits(cd.count)} بار
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                      -{toPersianDigits(cd.lostPoints)} امتیاز
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 4: ROOT CAUSE & FAULTS ANALYTICS --- */}
      {activeReportTab === "fault_analytics" && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/30 dark:bg-sky-950/20 flex items-center justify-between">
              <div>
                <span className="text-xs text-sky-800 dark:text-sky-300 font-bold block">
                  خطاهای فنی سیستم (Backend General)
                </span>
                <span className="text-[11px] text-slate-400">
                  خطاهایی که ناشی از باگ سیستم بوده و کارشناس جریمه نشده است
                </span>
              </div>
              <span className="text-2xl font-mono font-bold text-sky-600 dark:text-sky-400">
                {toPersianDigits(faultAnalytics.backendGeneralCount)}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20 flex items-center justify-between">
              <div>
                <span className="text-xs text-rose-800 dark:text-rose-300 font-bold block">
                  موارد تقلب و رفتار بحرانی (Fraud Cases)
                </span>
                <span className="text-[11px] text-slate-400">
                  تماس‌های با نمره صفر و جریمه تقلب ماهانه
                </span>
              </div>
              <span className="text-2xl font-mono font-bold text-rose-600 dark:text-rose-400">
                {toPersianDigits(faultAnalytics.fraudCount)}
              </span>
            </div>
          </div>

          {/* Fault Categories Chart */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-3">
              فراوانی ۶ دسته‌بندی خطاهای پشتیبانی تجاری (Fault Categories
              Frequency)
            </h4>
            <div className="w-full h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={faultAnalytics.categoryChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    opacity={0.2}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fontFamily: "Vazirmatn" }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="تعداد" fill="#0284c7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
