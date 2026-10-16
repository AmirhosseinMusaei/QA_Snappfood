import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  ExternalLink,
  Store,
  AlertCircle,
  FileText,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { Assessment, DepartmentType, AssessmentResult } from '../types/index.ts';
import { toPersianDigits, formatScoreBadge } from '../utils/persian.ts';
import { AuditDetailModal } from './AuditDetailModal.tsx';

export const AuditsHistory: React.FC = () => {
  const { assessments, agents } = useApp();

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState<'all' | DepartmentType>('all');
  const [filterResult, setFilterResult] = useState<'all' | AssessmentResult>('all');
  const [filterDispute, setFilterDispute] = useState<'all' | 'pending' | 'any'>('all');
  const [selectedAudit, setSelectedAudit] = useState<Assessment | null>(null);

  // Filtered audits
  const filteredAudits = useMemo(() => {
    return assessments.filter((audit) => {
      // Dept filter
      if (filterDept !== 'all' && audit.form_type !== filterDept) return false;

      // Result filter
      if (filterResult !== 'all' && audit.result !== filterResult) return false;

      // Dispute filter
      if (filterDispute === 'pending' && audit.dispute?.status !== 'pending') return false;
      if (filterDispute === 'any' && !audit.dispute) return false;

      // Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const agent = agents.find((a) => a.id === audit.agent_id);
        const agentName = agent?.name.toLowerCase() || '';
        const sourceId = agent?.source_id || '';
        const vendor = (audit.vendor_title || '').toLowerCase();
        const vendorId = audit.vendor_id || '';
        const ticket = (audit.ticket_number || '').toLowerCase();
        const phone = audit.phone_number || '';

        return (
          audit.id.toLowerCase().includes(q) ||
          agentName.includes(q) ||
          sourceId.includes(q) ||
          vendor.includes(q) ||
          vendorId.includes(q) ||
          ticket.includes(q) ||
          phone.includes(q)
        );
      }

      return true;
    });
  }, [assessments, agents, filterDept, filterResult, filterDispute, search]);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'شناسه',
      'کارشناس',
      'کد سورس',
      'تیم',
      'واحد',
      'تاریخ بررسی',
      'شناسه وندور',
      'نام وندور',
      'شماره تیکت/تماس',
      'نمره کل',
      'نتیجه',
      'کنترلر',
    ];

    const rows = filteredAudits.map((a) => {
      const ag = agents.find((item) => item.id === a.agent_id);
      return [
        a.id,
        ag?.name || '',
        ag?.source_id || '',
        ag?.team || '',
        a.form_type === 'support' ? 'پشتیبانی' : 'فروش',
        a.check_date,
        a.vendor_id || '',
        `"${(a.vendor_title || '').replace(/"/g, '""')}"`,
        a.ticket_number || a.phone_number || '',
        a.total_score,
        a.result,
        a.controller_id,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `snappfood_qa_audits_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header & Actions */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            تاریخچه جامع ارزیابی‌ها (Audits Log)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            مشاهده، جستجو و فیلتر کلیه ارزیابی‌های ثبت‌شده پشتیبانی و فروش
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition shadow-xs"
        >
          <Download className="w-4 h-4 text-sky-600" />
          <span>خروجی اکسل (CSV Export)</span>
        </button>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="جستجو کارشناس، کد سورس، وندور، تیکت یا شماره..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Department */}
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value as any)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه واحدها</option>
            <option value="support">پشتیبانی (Support)</option>
            <option value="sales">فروش (Sales)</option>
          </select>

          {/* Result */}
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value as any)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه نتایج</option>
            <option value="No problem">بدون مشکل (No problem)</option>
            <option value="Need to check">نیازمند بررسی لید</option>
            <option value="بررسی شده">بررسی شده توسط سرپرست</option>
            <option value="Coaching Required">نیازمند آموزش</option>
          </select>

          {/* Dispute */}
          <select
            value={filterDispute}
            onChange={(e) => setFilterDispute(e.target.value as any)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه وضعیت‌های اعتراض</option>
            <option value="pending">اعتراضات در انتظار بررسی</option>
            <option value="any">دارای اعتراض</option>
          </select>
        </div>
      </div>

      {/* 3. Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
                <th className="py-2.5 px-3">شناسه</th>
                <th className="py-2.5 px-3">کارشناس</th>
                <th className="py-2.5 px-3">واحد / تیم</th>
                <th className="py-2.5 px-3">تاریخ بررسی</th>
                <th className="py-2.5 px-3">وندور / شماره</th>
                <th className="py-2.5 px-3">کنترلر</th>
                <th className="py-2.5 px-3">نتیجه</th>
                <th className="py-2.5 px-3">نمره</th>
                <th className="py-2.5 px-3 text-left">اقدام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredAudits.length > 0 ? (
                filteredAudits.map((audit) => {
                  const ag = agents.find((a) => a.id === audit.agent_id);
                  const badge = formatScoreBadge(audit.total_score);

                  return (
                    <tr
                      key={audit.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {audit.id}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {ag?.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          کد سورس: {toPersianDigits(ag?.source_id)}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {ag?.team}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {audit.form_type === 'support' ? 'پشتیبانی' : 'فروش'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {toPersianDigits(audit.check_date)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {audit.vendor_title || `وندور ${audit.vendor_id}`}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {audit.ticket_number || audit.phone_number || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {audit.controller_id}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            audit.result === 'No problem'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : audit.result === 'بررسی شده' || audit.team_lead_reviewed
                              ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                              : audit.result === 'Need to check'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {audit.team_lead_reviewed && audit.result === 'Need to check' ? 'بررسی شده' : audit.result}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${badge.badgeClass}`}
                        >
                          {toPersianDigits(audit.total_score)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-left">
                        <button
                          type="button"
                          onClick={() => setSelectedAudit(audit)}
                          className="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 border border-sky-200 dark:border-sky-800 font-semibold transition"
                        >
                          بررسی
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    موردی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedAudit && (
        <AuditDetailModal
          assessment={selectedAudit}
          onClose={() => setSelectedAudit(null)}
        />
      )}
    </div>
  );
};
