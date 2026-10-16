import React, { useState, useMemo } from 'react';
import { Assessment, RubricSection } from '../../types/index.ts';
import { toPersianDigits } from '../../utils/persian.ts';
import { AlertCircle, X, CheckCircle2, ShieldAlert, Award } from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';

interface DisputeModalProps {
  assessment: Assessment;
  initialCriterionId?: string;
  onClose: () => void;
  onSubmit?: (comment: string, criterionId?: string, criterionTitle?: string) => void;
}

export const DisputeModal: React.FC<DisputeModalProps> = ({
  assessment,
  initialCriterionId,
  onClose,
  onSubmit,
}) => {
  const { supportRubric, salesRubric, submitDispute } = useApp();

  const rubric: RubricSection[] =
    assessment.form_type === 'support' ? supportRubric : salesRubric;

  const scoreMap =
    assessment.form_type === 'support'
      ? assessment.support_scores || {}
      : assessment.sales_scores || {};

  // Build granular list of all selectable criteria & items
  const criteriaList = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      section: string;
      isDeducted?: boolean;
      lost?: number;
    }> = [
      { id: 'general', title: 'کل ارزیابی و نتیجه کلی نمره', section: 'عمومی' },
    ];

    rubric.forEach((sec) => {
      sec.criteria.forEach((crit) => {
        // Add criterion level
        list.push({
          id: crit.id,
          title: `[معیار] ${crit.title} (سقف ${toPersianDigits(crit.maxPoints)} امتیاز)`,
          section: sec.title,
        });

        // Add item level for pinpoint precision
        crit.items.forEach((item) => {
          const awarded = scoreMap[item.id] !== undefined ? scoreMap[item.id] : item.maxPoints;
          const isDeducted = awarded < item.maxPoints;
          const lost = item.maxPoints - awarded;

          list.push({
            id: item.id,
            title: `• ${crit.title}: ${item.title}${isDeducted ? ` (-${toPersianDigits(lost)} امتیاز)` : ''}`,
            section: sec.title,
            isDeducted,
            lost,
          });
        });
      });
    });

    return list;
  }, [rubric, scoreMap]);

  // Determine initial selection
  const defaultSelected = useMemo(() => {
    if (initialCriterionId && criteriaList.some((c) => c.id === initialCriterionId)) {
      return initialCriterionId;
    }
    // Default to the first deducted item if exists, otherwise 'general'
    const firstDeducted = criteriaList.find((c) => c.isDeducted);
    return firstDeducted ? firstDeducted.id : 'general';
  }, [initialCriterionId, criteriaList]);

  const [selectedCritId, setSelectedCritId] = useState<string>(defaultSelected);
  const [comment, setComment] = useState('');

  const selectedCrit = criteriaList.find((c) => c.id === selectedCritId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    const critTitle = selectedCrit?.title || 'کل ارزیابی';

    if (onSubmit) {
      onSubmit(comment.trim(), selectedCritId, critTitle);
    } else {
      submitDispute(assessment.id, selectedCritId, critTitle, comment.trim());
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                ثبت اعتراض به نمره ارزیابی (File Dispute)
              </h3>
              <p className="text-[11px] text-slate-400">
                انتخاب دقیق معیار مورد اعتراض جهت بازشنوایی توسط کنترلر کیفیت
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Assessment summary snapshot */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span>
              شناسه ارزیابی:{' '}
              <strong className="font-mono text-slate-900 dark:text-white">{assessment.id}</strong>
            </span>
            <span>
              نمره ثبت‌شده:{' '}
              <strong className="font-mono text-sky-600 dark:text-sky-400 font-bold">
                {toPersianDigits(assessment.total_score)} / ۱۰۰
              </strong>
            </span>
          </div>
          <div className="text-slate-500 text-[11px] flex items-center justify-between">
            <span>تاریخ بررسی: {toPersianDigits(assessment.check_date)}</span>
            <span>وندور: {assessment.vendor_title || assessment.vendor_id || 'نامشخص'}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Criterion Selector with Grouping and Visual Indicators */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                معیار یا بخش مورد اعتراض:
              </label>
              {selectedCrit?.isDeducted && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded">
                  کسر شده: {toPersianDigits(selectedCrit.lost || 0)} امتیاز
                </span>
              )}
            </div>

            <select
              value={selectedCritId}
              onChange={(e) => setSelectedCritId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-sky-500 font-medium"
            >
              {criteriaList.map((crit) => (
                <option key={crit.id} value={crit.id}>
                  {crit.isDeducted ? '⚠️ ' : ''}
                  {crit.title}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              نکته: مواردی که علامت ⚠️ دارند، مواردی هستند که در این ارزیابی از شما کسر نمره شده‌اند.
            </p>
          </div>

          {/* Comment / Reason */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              شرح دقیق دلیل اعتراض، استناد به گایدلاین یا ثانیه‌شمار صوت:
            </label>
            <textarea
              required
              rows={4}
              placeholder="مثال: در دقیقه ۱:۱۵ مکالمه، نام مجموعه به طور کامل تکرار شده است و کسر نمره استاندارد شروع صحیح نمی‌باشد..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500 text-xs leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition"
            >
              ثبت نهایی اعتراض
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
