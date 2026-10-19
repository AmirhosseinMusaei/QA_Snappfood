import React from 'react';
import { RotateCcw, Save, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { DepartmentType } from '../../types/index.ts';
import { toPersianDigits } from '../../utils/persian.ts';

export interface WorkspaceScoreSummaryProps {
  formType: DepartmentType;
  supportCalculation: { total: number; softSkill: number; knowledge: number };
  salesCalculation: { total: number; softSkill: number; script: number; mistakeScore: number };
  mistakeCount: number;
  isFraud: boolean;
  isCriticalFault: boolean;
  totalScore: number;
  scoreBadge: { label: string; badgeClass: string };
  validation: { isValid: boolean; error?: string; missingItems: any[] };
  submitToast: string | null;
  onResetToFull: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const WorkspaceScoreSummary: React.FC<WorkspaceScoreSummaryProps> = ({
  formType,
  supportCalculation,
  salesCalculation,
  mistakeCount,
  isFraud,
  isCriticalFault,
  totalScore,
  scoreBadge,
  validation,
  submitToast,
  onResetToFull,
  onSubmit,
}) => {
  return (
    <>
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
                onClick={onResetToFull}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition"
                title="ریست تمام کسر نمرات به ۱۰۰"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ریست به ۱۰۰</span>
              </button>

              <button
                type="button"
                onClick={onSubmit}
                disabled={!validation.isValid}
                title={
                  validation.isValid
                    ? 'ثبت ارزیابی'
                    : `دکمه غیرفعال است: ${validation.missingItems.length} معیار فاقد نمره ثبت‌شده است`
                }
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold shadow-md transition-all ${
                  validation.isValid
                    ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>ثبت ارزیابی</span>
                {!validation.isValid && validation.missingItems.length > 0 && (
                  <span className="mr-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px]">
                    {toPersianDigits(validation.missingItems.length)} ناقص
                  </span>
                )}
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
    </>
  );
};
