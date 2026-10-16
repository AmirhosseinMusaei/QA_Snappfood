import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Store,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  FileText,
  User,
  AlertTriangle,
  FileEdit,
  MessageSquare,
  CheckSquare,
  ShieldCheck,
  Edit3,
} from 'lucide-react';
import { Assessment, RubricSection } from '../types/index.ts';
import { toPersianDigits, formatScoreBadge, isWithinDisputeWindow } from '../utils/persian.ts';
import { AudioWaveformPlayer } from './AudioWaveformPlayer.tsx';
import { useApp } from '../context/AppContext.tsx';
import { DisputeModal } from './disputes/DisputeModal.tsx';

interface AuditDetailModalProps {
  assessment: Assessment;
  onClose: () => void;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({
  assessment: initialAssessment,
  onClose,
}) => {
  const {
    assessments,
    agents,
    role,
    resolveDispute,
    supportRubric,
    salesRubric,
    markTeamLeadReviewed,
    currentTeamLeadId,
    teamLeads,
  } = useApp();

  // Keep live sync with context updates
  const assessment =
    assessments.find((a) => a.id === initialAssessment.id) || initialAssessment;

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeCriterionId, setDisputeCriterionId] = useState<string | undefined>(undefined);

  // Team Lead review inputs
  const [teamLeadNoteInput, setTeamLeadNoteInput] = useState(assessment.team_lead_note || '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState<string | null>(null);

  // Dispute resolution states (for QA Controller / Admin)
  const [resolutionComment, setResolutionComment] = useState('');
  const [revisedScoreInput, setRevisedScoreInput] = useState<number>(assessment.total_score);

  const agent = agents.find((a) => a.id === assessment.agent_id);
  const scoreBadge = formatScoreBadge(assessment.total_score);
  const canDispute = isWithinDisputeWindow(assessment.check_date) && !assessment.dispute;

  const rubric: RubricSection[] =
    assessment.form_type === 'support' ? supportRubric : salesRubric;

  const scoreMap =
    assessment.form_type === 'support'
      ? assessment.support_scores || {}
      : assessment.sales_scores || {};

  const zoodfoodUrl = assessment.vendor_id
    ? `https://newbackend.zoodfood.com/vendor/${assessment.vendor_id}/edit`
    : null;

  const isNeedToCheck =
    (assessment.result === 'Need to check' || (assessment.result as string) === 'need_to_check') &&
    !assessment.team_lead_reviewed;

  const isReviewed =
    assessment.result === 'بررسی شده' || Boolean(assessment.team_lead_reviewed);

  // Handle Team Lead review submission
  const handleTeamLeadSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!teamLeadNoteInput.trim()) {
      alert('لطفاً بازخورد و یادداشت بررسی خود را وارد کنید.');
      return;
    }

