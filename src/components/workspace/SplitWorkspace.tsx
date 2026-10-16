import React, { useState, useMemo, useEffect } from 'react';
import {
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Save,
  Search,
  Phone,
  FileText,
  Store,
  Tag,
  Calendar,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import {
  Agent,
  Assessment,
  DepartmentType,
  SampleType,
  AssessmentResult,
  SupportFaultCategory,
  SalesProject,
} from '../../types/index.ts';
import {
  SUPPORT_RUBRIC,
  SALES_RUBRIC,
  getDefaultSupportScores,
  getDefaultSalesScores,
  calculateSupportTotal,
  calculateSalesTotal,
  calculateSalesMistakeScore,
} from '../../utils/scoring.ts';
import {
  toPersianDigits,
  getJalaliDateString,
  formatScoreBadge,
} from '../../utils/persian.ts';
import { AudioWaveformPlayer } from '../AudioWaveformPlayer.tsx';

const SUPPORT_FAULT_CATEGORIES: SupportFaultCategory[] = [
  'Snappfood problem',
  'Vendor problem',
  'Policy problem',
  'Process problem',
  'Support problem',
  'Other teams',
];

const SALES_PROJECTS: SalesProject[] = [
  'All Project',
  'NCR',
  'Promotion',
  'Campaign',
  'Bi-Party',
];

const SAMPLE_NAMES: SampleType[] = [
  'Support group',
  'bi-party',
  'Dislike',
  'Random Sampling',
  'if needed',
];

export const SplitWorkspace: React.FC<{
  onAssessmentSubmitted?: (newId: string) => void;
}> = ({ onAssessmentSubmitted }) => {
  const { agents, faults, assessments, addAssessment, currentControllerId } = useApp();

  // Selected agent state
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const [agentSearch, setAgentSearch] = useState<string>('');
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState<boolean>(false);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || agents[0],
    [agents, selectedAgentId]
  );

  const formType: DepartmentType = selectedAgent?.department || 'sales';

  // Common Metadata Fields
  const [sampleName, setSampleName] = useState<SampleType>('Random Sampling');
  const [vendorId, setVendorId] = useState<string>('279168');
  const [vendorTitle, setVendorTitle] = useState<string>('فست فود ایران فود');
  const [checkDate, setCheckDate] = useState<string>(getJalaliDateString());
  const [faultId, setFaultId] = useState<string>('');
  const [backendGeneral, setBackendGeneral] = useState<boolean>(false);
  const [isFraud, setIsFraud] = useState<boolean>(false);
  const [result, setResult] = useState<AssessmentResult>('No problem');
  const [resultComment, setResultComment] = useState<string>('');

  // Support-Specific Fields
  const [ticketNumber, setTicketNumber] = useState<string>('VTS-1450577');
  const [voiceLink, setVoiceLink] = useState<string>(
    'https://actions.google.com/sounds/v1/telephones/telephone_ring.ogg'
  );
  const [description, setDescription] = useState<string>('');
  const [selectedFaultCategories, setSelectedFaultCategories] = useState<
    SupportFaultCategory[]
  >([]);

  // Sales-Specific Fields
  const [phoneNumber, setPhoneNumber] = useState<string>('۰۹۳۳۶۱۵۰۰۴۶');
  const [project, setProject] = useState<SalesProject>('Campaign');
  const [discountOrCoupon, setDiscountOrCoupon] = useState<string>('DISC-22998961');
  const [registrationDate, setRegistrationDate] = useState<string>(getJalaliDateString());
  const [executionDate, setExecutionDate] = useState<string>(getJalaliDateString());
  const [mistakeCount, setMistakeCount] = useState<number>(0);

  // Rubric Scores (Defaults to 100/100 Full Scores)
  const [supportScores, setSupportScores] = useState<Record<string, number>>(
    getDefaultSupportScores()
  );
  const [salesScores, setSalesScores] = useState<Record<string, number>>(
    getDefaultSalesScores()
  );

  const [submitToast, setSubmitToast] = useState<string | null>(null);

  // Check if selected fault is critical
  const selectedFault = faults.find((f) => f.id === faultId);
  const isCriticalFault = !!selectedFault?.is_critical;

  // Duplicate ticket check for the same agent
  const isDuplicateTicket = useMemo(() => {
    if (!ticketNumber || formType !== 'support') return false;
    return assessments.some(
      (a) =>
        a.agent_id === selectedAgent?.id &&
        a.ticket_number?.trim().toLowerCase() === ticketNumber.trim().toLowerCase()
    );
  }, [ticketNumber, selectedAgent?.id, assessments, formType]);

  // Compute live scores
  const supportCalculation = useMemo(
    () => calculateSupportTotal(supportScores, isFraud, isCriticalFault),
    [supportScores, isFraud, isCriticalFault]
  );

  const salesCalculation = useMemo(
    () => calculateSalesTotal(salesScores, mistakeCount, isFraud, isCriticalFault),
    [salesScores, mistakeCount, isFraud, isCriticalFault]
  );

  const totalScore = formType === 'support' ? supportCalculation.total : salesCalculation.total;
  const scoreBadge = formatScoreBadge(totalScore);

  // Filter agents for search combobox
  const filteredAgents = useMemo(() => {
    if (!agentSearch) return agents;
    const q = agentSearch.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.source_id.includes(q) ||
        a.team.toLowerCase().includes(q)
    );
  }, [agents, agentSearch]);

  // Reset to full score (100)
  const resetToFullScore = () => {
    setSupportScores(getDefaultSupportScores());
    setSalesScores(getDefaultSalesScores());
    setMistakeCount(0);
    setIsFraud(false);
    setBackendGeneral(false);
    setFaultId('');
    setResult('No problem');
  };

  // Toggle Support rubric item
  const toggleSupportItem = (itemId: string, maxPoints: number) => {
    setSupportScores((prev) => {
      const current = prev[itemId] !== undefined ? prev[itemId] : maxPoints;
      return {
        ...prev,
        [itemId]: current === maxPoints ? 0 : maxPoints,
      };
    });
  };

  // Toggle Sales rubric item
  const toggleSalesItem = (itemId: string, maxPoints: number) => {
    setSalesScores((prev) => {
      const current = prev[itemId] !== undefined ? prev[itemId] : maxPoints;
      return {
        ...prev,
        [itemId]: current === maxPoints ? 0 : maxPoints,
      };
    });
  };

  // Toggle fault category chip
  const toggleFaultCategory = (cat: SupportFaultCategory) => {
    setSelectedFaultCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // Submit assessment handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newAssessmentData: Omit<Assessment, 'id' | 'created_at'> = {
      agent_id: selectedAgent.id,
      controller_id: currentControllerId,
      form_type: formType,
      sample_name: sampleName,
      vendor_id: vendorId,
      vendor_title: vendorTitle,
      check_date: checkDate,
      fault_id: faultId || undefined,
      backend_general: backendGeneral,
      is_fraud: isFraud,
      result: result,
      result_comment: resultComment,
      total_score: totalScore,

      // Support specific
      ticket_number: formType === 'support' ? ticketNumber : undefined,
      voice_link: formType === 'support' ? voiceLink : undefined,
      description: formType === 'support' ? description : undefined,
      fault_categories: formType === 'support' ? selectedFaultCategories : undefined,
      support_scores: formType === 'support' ? supportScores : undefined,

      // Sales specific
      phone_number: formType === 'sales' ? phoneNumber : undefined,
      project: formType === 'sales' ? project : undefined,
      discount_or_coupon: formType === 'sales' ? discountOrCoupon : undefined,
      registration_date: formType === 'sales' ? registrationDate : undefined,
      execution_date: formType === 'sales' ? executionDate : undefined,
      mistake_count: formType === 'sales' ? mistakeCount : undefined,
      sales_scores: formType === 'sales' ? salesScores : undefined,
    };

    const created = addAssessment(newAssessmentData);
    setSubmitToast(`ارزیابی با موفقیت ثبت شد (شناسه: ${created.id})`);
    setTimeout(() => setSubmitToast(null), 4000);

    if (onAssessmentSubmitted) {
      onAssessmentSubmitted(created.id);
    }
  };

  // Generate Zoodfood backend URL
  const zoodfoodUrl = vendorId.trim()
    ? `https://newbackend.zoodfood.com/vendor/${vendorId.trim()}/edit`
    : null;

  return (
    <div className="pb-16">
      {/* 1. TOP STICKY LIVE SCORE HUD BAR */}
      <div className="sticky top-14 sm:top-16 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm py-2 sm:py-3 px-3 sm:px-6 lg:px-8 mb-4 sm:mb-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          {/* Subtotals & Deductions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-medium">
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <span className="hidden sm:inline">فرم:</span>
              <span className="font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs">
                {formType === 'support' ? 'پشتیبانی' : 'فروش'}
              </span>
            </div>

            {formType === 'support' ? (
              <div className="flex items-center gap-2 sm:gap-3 text-slate-700 dark:text-slate-300">
                <div>
                  ارتباطی: <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{toPersianDigits(supportCalculation.softSkill)}</span>/۶۰
                </div>
                <div>
                  دانش: <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{toPersianDigits(supportCalculation.knowledge)}</span>/۴۰
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3 text-slate-700 dark:text-slate-300">
                <div>
                  رفتاری: <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{toPersianDigits(salesCalculation.softSkill)}</span>/۲۹
                </div>
                <div>
                  اسکریپت: <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{toPersianDigits(salesCalculation.script)}</span>/۴۱
                </div>
                <div>
                  خطاها: <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{toPersianDigits(salesCalculation.mistakeScore)}</span>/۳۰
                  {mistakeCount > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 mr-1 text-[10px]">
                      ({toPersianDigits(mistakeCount)} خطا)
                    </span>
                  )}
                </div>
              </div>
            )}

            {(isFraud || isCriticalFault) && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] sm:text-xs font-bold animate-pulse">
                <ShieldAlert className="w-3 h-3" />
                <span>{isFraud ? 'تقلب (۰)' : 'بحرانی (۰)'}</span>
              </div>
            )}
          </div>

          {/* Final Score & Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-left hidden md:block">
                <div className="text-[11px] text-slate-400">نمره نهایی</div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {scoreBadge.label}
                </div>
              </div>

              {/* Score Circular / Large Badge */}
              <div
                className={`flex items-center justify-center px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-xl border font-bold text-base sm:text-xl font-mono tabular-nums shadow-sm transition-all ${scoreBadge.badgeClass}`}
              >
                {toPersianDigits(totalScore)} / ۱۰۰
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={resetToFullScore}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition"
                title="ریست تمام کسر نمرات به ۱۰۰"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ریست به ۱۰۰</span>
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>ثبت ارزیابی</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Line */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              totalScore >= 90
                ? 'bg-emerald-500'
                : totalScore >= 70
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
            style={{ width: `${totalScore}%` }}
          />
        </div>
      </div>

      {/* Success Toast */}
      {submitToast && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white shadow-xl animate-bounce text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          <span>{submitToast}</span>
        </div>
      )}

      {/* 2. SPLIT-SCREEN WORKSPACE LAYOUT (35% Right Context, 65% Left Rubric) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================= */}
          {/* RIGHT PANEL (Sticky Context & Metadata - 35% / 4-5 cols) */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-36">
            {/* Card: Agent Selection & Metadata */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <UserCheckIcon className="w-4 h-4 text-sky-600" />
                  <span>انتخاب کارشناس (Agent)</span>
                </label>
                <span className="text-[11px] text-slate-400">جستجو با نام یا کد</span>
              </div>

              {/* Searchable Combobox */}
              <div className="relative mb-3">
                <div
                  className="flex items-center justify-between w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:border-sky-400 transition"
                  onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                      {selectedAgent.name}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                      کد {toPersianDigits(selectedAgent.source_id)}
                    </span>
                  </div>
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                </div>

                {isAgentDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                    <input
                      type="text"
                      placeholder="جستجو نام، کد سورس یا تیم..."
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      className="w-full text-xs p-2 mb-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                    <div className="space-y-1">
                      {filteredAgents.map((ag) => (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            setSelectedAgentId(ag.id);
                            setIsAgentDropdownOpen(false);
                          }}
                          className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                            selectedAgent.id === ag.id
                              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 font-bold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{ag.name}</span>
                          <span className="text-[11px] text-slate-400">
                            {ag.team} · کد {toPersianDigits(ag.source_id)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Auto-filled Agent Metadata Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-700/60">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block">تیم عملیاتی:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedAgent.team} ({selectedAgent.department === 'support' ? 'پشتیبانی' : 'فروش'})
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block">سرپرست تیم (Lead):</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedAgent.team_lead}
                  </span>
                </div>
                {selectedAgent.operator_panel && (
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                    <span className="text-[11px] text-slate-400 block">پنل کاربری:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedAgent.operator_panel}
                    </span>
                  </div>
                )}
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                  <span className="text-[11px] text-slate-400 block">کنترلر تخصیص‌یافته:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedAgent.controller}
                  </span>
                </div>
              </div>
            </div>

            {/* Card: Interaction & Vendor Context */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                <span>مشخصات تعامل و وندور</span>
                <span className="text-[11px] font-normal text-slate-400">تاریخ: {toPersianDigits(checkDate)}</span>
              </div>

              {/* Sample Type & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    نوع سمپل (Sample Type)
                  </label>
                  <select
                    value={sampleName}
                    onChange={(e) => setSampleName(e.target.value as SampleType)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  >
                    {SAMPLE_NAMES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    تاریخ بررسی
                  </label>
                  <input
                    type="text"
                    value={checkDate}
                    onChange={(e) => setCheckDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Vendor ID & Title */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      شناسه وندور (Vendor ID)
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: 279168"
                      value={vendorId}
                      onChange={(e) => setVendorId(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      نام مجموعه / وندور
                    </label>
                    <input
                      type="text"
                      placeholder="نام وندور"
                      value={vendorTitle}
                      onChange={(e) => setVendorTitle(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Auto-Generated Zoodfood Backend Button */}
                {zoodfoodUrl && (
                  <a
                    href={zoodfoodUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs font-semibold transition group"
                  >
                    <span className="flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5" />
                      <span>باز کردن پنل وندور در ZoodFood Backend</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 group-hover:translate-x-[-2px] transition-transform" />
                  </a>
                )}
              </div>

              {/* Support Specific Inputs */}
              {formType === 'support' && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-medium text-slate-500">
                        شماره تیکت (Ticket Number)
                      </label>
                      {isDuplicateTicket && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>هشدار تیکت تکراری برای این کارشناس!</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="مثال: VTS-1450577"
                      value={ticketNumber}
                      onChange={(e) => setTicketNumber(e.target.value)}
                      className={`w-full text-xs p-2 rounded-xl border font-mono ${
                        isDuplicateTicket
                          ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                          : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700'
                      } text-slate-800 dark:text-slate-100`}
                    />
                  </div>

                  {/* Fault Categories Multi-Select Chips */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1.5">
                      دسته‌بندی ریشه خطا (Root Cause Categories)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {SUPPORT_FAULT_CATEGORIES.map((cat) => {
                        const active = selectedFaultCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => toggleFaultCategory(cat)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                              active
                                ? 'bg-sky-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Voice Call Audio Player */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      لینک صوت مکالمه (Voice Link)
                    </label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={voiceLink}
                      onChange={(e) => setVoiceLink(e.target.value)}
                      className="w-full text-xs p-2 mb-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-mono"
                    />
                    <AudioWaveformPlayer url={voiceLink} ticketOrId={ticketNumber} />
                  </div>
                </div>
              )}

              {/* Sales Specific Inputs */}
              {formType === 'sales' && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 block mb-1">
                        شماره تماس وندور
                      </label>
                      <input
                        type="text"
                        placeholder="۰۹۳۳۶۱۵۰۰۴۶"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 block mb-1">
                        پروژه فروش
                      </label>
                      <select
                        value={project}
                        onChange={(e) => setProject(e.target.value as SalesProject)}
                        className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                      >
                        {SALES_PROJECTS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 block mb-1">
                        کد تخفیف / کوپن
                      </label>
                      <input
                        type="text"
                        placeholder="22998961"
                        value={discountOrCoupon}
                        onChange={(e) => setDiscountOrCoupon(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 block mb-1">
                        تاریخ ثبت
                      </label>
                      <input
                        type="text"
                        value={registrationDate}
                        onChange={(e) => setRegistrationDate(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 block mb-1">
                        تاریخ اجرا
                      </label>
                      <input
                        type="text"
                        value={executionDate}
                        onChange={(e) => setExecutionDate(e.target.value)}
                        className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Audio player for Sales call review */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      صوت مکالمه بازاریابی
                    </label>
                    <AudioWaveformPlayer
                      url="https://actions.google.com/sounds/v1/telephones/telephone_ring.ogg"
                      ticketOrId={phoneNumber}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Card: Faults, Flags & Result */}
            <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                وضعیت خطا و نتیجه نهایی
              </div>

              {/* Fault Selector */}
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">
                  عنوان خطای ثبت‌شده (Fault)
                </label>
                <select
                  value={faultId}
                  onChange={(e) => setFaultId(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  <option value="">بدون خطا (No Fault)</option>
                  {faults
                    .filter((f) => f.department === 'both' || f.department === formType)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title} {f.is_critical ? '⚠️ (خطای بحرانی)' : ''}
                      </option>
                    ))}
                </select>
                {selectedFault?.description && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {selectedFault.description}
                  </p>
                )}
              </div>

              {/* Checkboxes: Backend General & Fraud */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={backendGeneral}
                    onChange={(e) => setBackendGeneral(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                  />
                  <span>خطا از سمت بکاند (بدون کسر نمره کارشناس)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-rose-700 dark:text-rose-400">
                  <input
                    type="checkbox"
                    checked={isFraud}
                    onChange={(e) => setIsFraud(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                  />
                  <span>تقلب / Fraud (صفر شدن قطعی نمره این ارزیابی)</span>
                </label>
              </div>

              {/* Result & Comments */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <label className="text-[11px] font-medium text-slate-500 block">
                  نتیجه ارزیابی (Result)
                </label>
                <select
                  value={result}
                  onChange={(e) => setResult(e.target.value as AssessmentResult)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold"
                >
                  <option value="No problem">بدون مشکل (No problem)</option>
                  <option value="Need to check">نیازمند بررسی لید (Need to check)</option>
                  <option value="Coaching Required">نیازمند آموزش و کوچینگ (Coaching Required)</option>
                </select>

                <textarea
                  rows={3}
                  placeholder="توضیحات و بازخورد کنترلر برای کارشناس یا سرپرست تیم..."
                  value={resultComment}
                  onChange={(e) => setResultComment(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* LEFT PANEL (Interactive Rubric & Scoring - 65% / 7 cols)  */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 space-y-6">
            {/* Header info badge */}
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {formType === 'support' ? 'روبریک ارزیابی پشتیبانی (Support Rubric)' : 'روبریک ارزیابی فروش (Sales Rubric)'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  سیستم ارزیابی مبتنی بر کسر نمره؛ تمام موارد به صورت پیش‌فرض با نمره کامل تایید شده‌اند. فقط موارد دارای ایراد را ویرایش فرمایید.
                </p>
              </div>

              <div className="text-left">
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  مجموع: ۱۰۰ امتیاز
                </span>
              </div>
            </div>

            {/* If Support Form */}
            {formType === 'support' && (
              <div className="space-y-6">
                {SUPPORT_RUBRIC.map((section) => (
                  <div
                    key={section.id}
                    className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm"
                  >
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {section.title}
                        </h3>
                      </div>
                      <span className="text-xs font-semibold font-mono text-slate-500">
                        حداکثر نمره: {toPersianDigits(section.maxPoints)}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {section.criteria.map((crit) => (
                        <div
                          key={crit.id}
                          className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {crit.title}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              (سقف: {toPersianDigits(crit.maxPoints)} نمره)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {crit.items.map((item) => {
                              const currentPoints =
                                supportScores[item.id] !== undefined
                                  ? supportScores[item.id]
                                  : item.maxPoints;
                              const isFull = currentPoints === item.maxPoints;

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => toggleSupportItem(item.id, item.maxPoints)}
                                  className={`w-full text-right p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                                    isFull
                                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-xs'
                                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                                        isFull
                                          ? 'bg-sky-600 border-sky-600 text-white'
                                          : 'border-rose-400 text-transparent'
                                      }`}
                                    >
                                      ✓
                                    </div>
                                    <span>{item.title}</span>
                                  </div>
                                  <span
                                    className={`font-mono font-bold ${
                                      isFull
                                        ? 'text-sky-600 dark:text-sky-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {toPersianDigits(currentPoints)} / {toPersianDigits(item.maxPoints)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* If Sales Form */}
            {formType === 'sales' && (
              <div className="space-y-6">
                {/* 1. Soft Skill & 2. Script */}
                {SALES_RUBRIC.map((section) => (
                  <div
                    key={section.id}
                    className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm"
                  >
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {section.title}
                        </h3>
                      </div>
                      <span className="text-xs font-semibold font-mono text-slate-500">
                        حداکثر نمره: {toPersianDigits(section.maxPoints)}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {section.criteria.map((crit) => (
                        <div
                          key={crit.id}
                          className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {crit.title}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              (سقف: {toPersianDigits(crit.maxPoints)} نمره)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {crit.items.map((item) => {
                              const currentPoints =
                                salesScores[item.id] !== undefined
                                  ? salesScores[item.id]
                                  : item.maxPoints;
                              const isFull = currentPoints === item.maxPoints;

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => toggleSalesItem(item.id, item.maxPoints)}
                                  className={`w-full text-right p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                                    isFull
                                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-xs'
                                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                                        isFull
                                          ? 'bg-sky-600 border-sky-600 text-white'
                                          : 'border-rose-400 text-transparent'
                                      }`}
                                    >
                                      ✓
                                    </div>
                                    <span>{item.title}</span>
                                  </div>
                                  <span
                                    className={`font-mono font-bold ${
                                      isFull
                                        ? 'text-sky-600 dark:text-sky-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {toPersianDigits(currentPoints)} / {toPersianDigits(item.maxPoints)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* 3. Mistake & Fraud Section (30 points) */}
                <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        بخش تعداد خطا و انضباط مکالمه (Mistake & Deductions)
                      </h3>
                    </div>
                    <span className="text-xs font-semibold font-mono text-slate-500">
                      سقف این بخش: ۳۰ امتیاز
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          تعداد خطاهای ثبت‌شده کارشناس (Mistake Count)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ۰ خطا = ۳۰ نمره | ۱ خطا = ۲۵ نمره (-۵) | ۲ خطا = ۲۰ نمره (-۱۰) | ۳ خطا = ۱۵ نمره (-۱۵) | ۴ خطا = ۱۰ نمره (-۲۰) | ۵+ خطا = ۰ نمره
                        </div>
                      </div>

                      {/* Stepper Buttons */}
                      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {[0, 1, 2, 3, 4, 5].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setMistakeCount(cnt)}
                            className={`w-9 h-8 rounded-lg text-xs font-mono font-bold transition ${
                              mistakeCount === cnt
                                ? 'bg-sky-600 text-white shadow-sm'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            {cnt === 5 ? '+۵' : toPersianDigits(cnt)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700 text-xs font-semibold">
                      <span className="text-slate-600 dark:text-slate-400">
                        امتیاز احراز شده از این بخش:
                      </span>
                      <span className="font-mono text-base text-sky-600 dark:text-sky-400">
                        {toPersianDigits(calculateSalesMistakeScore(mistakeCount))} از ۳۰ امتیاز
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple User icon fallback
const UserCheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);
