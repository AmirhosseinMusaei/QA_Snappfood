import React from 'react';
import {
  UserCheck as UserCheckIcon,
  Search,
  Store,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import {
  Agent,
  DepartmentType,
  SampleType,
  AssessmentResult,
  SupportFaultCategory,
  SalesProject,
  Fault,
} from '../../types/index.ts';
import { toPersianDigits } from '../../utils/persian.ts';
import { AudioWaveformPlayer } from '../AudioWaveformPlayer.tsx';

export const SUPPORT_FAULT_CATEGORIES: SupportFaultCategory[] = [
  'Snappfood problem',
  'Vendor problem',
  'Policy problem',
  'Process problem',
  'Support problem',
  'Other teams',
];

export const SALES_PROJECTS: SalesProject[] = [
  'All Project',
  'NCR',
  'Promotion',
  'Campaign',
  'Bi-Party',
];

export const SAMPLE_NAMES: SampleType[] = [
  'Support group',
  'bi-party',
  'Dislike',
  'Random Sampling',
  'if needed',
];

export interface WorkspaceMetadataPanelProps {
  selectedAgent: Agent | undefined;
  agents: Agent[];
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  agentSearch: string;
  setAgentSearch: (search: string) => void;
  isAgentDropdownOpen: boolean;
  setIsAgentDropdownOpen: (open: boolean) => void;
  currentControllerId: string;
  formType: DepartmentType;
  sampleName: SampleType;
  setSampleName: (sample: SampleType) => void;
  checkDate: string;
  setCheckDate: (date: string) => void;
  vendorId: string;
  setVendorId: (id: string) => void;
  vendorTitle: string;
  setVendorTitle: (title: string) => void;
  zoodfoodUrl: string | null;
  ticketNumber: string;
  setTicketNumber: (ticket: string) => void;
  isDuplicateTicket: boolean;
  voiceLink: string;
  setVoiceLink: (link: string) => void;
  selectedFaultCategories: SupportFaultCategory[];
  toggleFaultCategory: (cat: SupportFaultCategory) => void;
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  project: SalesProject;
  setProject: (project: SalesProject) => void;
  discountOrCoupon: string;
  setDiscountOrCoupon: (discount: string) => void;
  registrationDate: string;
  setRegistrationDate: (date: string) => void;
  executionDate: string;
  setExecutionDate: (date: string) => void;
  faultId: string;
  setFaultId: (id: string) => void;
  faults: Fault[];
  selectedFault: Fault | undefined;
  backendGeneral: boolean;
  setBackendGeneral: (val: boolean) => void;
  isFraud: boolean;
  setIsFraud: (val: boolean) => void;
  result: AssessmentResult;
  setResult: (res: AssessmentResult) => void;
  resultComment: string;
  setResultComment: (comment: string) => void;
}

export const WorkspaceMetadataPanel: React.FC<WorkspaceMetadataPanelProps> = ({
  selectedAgent,
  agents,
  selectedAgentId,
  setSelectedAgentId,
  agentSearch,
  setAgentSearch,
  isAgentDropdownOpen,
  setIsAgentDropdownOpen,
  currentControllerId,
  formType,
  sampleName,
  setSampleName,
  checkDate,
  setCheckDate,
  vendorId,
  setVendorId,
  vendorTitle,
  setVendorTitle,
  zoodfoodUrl,
  ticketNumber,
  setTicketNumber,
  isDuplicateTicket,
  voiceLink,
  setVoiceLink,
  selectedFaultCategories,
  toggleFaultCategory,
  phoneNumber,
  setPhoneNumber,
  project,
  setProject,
  discountOrCoupon,
  setDiscountOrCoupon,
  registrationDate,
  setRegistrationDate,
  executionDate,
  setExecutionDate,
  faultId,
  setFaultId,
  faults,
  selectedFault,
  backendGeneral,
  setBackendGeneral,
  isFraud,
  setIsFraud,
  result,
  setResult,
  resultComment,
  setResultComment,
}) => {
  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      a.source_id.includes(agentSearch) ||
      a.team.toLowerCase().includes(agentSearch.toLowerCase())
  );

  return (
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
                {selectedAgent?.name || 'انتخاب کارشناس'}
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                کد {toPersianDigits(selectedAgent?.source_id || '')}
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
                      selectedAgent?.id === ag.id
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
              {selectedAgent?.team || 'عملیات'} ({selectedAgent?.department === 'support' ? 'پشتیبانی' : 'فروش'})
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40">
            <span className="text-[11px] text-slate-400 block">سرپرست تیم (Lead):</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {selectedAgent?.team_lead || 'نگین رضایی'}
            </span>
          </div>
          {selectedAgent?.operator_panel && (
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
              {selectedAgent?.controller || currentControllerId}
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
  );
};
