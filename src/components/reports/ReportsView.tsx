import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { toPersianDigits, toEnglishDigits, formatScoreBadge } from '../../utils/persian.ts';
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
} from 'recharts';

export const ReportsView: React.FC = () => {
  const { assessments, agents, teams, controllers, faults, settings } = useApp();

  const [activeReportTab, setActiveReportTab] = useState<'all_reports' | 'three_month' | 'assessment_report' | 'fault_analytics'>('all_reports');

  // Date Range Filters for "all reports"
  const [startDate, setStartDate] = useState('1403/05/01');
  const [endDate, setEndDate] = useState('1403/07/30');

  // Filtered assessments by date range
  const dateFilteredAudits = useMemo(() => {
    return assessments.filter((a) => {
      const d = toEnglishDigits(a.check_date);
      return d >= startDate && d <= endDate;
    });
  }, [assessments, startDate, endDate]);

  // --- REPORT 1: all reports (Controller Productivity Matrix) ---
  const teamList = useMemo(() => [
    'Technical',
    'Content',
    'General',
    'Vendor Success',
    'NCR',
    'Campaign',
    'Promotion',
  ], []);

  const controllerMatrix = useMemo(() => {
    return controllers.map((ctrl) => {
      const ctrlAudits = dateFilteredAudits.filter((a) => {
        const c = (a.controller_id || '').toLowerCase();
        return c.includes(ctrl.name.toLowerCase()) || c.includes(ctrl.id.toLowerCase());
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
      const target = ctrl.target || 200;
      const progressPercent = Math.min(100, Math.round((totalChecked / target) * 100));

      return {
        ctrl,
        teamCounts,
        totalChecked,
        target,
        progressPercent,
      };
    });
  }, [controllers, dateFilteredAudits, teamList, agents]);

  // --- REPORT 2: 3 MONTH (High Quality >= 95 vs Low Quality < 80) ---
  const threeMonthAnalysis = useMemo(() => {
    const highThresh = settings.high_quality_threshold || 95;
    const lowThresh = settings.low_quality_threshold || 80;

    const m05 = assessments.filter((a) => toEnglishDigits(a.check_date).includes('/05/') || a.check_date.includes('۰۵'));
    const m06 = assessments.filter((a) => toEnglishDigits(a.check_date).includes('/06/') || a.check_date.includes('۰۶'));
    const m07 = assessments.filter((a) => toEnglishDigits(a.check_date).includes('/07/') || a.check_date.includes('۰۷'));

    const agentAverages = agents.map((ag) => {
      const getAvg = (list: typeof assessments) => {
        const userAudits = list.filter((a) => a.agent_id === ag.id);
        if (userAudits.length === 0) return null;
        const total = userAudits.reduce((acc, curr) => acc + curr.total_score, 0);
        return Math.round((total / userAudits.length) * 10) / 10;
      };

      const scoreM5 = getAvg(m05);
      const scoreM6 = getAvg(m06);
      const scoreM7 = getAvg(m07);

      const allScores = [scoreM5, scoreM6, scoreM7].filter((s): s is number => s !== null);
      const rollingAvg =
        allScores.length > 0
          ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
          : 0;

      return {
        agent: ag,
        scoreM5,
        scoreM6,
        scoreM7,
        rollingAvg,
      };
    });

    const highQuality = agentAverages.filter((item) => item.rollingAvg >= highThresh);
    const lowQuality = agentAverages.filter((item) => item.rollingAvg < lowThresh && item.rollingAvg > 0);

    return { highQuality, lowQuality, agentAverages };
  }, [assessments, agents, settings]);

  // --- REPORT 3: Assessment-Report (Criteria Point Deductions Matrix) ---
  const criteriaDeductions = useMemo(() => {
    const deductionsMap: Record<string, { title: string; lostPoints: number; count: number; team: string }> = {};

    assessments.forEach((audit) => {
      const ag = agents.find((a) => a.id === audit.agent_id);
      const team = ag?.team || 'عمومی';

      if (audit.form_type === 'support' && audit.support_scores) {
        Object.entries(audit.support_scores).forEach(([key, awarded]) => {
          // Standard support items are max 1 to 5 points
          const max = key.includes('main') || key.includes('tone') ? 5 : 1;
          if (awarded < max) {
            const lost = max - awarded;
            if (!deductionsMap[key]) {
              deductionsMap[key] = { title: key, lostPoints: 0, count: 0, team };
            }
            deductionsMap[key].lostPoints += lost;
            deductionsMap[key].count += 1;
          }
        });
      }

      if (audit.form_type === 'sales' && audit.sales_scores) {
        Object.entries(audit.sales_scores).forEach(([key, awarded]) => {
          const max = 5;
          if (awarded < max) {
            const lost = max - awarded;
            if (!deductionsMap[key]) {
              deductionsMap[key] = { title: key, lostPoints: 0, count: 0, team };
            }
            deductionsMap[key].lostPoints += lost;
            deductionsMap[key].count += 1;
          }
        });
      }
    });

    return Object.values(deductionsMap).sort((a, b) => b.lostPoints - a.lostPoints);
  }, [assessments, agents]);

  // --- REPORT 4: Root Cause & Fault Analytics ---
  const faultAnalytics = useMemo(() => {
    const categoryCounts: Record<string, number> = {
      'Snappfood problem': 0,
      'Vendor problem': 0,
      'Policy problem': 0,
      'Process problem': 0,
      'Support problem': 0,
      'Other teams': 0,
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

    const categoryChartData = Object.entries(categoryCounts).map(([name, count]) => ({
      name,
      تعداد: count,
    }));

    return { categoryChartData, backendGeneralCount, fraudCount };
  }, [assessments]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
            منطبق با تب‌های اصلی شیت کنترل کیفیت اسنپ‌فود: ماتریس کنترلرها (`all reports`)، گزارش ۳ ماهه (`3 MONTH`)، افت نمرات معیارها و تحلیل ریشه‌ای خطاها
          </p>
        </div>
      </div>

      {/* 2. Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveReportTab('all_reports')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeReportTab === 'all_reports'
              ? 'bg-sky-600 text-white shadow-xs font-bold'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>ماتریس بهره‌وری کنترلرها (All Reports Tab)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('three_month')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeReportTab === 'three_month'
              ? 'bg-sky-600 text-white shadow-xs font-bold'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>گزارش ۳ ماهه High / Low Quality (3 MONTH Tab)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('assessment_report')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeReportTab === 'assessment_report'
              ? 'bg-sky-600 text-white shadow-xs font-bold'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>ماتریس افت نمرات معیارها (Assessment-Report)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('fault_analytics')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeReportTab === 'fault_analytics'
              ? 'bg-sky-600 text-white shadow-xs font-bold'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>تحلیل ریشه‌ای خطاها (Root Cause & Faults)</span>
        </button>
      </div>

      {/* --- TAB 1: ALL REPORTS (CONTROLLER MATRIX) --- */}
      {activeReportTab === 'all_reports' && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                ماتریس تعداد سمپل‌های بررسی‌شده کنترلرها به تفکیک تیم‌ها (QA Controller Matrix)
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
                    <th key={tm} className="py-2.5 px-3 text-center">{tm}</th>
                  ))}
                  <th className="py-2.5 px-3 text-center font-bold">مجموع بررسی</th>
                  <th className="py-2.5 px-3 text-center">تارگت ماهانه</th>
                  <th className="py-2.5 px-3 text-center">درصد پوشش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-sans">
                {controllerMatrix.map((item) => (
                  <tr key={item.ctrl.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition">
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">
                      {item.ctrl.display_name || item.ctrl.name}
                    </td>
                    {teamList.map((tm) => (
                      <td key={tm} className="py-3 px-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
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
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
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
      {activeReportTab === 'three_month' && (
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
                      <th className="py-2 px-2 text-center">مرداد</th>
                      <th className="py-2 px-2 text-center">شهریور</th>
                      <th className="py-2 px-2 text-center">مهر</th>
                      <th className="py-2 px-2 text-center font-bold">معدل ۳ ماهه</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50 dark:divide-emerald-900/30 font-sans">
                    {threeMonthAnalysis.highQuality.map((item) => (
                      <tr key={item.agent.id} className="hover:bg-emerald-50/40 transition">
                        <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-100">
                          {item.agent.name}
                        </td>
                        <td className="py-2.5 px-2 text-slate-500">{item.agent.team}</td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM5 !== null ? toPersianDigits(item.scoreM5) : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM6 !== null ? toPersianDigits(item.scoreM6) : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM7 !== null ? toPersianDigits(item.scoreM7) : '-'}
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
                    کارشناسان نیازمند کوچینگ (Low Quality &lt; ۸۰)
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
                      <th className="py-2 px-2 text-center">مرداد</th>
                      <th className="py-2 px-2 text-center">شهریور</th>
                      <th className="py-2 px-2 text-center">مهر</th>
                      <th className="py-2 px-2 text-center font-bold">معدل ۳ ماهه</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50 dark:divide-rose-900/30 font-sans">
                    {threeMonthAnalysis.lowQuality.map((item) => (
                      <tr key={item.agent.id} className="hover:bg-rose-50/40 transition">
                        <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-100">
                          {item.agent.name}
                        </td>
                        <td className="py-2.5 px-2 text-slate-500">{item.agent.team}</td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM5 !== null ? toPersianDigits(item.scoreM5) : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM6 !== null ? toPersianDigits(item.scoreM6) : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {item.scoreM7 !== null ? toPersianDigits(item.scoreM7) : '-'}
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
      {activeReportTab === 'assessment_report' && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-xs text-slate-900 dark:text-white">
              ماتریس ریز افت نمرات معیارها (Points Deduction Breakdown)
            </h3>
            <p className="text-[11px] text-slate-400">
              شناسایی معیارهایی که بیشترین کسر امتیاز را در میان کارشناسان ایجاد کرده‌اند جهت تمرکز جلسات بازآموزی
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                  <th className="py-2.5 px-3">رتبه</th>
                  <th className="py-2.5 px-3">معیار یا شناسه رابریک</th>
                  <th className="py-2.5 px-3">تیم بیشتر درگیر</th>
                  <th className="py-2.5 px-3 text-center">تعداد دفعات کسر نمره</th>
                  <th className="py-2.5 px-3 text-center font-bold">مجموع امتیاز کسر شده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-sans">
                {criteriaDeductions.slice(0, 15).map((cd, idx) => (
                  <tr key={cd.title} className="hover:bg-slate-50/70 transition">
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
      {activeReportTab === 'fault_analytics' && (
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
              فراوانی ۶ دسته‌بندی خطاهای پشتیبانی تجاری (Fault Categories Frequency)
            </h4>
            <div className="w-full h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={faultAnalytics.categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Vazirmatn' }} />
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
