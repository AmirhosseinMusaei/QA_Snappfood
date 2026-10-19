import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileQuestion,
  Search,
  ExternalLink,
  ChevronLeft,
  ShieldAlert,
  BarChart2,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { Assessment, RubricCriterion } from '../../types/index.ts';
import {
  toPersianDigits,
  toEnglishDigits,
  formatScoreBadge,
  isWithinDisputeWindow,
  JALALI_MONTHS,
  dateToJalali,
  formatJalaliDate,
} from '../../utils/persian.ts';
import { calculateAgentMonthlyScore } from '../../utils/scoring.ts';
import { DisputeModal } from '../disputes/DisputeModal.tsx';
import { AuditDetailModal } from '../AuditDetailModal.tsx';

export const AgentDashboard: React.FC = () => {
  const {
    currentAgentId,
    agents,
    assessments,
    submitDispute,
    supportRubric,
    salesRubric,
    settings,
  } = useApp();

  const [selectedAudit, setSelectedAudit] = useState<Assessment | null>(null);
  const [disputeTargetAudit, setDisputeTargetAudit] = useState<Assessment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Agent entity
  const agent = agents.find((a) => a.id === currentAgentId) || agents[0];

  // All audits for this agent
  const agentAudits = useMemo(
    () => assessments.filter((a) => a.agent_id === agent?.id),
    [assessments, agent?.id]
  );

  // Dynamically derive current Jalali year and month from assessments
  const { targetYear, targetMonth } = useMemo(() => {
    if (assessments.length > 0) {
      const dates = assessments.map((a) =>
        a.check_date_year && a.check_date_month_num
          ? { year: a.check_date_year, month: a.check_date_month_num }
          : dateToJalali(a.check_date)
      );
      dates.sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month));
      return { targetYear: dates[0].year, targetMonth: dates[0].month };
    }
    const nowJ = dateToJalali(new Date());
    return { targetYear: nowJ.year, targetMonth: nowJ.month };
  }, [assessments]);

  // Current Jalali month audits
  const currentMonthAudits = useMemo(() => {
    const list = agentAudits.filter((a) => {
      const j =
        a.check_date_year && a.check_date_month_num
          ? { year: a.check_date_year, month: a.check_date_month_num }
          : dateToJalali(a.check_date);
      return j.year === targetYear && j.month === targetMonth;
    });
    return list.length > 0 ? list : agentAudits;
  }, [agentAudits, targetYear, targetMonth]);

  const currentMonthScores = currentMonthAudits.map((a) => a.total_score);
  const currentMonthFrauds = currentMonthAudits.filter((a) => a.is_fraud).length;

  const currentMonthAvg = calculateAgentMonthlyScore(
    currentMonthScores,
    currentMonthFrauds
  );

  // 3-Month Rolling Average (derived mathematically from Jalali calendar)
  const threeMonthAudits = useMemo(() => {
    const targetVal = targetYear * 12 + targetMonth;
    const list = agentAudits.filter((a) => {
      const j =
        a.check_date_year && a.check_date_month_num
          ? { year: a.check_date_year, month: a.check_date_month_num }
          : dateToJalali(a.check_date);
      const val = j.year * 12 + j.month;
      return val > targetVal - 3 && val <= targetVal;
    });
    return list.length > 0 ? list : agentAudits;
  }, [agentAudits, targetYear, targetMonth]);

  const threeMonthAvg = useMemo(() => {
    if (threeMonthAudits.length === 0) return currentMonthAvg || 92;
    const scores = threeMonthAudits.map((a) => a.total_score);
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }, [threeMonthAudits, currentMonthAvg]);

  // Target reviews progress
  const targetReviews = agent?.min_monthly_reviews || 40;
  const currentReviewsCount = currentMonthAudits.length;
  const targetPercent = Math.min(100, Math.round((currentReviewsCount / targetReviews) * 100));

  // Team Ranking (dynamically based on current month)
  const teamRank = useMemo(() => {
    const teamAgents = agents.filter((a) => a.team === agent?.team);
    const sorted = teamAgents
      .map((ag) => {
        const audits = assessments.filter((a) => {
          const j =
            a.check_date_year && a.check_date_month_num
              ? { year: a.check_date_year, month: a.check_date_month_num }
              : dateToJalali(a.check_date);
          return a.agent_id === ag.id && j.year === targetYear && j.month === targetMonth;
        });
        const scores = audits.map((a) => a.total_score);
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return { id: ag.id, avg };
      })
      .sort((a, b) => b.avg - a.avg);

    const rankIdx = sorted.findIndex((s) => s.id === agent?.id);
    return rankIdx >= 0 ? rankIdx + 1 : 1;
  }, [agents, assessments, agent?.id, agent?.team, targetYear, targetMonth]);

  // "کجا نمره از دست دادم؟ (Top Point-Losing Criteria)"
  const pointLosingCriteria = useMemo(() => {
    const criteriaLossMap: Record<string, { title: string; lostPoints: number; count: number }> = {};

    agentAudits.forEach((audit) => {
      const rubric = audit.form_type === 'support' ? supportRubric : salesRubric;

      rubric.forEach((sec) => {
        sec.criteria.forEach((crit) => {
          let critLost = 0;
          crit.items.forEach((item) => {
            const scoreObj =
              audit.form_type === 'support' ? audit.support_scores : audit.sales_scores;
            const awarded = scoreObj?.[item.id] !== undefined ? scoreObj[item.id] : item.maxPoints;
            if (awarded < item.maxPoints) {
              critLost += (item.maxPoints - awarded);
            }
          });

          if (critLost > 0) {
            if (!criteriaLossMap[crit.id]) {
              criteriaLossMap[crit.id] = { title: crit.title, lostPoints: 0, count: 0 };
            }
            criteriaLossMap[crit.id].lostPoints += critLost;
            criteriaLossMap[crit.id].count += 1;
          }
        });
      });

      // Sales mistakes points loss
      if (audit.form_type === 'sales' && audit.mistake_count && audit.mistake_count > 0) {
        const mistakeLoss =
          audit.mistake_count === 1
            ? 5
            : audit.mistake_count === 2
            ? 10
            : audit.mistake_count === 3
            ? 15
            : audit.mistake_count === 4
            ? 20
            : 30;

        if (!criteriaLossMap['sales_mistake']) {
          criteriaLossMap['sales_mistake'] = {
            title: 'خطاهای انضباط مکالمه و سکوت (Mistakes)',
            lostPoints: 0,
            count: 0,
          };
        }
        criteriaLossMap['sales_mistake'].lostPoints += mistakeLoss;
        criteriaLossMap['sales_mistake'].count += audit.mistake_count;
      }
    });

    return Object.values(criteriaLossMap)
      .sort((a, b) => b.lostPoints - a.lostPoints)
      .slice(0, 5);
  }, [agentAudits, supportRubric, salesRubric]);

  // Max points lost for horizontal bar percentage
  const maxLost = pointLosingCriteria[0]?.lostPoints || 1;

  // Dynamic 3-Month breakdown for historical quality trend
  const threeMonthBreakdown = useMemo(() => {
    const result = [];
    for (let offset = 2; offset >= 0; offset--) {
      let m = targetMonth - offset;
      let y = targetYear;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      const mName = JALALI_MONTHS[m - 1] || `ماه ${m}`;
      const isCurrent = offset === 0;
      const audits = agentAudits.filter((a) => {
        const j =
          a.check_date_year && a.check_date_month_num
            ? { year: a.check_date_year, month: a.check_date_month_num }
            : dateToJalali(a.check_date);
        return j.year === y && j.month === m;
      });

      const scores = audits.map((a) => a.total_score);
      const frauds = audits.filter((a) => a.is_fraud).length;
      const score =
        scores.length > 0
          ? calculateAgentMonthlyScore(scores, frauds)
          : isCurrent
          ? currentMonthAvg || 92
          : 90;

      result.push({
        month: `${mName} ${toPersianDigits(y)}${isCurrent ? ' (جاری)' : ''}`,
        score,
        count: audits.length,
      });
    }
    return result;
  }, [agentAudits, targetYear, targetMonth, currentMonthAvg]);

  // Filtered table list
  const filteredAudits = useMemo(() => {
    if (!searchQuery) return agentAudits;
    const q = searchQuery.toLowerCase();
    return agentAudits.filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        (a.vendor_title && a.vendor_title.includes(q)) ||
        (a.ticket_number && a.ticket_number.includes(q)) ||
        a.check_date.toLowerCase().includes(q) ||
        (a.check_date_jalali && a.check_date_jalali.includes(q)) ||
        (a.check_date_jalali_plain && a.check_date_jalali_plain.includes(q))
    );
  }, [agentAudits, searchQuery]);

  const scoreBadge = formatScoreBadge(currentMonthAvg);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. PERSONAL KPI HEADER */}
      <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-sky-600/20">
            {agent?.name ? agent.name[0] : 'ک'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {agent?.name}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold font-mono">
                کد سورس: {toPersianDigits(agent?.source_id)}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                رتبه {toPersianDigits(teamRank)} در تیم {agent?.team}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              واحد: {agent?.department === 'support' ? 'پشتیبانی تجاری' : 'فروش و بازاریابی'} · سرپرست تیم: {agent?.team_lead} · کنترلر: {agent?.controller}
            </p>
          </div>
        </div>

        {/* KPI Mini-Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Current Jalali Month Score with Fraud penalty */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-right">
            <div className="text-[11px] text-slate-400">معدل ماه جاری (مهر)</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {toPersianDigits(currentMonthAvg)}
              </span>
              <span className="text-[11px] text-slate-400">/ ۱۰۰</span>
            </div>
            {currentMonthFrauds > 0 && (
              <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                <ShieldAlert className="w-3 h-3" />
                <span>کسر نمره تقلب ماهانه اعمال شد</span>
              </div>
            )}
          </div>

          {/* 3-Month Rolling Average */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-right">
            <div className="text-[11px] text-slate-400">میانگین ۳ ماهه (Rolling)</div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-mono text-2xl font-bold text-sky-600 dark:text-sky-400">
                {toPersianDigits(threeMonthAvg)}
              </span>
              <span className="text-[11px] text-slate-400">/ ۱۰۰</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">مرداد، شهریور، مهر</div>
          </div>

          {/* Quota Progress vs min_monthly_reviews (e.g. 28/40) */}
          <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-right space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">پوشش سهمیه ارزیابی:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {toPersianDigits(currentReviewsCount)} از {toPersianDigits(targetReviews)}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  targetPercent >= 100 ? 'bg-emerald-500' : 'bg-sky-600'
                }`}
                style={{ width: `${targetPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 text-left">
              {toPersianDigits(targetPercent)}٪ محقق شده
            </div>
          </div>
        </div>
      </div>

      {/* 2. "کجا نمره از دست دادم؟ (TOP POINT-LOSING CRITERIA)" & 3-Month Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Horizontal Bar Chart of Points Lost */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800/90 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                کجا نمره از دست دادم؟ (Top Point-Losing Criteria)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">مبتنی بر تمام ارزیابی‌های اخیر</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            معیارهایی که بیشترین کسر امتیاز را در ارزیابی‌های شما داشته‌اند جهت تمرکز روی بهبود و کوچینگ:
          </p>

          <div className="space-y-3.5 pt-2">
            {pointLosingCriteria.length > 0 ? (
              pointLosingCriteria.map((item, idx) => {
                const percent = Math.min(100, Math.round((item.lostPoints / maxLost) * 100));
                return (
                  <div key={item.title} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 flex items-center justify-center font-bold text-[10px]">
                          {toPersianDigits(idx + 1)}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">
                          ({toPersianDigits(item.count)} مرتبه خطا)
                        </span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          - {toPersianDigits(item.lostPoints)} امتیاز
                        </span>
                      </div>
                    </div>

                    {/* Horizontal Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs text-center">
                عملکرد فوق‌العاده! هیچ افت امتیازی در معیارهای اخیر شما ثبت نشده است.
              </div>
            )}
          </div>
        </div>

        {/* 3-Month Trend Sparkline & Breakdown */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800/90 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-600" />
              <span>روند تاریخی کیفیت (۳ ماه اخیر)</span>
            </h3>
            <span className="text-[11px] text-slate-400">Jalali Trend</span>
          </div>

          <div className="space-y-4 pt-2">
            {threeMonthBreakdown.map((m) => (
              <div key={m.month} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{m.month}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {toPersianDigits(m.count)} ارزیابی بررسی‌شده
                  </div>
                </div>

                <div className="text-left font-mono font-bold">
                  <span className={`px-2.5 py-1 rounded-xl text-sm ${formatScoreBadge(m.score).badgeClass}`}>
                    {toPersianDigits(m.score)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. ASSESSMENT HISTORY TABLE WITH DETAILED DRAWER */}
      <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              سوابق و تاریخچه ارزیابی‌های من (Assessment History)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              با کلیک روی هر ردیف، جزئیات معیارهای کسر شده، کامنت کنترلر و فایل صوتی را مشاهده و در صورت تمایل اعتراض ثبت کنید.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو وندور، تیکت، تاریخ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pr-8 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
                <th className="py-2.5 px-3">شناسه ارزیابی</th>
                <th className="py-2.5 px-3">تاریخ بررسی</th>
                <th className="py-2.5 px-3">وندور / شماره</th>
                <th className="py-2.5 px-3">کنترلر</th>
                <th className="py-2.5 px-3">نتیجه</th>
                <th className="py-2.5 px-3">نمره</th>
                <th className="py-2.5 px-3">وضعیت اعتراض</th>
                <th className="py-2.5 px-3 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredAudits.map((item) => {
                const badge = formatScoreBadge(item.total_score);
                const canDispute = isWithinDisputeWindow(item.created_at, settings?.dispute_window_days ?? 3);
                const dispute = item.dispute;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition cursor-pointer"
                    onClick={() => setSelectedAudit(item)}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {item.id}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono">
                      {item.check_date_jalali || formatJalaliDate(item.check_date)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.vendor_title || `وندور ${item.vendor_id}`}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.ticket_number || item.phone_number || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                      {item.controller_id}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                          item.result === 'No problem'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : item.result === 'Need to check'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                      >
                        {item.result}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-mono font-bold px-2 py-0.5 rounded ${badge.badgeClass}`}>
                        {toPersianDigits(item.total_score)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {dispute ? (
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            dispute.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                              : dispute.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {dispute.status === 'pending'
                            ? 'در انتظار بررسی'
                            : dispute.status === 'resolved'
                            ? `اصلاح شد (${toPersianDigits(dispute.revised_score)})`
                            : 'رد شد'}
                        </span>
                      ) : canDispute ? (
                        <span className="text-[11px] text-sky-600 dark:text-sky-400">
                          امکان اعتراض دارد (مهلت ۳ روز)
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          منقضی شده (&gt; ۳ روز)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-left" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedAudit(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-xs transition"
                        >
                          مشاهده
                        </button>

                        {!dispute && canDispute && (
                          <button
                            type="button"
                            onClick={() => setDisputeTargetAudit(item)}
                            className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100 border border-sky-200 dark:border-sky-800 text-xs font-semibold transition"
                          >
                            ثبت اعتراض
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail Modal / Drawer with lost points highlighted in soft red */}
      {selectedAudit && (
        <AuditDetailModal
          assessment={selectedAudit}
          onClose={() => setSelectedAudit(null)}
        />
      )}

      {/* Dispute Modal with criterion selector */}
      {disputeTargetAudit && (
        <DisputeModal
          assessment={disputeTargetAudit}
          onClose={() => setDisputeTargetAudit(null)}
          onSubmit={(comment, critId, critTitle) => {
            submitDispute(
              disputeTargetAudit.id,
              critId || 'general',
              critTitle || 'کل ارزیابی',
              comment
            );
            setDisputeTargetAudit(null);
          }}
        />
      )}
    </div>
  );
};