    markTeamLeadReviewed(assessment.id, teamLeadNoteInput.trim());
    setIsEditingNote(false);
    setReviewSuccessMessage('وضعیت ارزیابی با موفقیت به "بررسی شده" تغییر یافت و یادداشت سرپرست ثبت شد.');
    setTimeout(() => setReviewSuccessMessage(null), 4000);
  };

  // Open dispute for specific criterion
  const handleOpenCriterionDispute = (criterionOrItemId: string) => {
    setDisputeCriterionId(criterionOrItemId);
    setShowDisputeModal(true);
  };

  const handleResolve = (status: 'resolved' | 'rejected') => {
    if (!resolutionComment.trim()) return;
    resolveDispute(
      assessment.id,
      status,
      resolutionComment.trim(),
      status === 'resolved' ? revisedScoreInput : undefined
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`px-3 py-1.5 rounded-xl font-mono text-lg font-bold border tabular-nums ${scoreBadge.badgeClass}`}
              >
                {toPersianDigits(assessment.total_score)} / ۱۰۰
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    ارزیابی {assessment.id}
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                    {assessment.form_type === 'support' ? 'پشتیبانی تجاری' : 'فروش و بازاریابی'}
                  </span>
                  {assessment.result === 'Need to check' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-white font-bold">
                      نیازمند بررسی لید
                    </span>
                  )}
                  {isReviewed && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500 text-white font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>بررسی شده</span>
                    </span>
                  )}
                  {assessment.is_fraud && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-600 text-white font-bold animate-pulse">
                      تقلب (Fraud)
                    </span>
                  )}
                  {assessment.backend_general && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-semibold">
                      خطای فنی سیستم
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  تاریخ بررسی: {toPersianDigits(assessment.check_date)} · کنترلر:{' '}
                  {assessment.controller_id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Agent Dispute Button */}
              {canDispute && (
                <button
                  type="button"
                  onClick={() => {
                    setDisputeCriterionId(undefined);
                    setShowDisputeModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition"
                  title="ثبت اعتراض با انتخاب دقیق معیار رابریک"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>ثبت اعتراض (مهلت ۳ روزه)</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Success Banner */}
          {reviewSuccessMessage && (
            <div className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 px-5 py-2.5 text-xs font-semibold flex items-center gap-2 border-b border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{reviewSuccessMessage}</span>
            </div>
          )}

          {/* Scrollable Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">نام کارشناس:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {agent?.name || 'نامشخص'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">کد سورس:</span>
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                  {toPersianDigits(agent?.source_id)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">تیم:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {agent?.team}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block">سرپرست تیم:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {agent?.team_lead}
                </span>
              </div>
            </div>

            {/* TEAM LEAD REVIEW SECTION (Interactive & Actionable) */}
            {(isNeedToCheck || isReviewed || role === 'team_lead' || role === 'qa_supervisor' || role === 'admin') && (
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isReviewed
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100'
                    : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {isReviewed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-xs">
                        اقدام سرپرست تیم (Team Lead Review & Feedback)
                      </h4>
                      <p className="text-[11px] opacity-80">
                        {isReviewed
                          ? 'این ارزیابی توسط سرپرست تیم بررسی شده و یادداشت نظارتی ثبت شده است.'
                          : 'این ارزیابی علامت نیازمند بررسی دارد. سرپرست تیم می‌تواند با ثبت یادداشت وضعیت را به «بررسی شده» تغییر دهد.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        isReviewed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {isReviewed ? '✓ وضعیت: بررسی شده' : 'وضعیت: نیازمند بررسی'}
                    </span>
                    {isReviewed && !isEditingNote && (role === 'team_lead' || role === 'qa_supervisor' || role === 'admin') && (
                      <button
                        type="button"
                        onClick={() => setIsEditingNote(true)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:underline"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش یادداشت</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Show review note or input box */}
                {!isReviewed || isEditingNote ? (
                  <form onSubmit={handleTeamLeadSubmit} className="space-y-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        یادداشت و نتیجه بررسی سرپرست تیم:
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="مثال: در جلسه ۱-on-۱ با کارشناس تماس بازشنوایی شد و نحوه استعلام صحیح کد فروشگاه به ایشان آموزش داده شد..."
                        value={teamLeadNoteInput}
                        onChange={(e) => setTeamLeadNoteInput(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs leading-relaxed focus:outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {isEditingNote && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingNote(false);
                            setTeamLeadNoteInput(assessment.team_lead_note || '');
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                        >
                          انصراف
                        </button>
                      )}
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>ثبت یادداشت و تغییر وضعیت به «بررسی شده»</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>یادداشت ثبت‌شده توسط سرپرست تیم ({agent?.team_lead || 'سرپرست'}):</span>
                      {assessment.team_lead_reviewed_at && (
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          تاریخ بررسی: {toPersianDigits(assessment.team_lead_reviewed_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                      {assessment.team_lead_note}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Interaction Details & Links */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Store className="w-4 h-4 text-sky-600" />
                  <span>
                    {assessment.vendor_title || `وندور ${assessment.vendor_id}`} (شناسه:{' '}
                    {toPersianDigits(assessment.vendor_id)})
                  </span>
                </div>

                {zoodfoodUrl && (
                  <a
                    href={zoodfoodUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-semibold border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition"
                  >
                    <span>مشاهده در Zoodfood Backend</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 dark:text-slate-300">
                {assessment.ticket_number && (
                  <div>
                    <span className="text-[11px] text-slate-400 block">شماره تیکت:</span>
                    <span className="font-mono font-bold">{assessment.ticket_number}</span>
                  </div>
                )}
                {assessment.phone_number && (
                  <div>
                    <span className="text-[11px] text-slate-400 block">شماره تماس:</span>
                    <span className="font-mono">{toPersianDigits(assessment.phone_number)}</span>
                  </div>
                )}
                <div>
                  <span className="text-[11px] text-slate-400 block">نوع سمپل:</span>
                  <span>{assessment.sample_name}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">نتیجه ارزیابی:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {assessment.result}
                  </span>
                </div>
              </div>

              {assessment.result_comment && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                  <strong className="block text-slate-900 dark:text-white mb-0.5">
                    کامنت و بازخورد کنترلر کیفیت:
                  </strong>
                  {assessment.result_comment}
                </div>
              )}
            </div>

            {/* Voice Audio Inspection */}
            <div>
              <AudioWaveformPlayer
                url={
                  assessment.voice_link ||
                  'https://actions.google.com/sounds/v1/telephones/telephone_ring.ogg'
                }
                ticketOrId={assessment.ticket_number || assessment.phone_number}
              />
            </div>

            {/* DETAILED RUBRIC CHECKLIST WITH UNCHECKED ITEMS & 1-CLICK DISPUTE BUTTON */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span>ریز نمرات و چک‌لیست رابریک (کسر نمرات با رنگ قرمز مشخص شده است)</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  جهت ثبت اعتراض می‌توانید مستقیماً روی معیار مربوطه کلیک کنید
                </span>
              </div>

              {rubric.map((section) => (
                <div
                  key={section.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800/80 shadow-2xs"
                >
                  <div className="bg-slate-100/70 dark:bg-slate-750 px-4 py-2.5 flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {section.title}
                    </span>
                    <span className="text-slate-400 text-[11px] font-mono">
                      سقف بخش: {toPersianDigits(section.maxPoints)} امتیاز
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60 p-2">
                    {section.criteria.map((criterion) => (
                      <div key={criterion.id} className="p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <span>{criterion.title}</span>
                          <span className="text-slate-400 text-[11px] font-mono">
                            {toPersianDigits(criterion.maxPoints)} امتیاز
                          </span>
                        </div>

                        {/* Sub items list */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {criterion.items.map((item) => {
                            const awarded =
                              scoreMap[item.id] !== undefined
                                ? scoreMap[item.id]
                                : item.maxPoints;
                            const isDeducted = awarded < item.maxPoints;
                            const lost = item.maxPoints - awarded;

                            return (
                              <div
                                key={item.id}
                                className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                                  isDeducted
                                    ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 shadow-2xs'
                                    : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isDeducted ? (
                                    <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                      ✕
                                    </span>
                                  ) : (
                                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                      ✓
                                    </span>
                                  )}
                                  <span className="font-medium text-[11px]">
                                    {item.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 mr-2">
                                  <div className="text-left font-mono">
                                    {isDeducted ? (
                                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded">
                                        - {toPersianDigits(lost)} امتیاز
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                        {toPersianDigits(item.maxPoints)} / {toPersianDigits(item.maxPoints)}
                                      </span>
                                    )}
                                  </div>

                                  {/* 1-Click dispute button on deducted criteria */}
                                  {isDeducted && canDispute && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCriterionDispute(item.id)}
                                      className="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold transition shadow-2xs"
                                      title="ثبت اعتراض دقیق به این معیار"
                                    >
                                      اعتراض به این معیار
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Sales Mistakes Deductions */}
              {assessment.form_type === 'sales' && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-100 block">
                      خطاهای انضباط مکالمه و سکوت (Sales Mistakes)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      تعداد خطاهای ثبت‌شده: {toPersianDigits(assessment.mistake_count || 0)} مورد
                    </span>
                  </div>
                  <div className="font-mono font-bold">
                    {(assessment.mistake_count || 0) > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg">
                        کسر نمره عدم انضباط مکالمه اعمال شده
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        بدون خطای انضباط مکالمه (کامل)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dispute Card & Resolution Interface */}
            {assessment.dispute && (
              <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-sky-600" />
                    <span className="font-bold text-sky-900 dark:text-sky-200">
                      اعتراض ثبت‌شده توسط کارشناس
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {assessment.dispute.created_at}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  <strong className="block text-[11px] text-slate-400 mb-1">
                    معیار مورد اعتراض: {assessment.dispute.criterion_title || 'ارزیابی'}
                  </strong>
                  <p className="text-xs leading-relaxed">{assessment.dispute.agent_comment}</p>
                </div>

                {assessment.dispute.status !== 'pending' ? (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                    <div className="font-bold mb-1">
                      وضعیت:{' '}
                      {assessment.dispute.status === 'resolved'
                        ? 'پذیرفته و نمره اصلاح شد'
                        : 'رد اعتراض'}
                      {assessment.dispute.revised_score !== undefined && (
                        <span className="font-mono mr-2">
                          (نمره نهایی: {toPersianDigits(assessment.dispute.revised_score)})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px]">
                      پاسخ کنترلر ({assessment.dispute.controller_id}):{' '}
                      {assessment.dispute.controller_comment}
                    </div>
                  </div>
                ) : (
                  /* QA Controller Resolution Box */
                  (role === 'qa_controller' || role === 'qa_supervisor' || role === 'admin') && (
                    <div className="pt-2 border-t border-sky-200 dark:border-sky-800 space-y-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        پاسخ و تعیین تکلیف اعتراض (QA Controller Action):
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-500 block mb-1">
                            نمره جدید پس از بازشنوایی:
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={revisedScoreInput}
                            onChange={(e) => setRevisedScoreInput(Number(e.target.value))}
                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500 block mb-1">
                            کامنت و نتیجه بازشنوایی کنترلر:
                          </label>
                          <input
                            type="text"
                            placeholder="دلیل پذیرش یا رد اعتراض..."
                            value={resolutionComment}
                            onChange={(e) => setResolutionComment(e.target.value)}
                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolve('rejected')}
                          className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 text-xs font-semibold"
                        >
                          رد اعتراض (حفظ نمره قبلی)
                        </button>

                        <button
                          type="button"
                          onClick={() => handleResolve('resolved')}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                        >
                          پذیرش اعتراض و ثبت نمره جدید
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDisputeModal && (
        <DisputeModal
          assessment={assessment}
          initialCriterionId={disputeCriterionId}
          onClose={() => {
            setShowDisputeModal(false);
            setDisputeCriterionId(undefined);
          }}
        />
      )}
    </>
  );
};
