import React from 'react';
import { toPersianDigits } from '../../utils/persian.ts';

export interface RubricItemCardProps {
  item: { id: string; title: string; maxPoints: number };
  score: number | undefined;
  onToggle: () => void;
  onSetScore: (valStr: string) => void;
  onStep: (delta: number) => void;
}

export const RubricItemCard: React.FC<RubricItemCardProps> = ({
  item,
  score,
  onToggle,
  onSetScore,
  onStep,
}) => {
  const isMissing = score === undefined || score === null;
  const isOutOfRange = typeof score === 'number' && (score < 0 || score > item.maxPoints);
  const isFull = score === item.maxPoints;
  const isZero = score === 0;

  return (
    <div
      className={`p-3 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
        isMissing || isOutOfRange
          ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 shadow-xs'
          : isZero
          ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
          : isFull
          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-2xs'
          : 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggle}
          title={isFull ? 'تغییر به صفر (تک‌کلیک)' : 'تغییر به نمره کامل (تک‌کلیک)'}
          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-transform active:scale-90 ${
            isMissing
              ? 'border-rose-400 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 font-bold'
              : isFull
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : isZero
              ? 'border-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-950'
              : 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950'
          }`}
        >
          {isMissing ? '؟' : isFull ? '✓' : isZero ? '۰' : '½'}
        </button>

        <div className="min-w-0">
          <span className="font-medium text-slate-800 dark:text-slate-200 block truncate" title={item.title}>
            {item.title}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            سقف: {toPersianDigits(item.maxPoints)} نمره
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
        {/* Quick Full / Zero Toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition border ${
            isFull
              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
              : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          }`}
        >
          {isFull ? 'صفر' : 'کامل'}
        </button>

        {/* Numeric Stepper Input with - and + */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            disabled={score === 0}
            onClick={() => onStep(-1)}
            className="w-6 h-6 rounded flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="کاهش ۱ نمره"
          >
            -
          </button>

          <input
            type="number"
            min={0}
            max={item.maxPoints}
            value={score !== undefined && score !== null ? score : ''}
            placeholder="—"
            onChange={(e) => onSetScore(e.target.value)}
            className={`w-10 h-6 text-center text-xs font-mono font-bold rounded bg-white dark:bg-slate-800 border ${
              isMissing
                ? 'border-rose-400 text-rose-600'
                : isOutOfRange
                ? 'border-rose-500 text-rose-700 bg-rose-50'
                : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
            }`}
          />

          <button
            type="button"
            disabled={score === item.maxPoints}
            onClick={() => onStep(1)}
            className="w-6 h-6 rounded flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="افزایش ۱ نمره"
          >
            +
          </button>
        </div>

        {/* Fraction Display */}
        <span
          className={`text-[11px] font-mono font-bold min-w-10 text-left ${
            isMissing
              ? 'text-rose-600 dark:text-rose-400 animate-pulse'
              : isFull
              ? 'text-emerald-600 dark:text-emerald-400'
              : isZero
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {score !== undefined && score !== null ? `${toPersianDigits(score)}/${toPersianDigits(item.maxPoints)}` : 'بدون نمره'}
        </span>
      </div>
    </div>
  );
};
