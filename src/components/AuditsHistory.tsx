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
  Edit2,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  Upload,
  ShieldAlert,
  User,
  Users,
  Eye,
  X,
  Save,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { Assessment, DepartmentType, AssessmentResult, Fault } from '../types/index.ts';
import {
  toPersianDigits,
  toEnglishDigits,
  formatScoreBadge,
  dateToJalali,
  JALALI_MONTHS,
} from '../utils/persian.ts';
import { exportAssessmentsToExcel } from '../utils/exportExcel.ts';
import { AuditDetailModal } from './AuditDetailModal.tsx';
import { ImportAssessmentsModal } from './ImportAssessmentsModal.tsx';

export const AuditsHistory: React.FC = () => {
  const {
    assessments,
    allAssessments,
    agents,
    teams,
    controllers,
    faults,
    role,
    currentUser,
    updateAssessment,
    deleteAssessment,
    restoreAssessment,
  } = useApp();

  // Filters State
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterAgentId, setFilterAgentId] = useState<string>('all');
  const [filterController, setFilterController] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<'all' | DepartmentType>('all');
  const [filterScoreRange, setFilterScoreRange] = useState<'all' | 'high' | 'mid' | 'low'>('all');
  const [filterResult, setFilterResult] = useState<'all' | AssessmentResult>('all');
  const [filterFraud, setFilterFraud] = useState<'all' | 'fraud' | 'backend_general'>('all');
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals
  const [selectedAudit, setSelectedAudit] = useState<Assessment | null>(null);
  const [editingAudit, setEditingAudit] = useState<Assessment | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [editScoreInput, setEditScoreInput] = useState<number>(100);
  const [editCommentInput, setEditCommentInput] = useState<string>('');
  const [editResultInput, setEditResultInput] = useState<AssessmentResult>('No problem');
  const [editFaultIdInput, setEditFaultIdInput] = useState<string>('');

  // Source list: active or deleted
  const sourceList = showDeleted ? allAssessments.filter((a) => a.deleted_at) : assessments;

  // Filtered audits
  const filteredAudits = useMemo(() => {
    return sourceList.filter((audit) => {
      // 1. Month filter (compares Jalali month number)
      if (filterMonth !== 'all') {
        const jMonth =
          audit.check_date_month_num ??
          (audit.check_date_year && audit.check_date_month_num
            ? audit.check_date_month_num
            : dateToJalali(audit.check_date).month);
        if (jMonth !== Number(filterMonth)) {
          return false;
        }
      }

      // 2. Dept filter
      if (filterDept !== 'all' && audit.form_type !== filterDept) return false;

      // 3. Team & Agent filters
      const ag = agents.find((a) => a.id === audit.agent_id);
      if (filterTeam !== 'all' && ag?.team !== filterTeam) return false;
      if (filterAgentId !== 'all' && audit.agent_id !== filterAgentId) return false;

      // 4. Controller filter
      if (filterController !== 'all') {
        const cNorm = (audit.controller_id || '').toLowerCase();
        const fNorm = filterController.toLowerCase();
        if (!cNorm.includes(fNorm) && !fNorm.includes(cNorm)) return false;
      }

      // 5. Score Range filter
      if (filterScoreRange === 'high' && audit.total_score < 90) return false;
      if (filterScoreRange === 'mid' && (audit.total_score < 70 || audit.total_score >= 90)) return false;
      if (filterScoreRange === 'low' && audit.total_score >= 70) return false;

      // 6. Result filter
      if (filterResult !== 'all') {
        if (filterResult === 'Need to check' && audit.result !== 'Need to check') return false;
        if (filterResult === 'بررسی شده' && audit.result !== 'بررسی شده' && !audit.team_lead_reviewed) return false;
        if (filterResult === 'No problem' && audit.result !== 'No problem') return false;
        if (filterResult === 'Coaching Required' && audit.result !== 'Coaching Required') return false;
      }

      // 7. Fraud / Backend general filter
      if (filterFraud === 'fraud' && !audit.is_fraud) return false;
      if (filterFraud === 'backend_general' && !audit.backend_general) return false;

      // 8. Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const agentName = ag?.name.toLowerCase() || '';
        const sourceId = ag?.source_id || '';
        const vendor = (audit.vendor_title || '').toLowerCase();
        const vendorId = audit.vendor_id || '';
        const ticket = (audit.ticket_number || '').toLowerCase();
        const phone = audit.phone_number || '';
        const comment = (audit.result_comment || '').toLowerCase();

        return (
          audit.id.toLowerCase().includes(q) ||
          agentName.includes(q) ||
          sourceId.includes(q) ||
          vendor.includes(q) ||
          vendorId.includes(q) ||
          ticket.includes(q) ||
          phone.includes(q) ||
          comment.includes(q)
        );
      }

      return true;
    });
  }, [
    sourceList,
    agents,
    filterMonth,
    filterDept,
    filterTeam,
    filterAgentId,
    filterController,
    filterScoreRange,
    filterResult,
    filterFraud,
  ]);

  const totalItems = filteredAudits.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedAudits = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAudits.slice(start, start + pageSize);
  }, [filteredAudits, currentPage, pageSize]);

  // Open Edit Modal
  const handleOpenEdit = (audit: Assessment) => {
    setEditingAudit(audit);
    setEditScoreInput(audit.total_score);
    setEditCommentInput(audit.result_comment || '');
    setEditResultInput(audit.result);
    setEditFaultIdInput(audit.fault_id || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAudit) return;

    updateAssessment(editingAudit.id, {
      total_score: editScoreInput,
      result_comment: editCommentInput.trim(),
      result: editResultInput,
      fault_id: editFaultIdInput || undefined,
    });

    setEditingAudit(null);
  };

  const handleDeleteAudit = (audit: Assessment) => {
    if (confirm(`آیا از حذف موقت ارزیابی ${audit.id} اطمینان دارید؟`)) {
      deleteAssessment(audit.id);
    }
  };

  // Excel (.xlsx) Export
  const handleExportExcel = () => {
    exportAssessmentsToExcel(
      filteredAudits,
      agents,
      `snappfood_assessments_${Date.now()}.xlsx`
    );
  };

  // CSV Export with UTF-8 BOM (\uFEFF)
  const handleExportCsv = () => {
    const headers = [
      'شناسه ارزیابی',
      'کارشناس',
      'کد سورس',
      'تیم',
      'واحد سازمانی',
      'تاریخ بررسی (شمسی)',
      'شناسه وندور',
      'نام مجموعه / وندور',
      'شماره تیکت / تماس',
      'نمره کل',
      'نتیجه ارزیابی',
      'کنترلر کیفیت',
      'خطای تقلب',
      'خطای فنی سیستم',
      'یادداشت لید',
      'کامنت کنترلر',
    ];

    const rows = filteredAudits.map((a) => {
      const ag = agents.find((item) => item.id === a.agent_id);
      const jalaliDate = a.check_date_jalali_plain || a.check_date_jalali || dateToJalali(a.check_date).jalaliStr;
      return [
        a.id,
        ag?.name || '',
        ag?.source_id || '',
        ag?.team || '',
        a.form_type === 'support' ? 'پشتیبانی' : 'فروش',
        jalaliDate,
        a.vendor_id || '',
        `"${(a.vendor_title || '').replace(/"/g, '""')}"`,
        a.ticket_number || a.phone_number || '',
        a.total_score,
        a.result,
        a.controller_id,
        a.is_fraud ? 'بله' : 'خیر',
        a.backend_general ? 'بله' : 'خیر',
        `"${(a.team_lead_note || '').replace(/"/g, '""')}"`,
        `"${(a.result_comment || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `snappfood_assessments_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Permission checks
  const canEditOrDelete = (audit: Assessment) => {
    if (role === 'qa_supervisor' || role === 'admin') return true;
    if (role === 'qa_controller' && (audit.controller_id === currentUser.username || audit.controller_id === currentUser.name)) {
      return true;
    }
    return false;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header & Actions */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              لیست و تاریخچه ارزیابی‌ها (Assessments List)
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-semibold font-mono">
              {toPersianDigits(filteredAudits.length)} ارزیابی
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            مشاهده، جستجوی پیشرفته، فیلترهای چندگانه و خروجی استاندارد اکسل مطابق با شیت منبع
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(role === 'qa_supervisor' || role === 'admin') && (
            <button
              type="button"
              onClick={() => setShowDeleted(!showDeleted)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                showDeleted
                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:border-rose-800'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{showDeleted ? 'بازگشت به ارزیابی‌های فعال' : 'سطل زباله (Soft Deleted)'}</span>
            </button>
          )}

          {(role === 'qa_supervisor' || role === 'qa_controller' || role === 'admin') && (
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900 border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-semibold transition shadow-2xs"
              title="بارگذاری گروهی و ایمپورت سوابق ارزیابی گذشته از طریق فایل CSV با پیش‌نمایش اعتبارسنجی"
            >
              <Upload className="w-4 h-4 text-sky-600" />
              <span>ایمپورت سوابق (CSV Import)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-semibold border border-emerald-300 dark:border-emerald-800 transition shadow-2xs"
            title="خروجی فایل رسمی مایکروسافت اکسل (.xlsx) با تفکیک ستون‌ها و استایل استاندارد"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>خروجی اکسل (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition shadow-2xs"
            title="خروجی فایل کاما-جدا با کدگذاری UTF-8 BOM جهت سازگاری با اکسل فارسی"
          >
            <Download className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>خروجی CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Advanced Multi-Filter Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 text-xs">
        {/* Row 1: Search & Core Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو کارشناس، کد، وندور، تیکت..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Month Filter */}
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه ماه‌های جلالی</option>
            {JALALI_MONTHS.map((name, idx) => {
              const mNum = idx + 1;
              return (
                <option key={mNum} value={String(mNum)}>
                  {name} ({toPersianDigits(mNum < 10 ? `۰${mNum}` : String(mNum))})
                </option>
              );
            })}
          </select>

          {/* Department Filter */}
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value as any)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه واحدها (پشتیبانی و فروش)</option>
            <option value="support">پشتیبانی تجاری (Support)</option>
            <option value="sales">فروش و بازاریابی (Sales)</option>
          </select>

          {/* Team Filter */}
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه تیم‌ها</option>
            {teams.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name} ({t.department === 'support' ? 'پشتیبانی' : 'فروش'})
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: Secondary Precision Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-700/60">
          {/* Agent Filter */}
          <select
            value={filterAgentId}
            onChange={(e) => setFilterAgentId(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه کارشناسان</option>
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.name} ({ag.team} - {toPersianDigits(ag.source_id)})
              </option>
            ))}
          </select>

          {/* Controller Filter */}
          <select
            value={filterController}
            onChange={(e) => setFilterController(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه کنترلرهای کیفیت</option>
            {controllers.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} ({c.display_name})
              </option>
            ))}
          </select>

          {/* Score Range Filter */}
          <select
            value={filterScoreRange}
            onChange={(e) => setFilterScoreRange(e.target.value as any)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه دامنه‌های نمره</option>
            <option value="high">نمره عالی (۹۰ تا ۱۰۰)</option>
            <option value="mid">نمره متوسط (۷۰ تا ۸۹)</option>
            <option value="low">نیازمند آموزش (کمتر از ۷۰)</option>
          </select>

          {/* Result & Flags Filter */}
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value as any)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه نتایج ارزیابی</option>
            <option value="No problem">بدون مشکل (No problem)</option>
            <option value="Need to check">نیازمند بررسی لید (Need to check)</option>
            <option value="بررسی شده">بررسی شده توسط سرپرست</option>
            <option value="Coaching Required">نیازمند آموزش (Coaching)</option>
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
                <th className="py-2.5 px-3">وضعیت نتیجه</th>
                <th className="py-2.5 px-3">نمره کل</th>
                <th className="py-2.5 px-3 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-sans">
              {filteredAudits.length > 0 ? (
                filteredAudits.map((audit) => {
                  const ag = agents.find((a) => a.id === audit.agent_id);
                  const badge = formatScoreBadge(audit.total_score);
                  const isReviewed = audit.result === 'بررسی شده' || audit.team_lead_reviewed;
                  const hasPerm = canEditOrDelete(audit);

                  return (
                    <tr
                      key={audit.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition"
                    >
                      {/* ID */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {audit.id}
                      </td>

                      {/* Agent */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {ag?.name || 'نامشخص'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          کد سورس: {toPersianDigits(ag?.source_id)}
                        </div>
                      </td>

                      {/* Team / Dept */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {ag?.team || '-'}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                          {audit.form_type === 'support' ? 'پشتیبانی' : 'فروش'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {audit.check_date_jalali || toPersianDigits(dateToJalali(audit.check_date).persianJalaliStr)}
                      </td>

                      {/* Vendor / Ticket */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 max-w-[160px] truncate" title={audit.vendor_title}>
                          {audit.vendor_title || `وندور ${audit.vendor_id}`}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {audit.ticket_number || audit.phone_number || '-'}
                        </div>
                      </td>

                      {/* Controller */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                        {audit.controller_id}
                      </td>

                      {/* Result */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            audit.result === 'No problem'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : isReviewed
                              ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                              : audit.result === 'Need to check'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {isReviewed ? 'بررسی شده' : audit.result}
                        </span>
                        {audit.is_fraud && (
                          <span className="mr-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold">
                            تقلب
                          </span>
                        )}
                        {audit.backend_general && (
                          <span className="mr-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 font-medium">
                            خطای فنی
                          </span>
                        )}
                      </td>

                      {/* Total Score */}
                      <td className="py-3 px-3">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${badge.badgeClass}`}>
                          {toPersianDigits(audit.total_score)}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-3 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View details */}
                          <button
                            type="button"
                            onClick={() => setSelectedAudit(audit)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                            title="مشاهده جزئیات ارزیابی"
                          >
                            <Eye className="w-4 h-4 text-sky-600" />
                          </button>

                          {/* Edit button */}
                          {hasPerm && !showDeleted && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(audit)}
                              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                              title="ویرایش نمره و کامنت"
                            >
                              <Edit2 className="w-4 h-4 text-amber-600" />
                            </button>
                          )}

                          {/* Delete or Restore */}
                          {hasPerm && !showDeleted && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAudit(audit)}
                              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                              title="حذف موقت ارزیابی (Soft Delete)"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600" />
                            </button>
                          )}

                          {showDeleted && (
                            <button
                              type="button"
                              onClick={() => restoreAssessment(audit.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 text-[11px] font-bold"
                              title="بازیابی ارزیابی"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>بازیابی</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    ارزیابی مطابق با فیلترهای انتخابی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Assessment Modal */}
      {editingAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ویرایش ارزیابی {editingAudit.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingAudit(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  نمره کل جدید (۰ تا ۱۰۰):
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={editScoreInput}
                  onChange={(e) => setEditScoreInput(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  نتیجه ارزیابی:
                </label>
                <select
                  value={editResultInput}
                  onChange={(e) => setEditResultInput(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
                >
                  <option value="No problem">بدون مشکل (No problem)</option>
                  <option value="Need to check">نیازمند بررسی لید (Need to check)</option>
                  <option value="بررسی شده">بررسی شده</option>
                  <option value="Coaching Required">نیازمند آموزش (Coaching)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  خطای ثبت‌شده:
                </label>
                <select
                  value={editFaultIdInput}
                  onChange={(e) => setEditFaultIdInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="">بدون خطای ماتریس</option>
                  {faults.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title} ({f.is_critical ? 'بحرانی - نمره صفر' : f.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  کامنت و بازخورد کنترلر:
                </label>
                <textarea
                  rows={3}
                  value={editCommentInput}
                  onChange={(e) => setEditCommentInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditingAudit(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>ذخیره تغییرات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      {selectedAudit && (
        <AuditDetailModal
          assessment={selectedAudit}
          onClose={() => setSelectedAudit(null)}
        />
      )}

      {/* CSV Assessment Import Modal */}
      {showImportModal && (
        <ImportAssessmentsModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
};
