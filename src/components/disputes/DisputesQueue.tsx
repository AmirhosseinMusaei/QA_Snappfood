import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Search,
  Filter,
  Volume2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { Assessment, Dispute } from '../../types/index.ts';
import { toPersianDigits, formatScoreBadge } from '../../utils/persian.ts';
import { AuditDetailModal } from '../AuditDetailModal.tsx';
import { AudioWaveformPlayer } from '../AudioWaveformPlayer.tsx';

export const DisputesQueue: React.FC = () => {
  const { assessments, agents, resolveDispute, role, currentControllerId } = useApp();

  const [filterStatus, setFilterStatus] = useState<'pending' | 'resolved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<Assessment | null>(null);

  // Active resolving state
  const [resolvingDisputeId, setResolvingDisputeId] = useState<string | null>(null);
  const [resolutionComment, setResolutionComment] = useState('');
  const [revisedScore, setRevisedScore] = useState<number>(100);

  // All assessments that have a dispute
  const disputedAudits = useMemo(() => {
    return assessments.filter((a) => a.dispute !== undefined);
  }, [assessments]);

  // Filtered by status and search
  const filteredAudits = useMemo(() => {
    return disputedAudits.filter((audit) => {
      const d = audit.dispute!;
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const agent = agents.find((ag) => ag.id === audit.agent_id);
        const agentName = agent?.name.toLowerCase() || '';
        const sourceId = agent?.source_id || '';
        const critTitle = (d.criterion_title || '').toLowerCase();
        const comment = (d.agent_comment || '').toLowerCase();
        const vendor = (audit.vendor_title || '').toLowerCase();

        return (
          agentName.includes(q) ||
          sourceId.includes(q) ||
          critTitle.includes(q) ||
          comment.includes(q) ||
          vendor.includes(q) ||
          audit.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [disputedAudits, filterStatus, searchQuery, agents]);

  const pendingCount = disputedAudits.filter((a) => a.dispute?.status === 'pending').length;
  const resolvedCount = disputedAudits.filter((a) => a.dispute?.status === 'resolved').length;
  const rejectedCount = disputedAudits.filter((a) => a.dispute?.status === 'rejected').length;

  const handleStartResolve = (audit: Assessment) => {
    setResolvingDisputeId(audit.id);
    setRevisedScore(audit.total_score);
    setResolutionComment('');
  };

  const handleConfirmResolve = (auditId: string, status: 'resolved' | 'rejected') => {
    if (!resolutionComment.trim()) {
      alert('لطفاً توضیحات و نتیجه بازشنوایی کنترلر را یادداشت نمایید.');
      return;
    }

    resolveDispute(
      auditId,
      status,
      resolutionComment.trim(),
      status === 'resolved' ? revisedScore : undefined
    );

    setResolvingDisputeId(null);
    setResolutionComment('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              کارتابل اعتراضات کارشناسان (Disputes Queue)
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-semibold">
              گردش کار بازشنوایی کنترلر کیفیت
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            بررسی اعتراضات ثبت‌شده توسط کارشناسان حداکثر ظرف ۳ روز کاری و اصلاح نمرات پس از بازشنوایی دقیق صوت تماس
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs">
            <span className="text-amber-800 dark:text-amber-300 font-bold">
              {toPersianDigits(pendingCount)}
            </span>
            <span className="text-amber-600 dark:text-amber-400 mr-1">در انتظار بررسی</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs">
            <span className="text-emerald-800 dark:text-emerald-300 font-bold">
              {toPersianDigits(resolvedCount)}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 mr-1">پذیرفته‌شده</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs">
            <span className="text-rose-800 dark:text-rose-300 font-bold">
              {toPersianDigits(rejectedCount)}
            </span>
            <span className="text-rose-600 dark:text-rose-400 mr-1">ردشده</span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition ${
              filterStatus === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            در انتظار رسیدگی ({toPersianDigits(pendingCount)})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('resolved')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition ${
              filterStatus === 'resolved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            تایید و اصلاح‌شده ({toPersianDigits(resolvedCount)})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('rejected')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition ${
              filterStatus === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            رد اعتراض ({toPersianDigits(rejectedCount)})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            همه
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجوی نام کارشناس، کد سورس، معیار..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>
      </div>

      {/* 3. Disputes List */}
      <div className="space-y-4">
        {filteredAudits.length > 0 ? (
          filteredAudits.map((audit) => {
            const dispute = audit.dispute!;
            const agent = agents.find((a) => a.id === audit.agent_id);
            const isResolving = resolvingDisputeId === audit.id;
            const badge = formatScoreBadge(audit.total_score);

            return (
              <div
                key={audit.id}
                className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4"
              >
                {/* Dispute Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        dispute.status === 'pending'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : dispute.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {dispute.status === 'pending'
                        ? 'در انتظار بررسی'
                        : dispute.status === 'resolved'
                        ? 'پذیرفته و اصلاح نمره'
                        : 'رد اعتراض'}
                    </span>

                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {agent?.name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      (کد {toPersianDigits(agent?.source_id)})
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                      تیم {agent?.team}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="font-mono">ثبت اعتراض: {toPersianDigits(dispute.created_at)}</span>
                    <span>·</span>
                    <span>کنترلر: {audit.controller_id}</span>
                  </div>
                </div>

                {/* Audit Context & Dispute Reason */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left Column: Disputed Criterion & Agent Reason */}
                  <div className="md:col-span-8 space-y-3">
                    <div className="p-3.5 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-900 dark:text-sky-200">
                          معیار مورد اعتراض: {dispute.criterion_title || 'کل ارزیابی'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ارزیابی شناسه: {audit.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-sky-100 dark:border-sky-800/40">
                        <strong className="block text-slate-900 dark:text-white mb-1">
                          متن اعتراض کارشناس:
                        </strong>
                        {dispute.agent_comment}
                      </p>
                    </div>

                    {/* Resolution Result if already decided */}
                    {dispute.status !== 'pending' && (
                      <div
                        className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                          dispute.status === 'resolved'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                            : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                        }`}
                      >
                        <div className="font-bold">
                          نتیجه رسیدگی: {dispute.status === 'resolved' ? 'اعتراض پذیرفته شد' : 'اعتراض رد شد'}
                          {dispute.revised_score !== undefined && (
                            <span className="font-mono mr-2">
                              (نمره نهایی: {toPersianDigits(dispute.revised_score)} از ۱۰۰)
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">
                          توضیحات کنترلر ({dispute.controller_id}): {dispute.controller_comment}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Audio & Score Snapshot */}
                  <div className="md:col-span-4 flex flex-col justify-between bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">نمره ثبت‌شده:</span>
                      <span className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded ${badge.badgeClass}`}>
                        {toPersianDigits(audit.total_score)} / ۱۰۰
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      <div>وندور: {audit.vendor_title || `کد ${audit.vendor_id}`}</div>
                      <div>شماره: {audit.ticket_number || audit.phone_number || 'ندارد'}</div>
                    </div>

                    {/* Audio inspection button */}
                    <button
                      type="button"
                      onClick={() => setSelectedAudit(audit)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition shadow-2xs"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                      <span>بازشنوایی صوت و مشاهده جزئیات</span>
                    </button>
                  </div>
                </div>

                {/* Dispute Resolution Actions for Controller */}
                {dispute.status === 'pending' && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60">
                    {!isResolving ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartResolve(audit)}
                          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition"
                        >
                          تعیین تکلیف و ثبت نتیجه بازشنوایی
                        </button>
                      </div>
                    ) : (
                      /* Expanded Resolution Box */
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-sky-200 dark:border-sky-800 space-y-4">
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>ثبت تصمیم کنترلر برای اعتراض {audit.id}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                              نمره اصلاح‌شده پس از بازشنوایی:
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={revisedScore}
                              onChange={(e) => setRevisedScore(Number(e.target.value))}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                            />
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              نمره قبلی: {toPersianDigits(audit.total_score)}
                            </span>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                              توضیحات و دلیل تصمیم کنترلر:
                            </label>
                            <input
                              type="text"
                              placeholder="دلیل قبول یا رد اعتراض (مثلاً: صوت مجدداً استماع شد، توضیحات کارشناس صحیح بود...)"
                              value={resolutionComment}
                              onChange={(e) => setResolutionComment(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setResolvingDisputeId(null)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs hover:bg-slate-100 font-medium"
                          >
                            انصراف
                          </button>

                          <button
                            type="button"
                            onClick={() => handleConfirmResolve(audit.id, 'rejected')}
                            className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold"
                          >
                            رد اعتراض (حفظ نمره قبلی)
                          </button>

                          <button
                            type="button"
                            onClick={() => handleConfirmResolve(audit.id, 'resolved')}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                          >
                            پذیرش اعتراض و ذخیره نمره جدید
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p>هیچ اعتراضی در این بخش یافت نشد.</p>
          </div>
        )}
      </div>

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
