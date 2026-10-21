import React from "react";
import type { Assessment } from "../types/index.ts";
import { toPersianDigits } from "../utils/persian.ts";
export function ScoreCorrectionEditor({
  assessment,
  scores,
  onChange,
  criterionId,
}: {
  assessment: Assessment;
  scores: Record<string, number>;
  onChange: (scores: Record<string, number>) => void;
  criterionId?: string;
}) {
  const rubric = assessment.rubric;
  if (!rubric || assessment.legacy_aggregate)
    return (
      <p role="alert">جزئیات نسخهٔ اصلی در دسترس نیست؛ اصلاح نمره ممکن نیست.</p>
    );
  const items = rubric.flatMap((s) =>
    s.criteria
      .filter(
        (c) =>
          !criterionId ||
          c.id === criterionId ||
          c.items.some((i) => i.id === criterionId),
      )
      .flatMap((c) =>
        c.items
          .filter(
            (i) => !criterionId || c.id === criterionId || i.id === criterionId,
          )
          .map((i) => ({ ...i, criterion: c.title })),
      ),
  );
  const original =
    assessment.form_type === "sales"
      ? assessment.sales_scores
      : assessment.support_scores;
  return (
    <div className="max-h-64 overflow-y-auto space-y-2">
      <p className="text-xs">نمرهٔ کل در سرور از آیتم‌ها محاسبه می‌شود.</p>
      {items.map((i) => (
        <label
          key={i.id}
          className="flex items-center justify-between gap-3 text-xs"
        >
          <span>
            {i.criterion} — {i.title} / {toPersianDigits(i.maxPoints)}
          </span>
          <input
            aria-label={i.title}
            className="w-20 rounded border p-2 bg-white dark:bg-slate-800"
            type="number"
            required
            min={0}
            max={i.maxPoints}
            step={1}
            value={scores[i.id] ?? original?.[i.id] ?? ""}
            onChange={(e) =>
              onChange({ ...scores, [i.id]: Number(e.target.value) })
            }
          />
        </label>
      ))}
    </div>
  );
}
