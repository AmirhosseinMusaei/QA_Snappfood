import React from 'react';
import {
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import {
  DepartmentType,
  RubricSection,
} from '../../types/index.ts';
import { calculateSalesMistakeScore, ScoreValidationResult } from '../../utils/scoring.ts';
import { toPersianDigits } from '../../utils/persian.ts';
import { RubricItemCard } from './RubricItemCard.tsx';

interface WorkspaceRubricPanelProps {
  formType: DepartmentType;
  validation: ScoreValidationResult;
  supportRubric: RubricSection[];
  salesRubric: RubricSection[];
  supportScores: Record<string, number>;
  salesScores: Record<string, number>;
  mistakeCount: number;
  setMistakeCount: (cnt: number) => void;
  onToggleItem: (itemId: string, maxPoints: number) => void;
  onSetItemScore: (itemId: string, maxPoints: number, valStr: string) => void;
  onStepItem: (itemId: string, maxPoints: number, delta: number) => void;
  onFillMissingWithFull: () => void;
}

export const WorkspaceRubricPanel: React.FC<WorkspaceRubricPanelProps> = ({
  formType,
  validation,
  supportRubric,
  salesRubric,
  supportScores,
  salesScores,
  mistakeCount,
  setMistakeCount,
  onToggleItem,
  onSetItemScore,
  onStepItem,
  onFillMissingWithFull,
}) => {
  return (
    <div className="lg:col-span-7 space-y-6">
      {/* Header info badge */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {formType === 'support'
              ? 'روبریک ارزیابی پشتیبانی (Support Rubric)'
              : 'روبریک ارزیابی فروش (Sales Rubric)'}
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

      {/* Missing items validation banner */}
      {!validation.isValid && validation.missingItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 space-y-2.5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>
                خطای اعتبارسنجی: {toPersianDigits(validation.missingItems.length)} معیار فاقد نمره ثبت‌شده هستند!
              </span>
            </div>
            <button
              type="button"
              onClick={onFillMissingWithFull}
              className="text-xs px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-xs self-start sm:self-auto"
            >
              تکمیل موارد فاقد نمره با سقف نمره
            </button>
          </div>
          <p className="text-[11px] text-rose-600 dark:text-rose-400">
            دکمه ثبت ارزیابی تا زمان ثبت نمره صریح برای تمامی معیارهای زیر غیرفعال است (هیچ موردی به‌صورت پیش‌فرض کامل فرض نمی‌شود):
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {validation.missingItems.map((m) => (
              <span
                key={m.id}
                className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-medium border border-rose-300 dark:border-rose-700 shadow-2xs"
              >
                {m.title} ({toPersianDigits(m.maxPoints)} نمره)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Out-of-range items warning */}
      {!validation.isValid && validation.outOfRangeItems.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-medium space-y-1">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>خطای بازه نمرات: نمره وارد شده خارج از سقف مجاز است!</span>
          </div>
          <div className="text-[11px]">
            {validation.outOfRangeItems.map((o) => (
              <div key={o.id}>
                • {o.title}: نمره واردشده ({o.score}) باید بین ۰ و {o.maxPoints} باشد.
              </div>
            ))}
          </div>
        </div>
      )}

      {/* If Support Form */}
      {formType === 'support' && (
        <div className="space-y-6">
          {supportRubric.map((section) => (
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

                    <div className="grid grid-cols-1 gap-2">
                      {crit.items.map((item) => (
                        <RubricItemCard
                          key={item.id}
                          item={item}
                          score={supportScores[item.id]}
                          onToggle={() => onToggleItem(item.id, item.maxPoints)}
                          onSetScore={(val) => onSetItemScore(item.id, item.maxPoints, val)}
                          onStep={(delta) => onStepItem(item.id, item.maxPoints, delta)}
                        />
                      ))}
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
          {salesRubric.map((section) => (
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

                    <div className="grid grid-cols-1 gap-2">
                      {crit.items.map((item) => (
                        <RubricItemCard
                          key={item.id}
                          item={item}
                          score={salesScores[item.id]}
                          onToggle={() => onToggleItem(item.id, item.maxPoints)}
                          onSetScore={(val) => onSetItemScore(item.id, item.maxPoints, val)}
                          onStep={(delta) => onStepItem(item.id, item.maxPoints, delta)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Mistake & Fraud Section (30 points) */}
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
  );
};
