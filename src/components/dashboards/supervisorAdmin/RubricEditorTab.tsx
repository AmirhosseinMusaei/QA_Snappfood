import React, { useState, useMemo, useEffect } from "react";
import { Save, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { DepartmentType, RubricSection } from "../../../types/index.ts";
import { toPersianDigits } from "../../../utils/persian.ts";

interface RubricEditorTabProps {
  supportRubric: RubricSection[];
  salesRubric: RubricSection[];
  supportFormVersion: number;
  salesFormVersion: number;
  updateFullRubric: (
    department: DepartmentType,
    sections: RubricSection[],
  ) => Promise<{ success: boolean; error?: string }>;
}

export const RubricEditorTab: React.FC<RubricEditorTabProps> = ({
  supportRubric,
  salesRubric,
  supportFormVersion,
  salesFormVersion,
  updateFullRubric,
}) => {
  const [rubricDept, setRubricDept] = useState<DepartmentType>("support");
  const [activeSupportSections, setActiveSupportSections] =
    useState<RubricSection[]>(supportRubric);
  const [activeSalesSections, setActiveSalesSections] =
    useState<RubricSection[]>(salesRubric);
  const [rubricSaveSuccess, setRubricSaveSuccess] = useState<string | null>(
    null,
  );
  const [rubricSaveError, setRubricSaveError] = useState<string | null>(null);

  useEffect(() => {
    setActiveSupportSections(supportRubric);
  }, [supportRubric]);

  useEffect(() => {
    setActiveSalesSections(salesRubric);
  }, [salesRubric]);

  const activeSections =
    rubricDept === "support" ? activeSupportSections : activeSalesSections;
  const currentTotalMax = useMemo(() => {
    return activeSections.reduce((sum, s) => sum + s.maxPoints, 0);
  }, [activeSections]);

  const handleUpdateItemPoints = (
    sectionId: string,
    criterionId: string,
    itemId: string,
    newPoints: number,
  ) => {
    const updater = (sections: RubricSection[]) => {
      return sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const newCriteria = sec.criteria.map((crit) => {
          if (crit.id !== criterionId) return crit;
          const newItems = crit.items.map((it) =>
            it.id === itemId ? { ...it, maxPoints: newPoints } : it,
          );
          const critTotal = newItems.reduce((acc, it) => acc + it.maxPoints, 0);
          return { ...crit, items: newItems, maxPoints: critTotal };
        });
        const secTotal = newCriteria.reduce((acc, c) => acc + c.maxPoints, 0);
        return { ...sec, criteria: newCriteria, maxPoints: secTotal };
      });
    };

    if (rubricDept === "support") {
      setActiveSupportSections((prev) => updater(prev));
    } else {
      setActiveSalesSections((prev) => updater(prev));
    }
  };

  const editSections = (fn: (sections: RubricSection[]) => RubricSection[]) => {
    const recalc = (sections: RubricSection[]) =>
      sections.map((s) => {
        const criteria = s.criteria.map((c) => ({
          ...c,
          maxPoints: c.items.reduce((n, i) => n + i.maxPoints, 0),
        }));
        return {
          ...s,
          criteria,
          maxPoints: criteria.reduce((n, c) => n + c.maxPoints, 0),
        };
      });
    if (rubricDept === "sales") setActiveSalesSections((p) => recalc(fn(p)));
    else setActiveSupportSections((p) => recalc(fn(p)));
  };
  const renameCriterion = (sectionId: string, id: string, title: string) =>
    editSections((ss) =>
      ss.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              criteria: s.criteria.map((c) =>
                c.id === id ? { ...c, title } : c,
              ),
            },
      ),
    );
  const renameItem = (
    sectionId: string,
    criterionId: string,
    id: string,
    title: string,
  ) =>
    editSections((ss) =>
      ss.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              criteria: s.criteria.map((c) =>
                c.id !== criterionId
                  ? c
                  : {
                      ...c,
                      items: c.items.map((i) =>
                        i.id === id ? { ...i, title } : i,
                      ),
                    },
              ),
            },
      ),
    );
  const handleSaveRubric = async () => {
    setRubricSaveError(null);
    const res = await updateFullRubric(rubricDept, activeSections);
    if (!res.success) {
      setRubricSaveError(res.error || "خطا در اعتبارسنجی مجموع نمرات");
    } else {
      setRubricSaveSuccess("رابریک با موفقیت ذخیره شد و نسخه فرم ارتقا یافت.");
      setTimeout(() => setRubricSaveSuccess(null), 3500);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
      {/* Header & Department Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              ویرایشگر سقف نمرات رابریک و نسخه‌بندی خودکار
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold">
              نسخه فعال: v
              {rubricDept === "support" ? supportFormVersion : salesFormVersion}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            پشتیبانی: جمع معیارها ۱۰۰؛ فروش: جمع معیارها ۷۰ به‌اضافه ۳۰ امتیاز
            اشتباهات. با ذخیره، نسخه فرم یک شماره ارتقا می‌یابد تا سوابق گذشته
            دست‌نخورده باقی بماند.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setRubricDept("support")}
              className={`px-3 py-1.5 rounded-lg transition ${
                rubricDept === "support"
                  ? "bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              پشتیبانی تجاری (Support - ۱۰۰ امتیاز)
            </button>
            <button
              type="button"
              onClick={() => setRubricDept("sales")}
              className={`px-3 py-1.5 rounded-lg transition ${
                rubricDept === "sales"
                  ? "bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-xs font-bold"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              فروش و بازاریابی (Sales - ۱۰۰ امتیاز)
            </button>
          </div>

          {/* Total score badge validation */}
          <div
            className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${
              currentTotalMax === (rubricDept === "sales" ? 70 : 100)
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 animate-pulse"
            }`}
          >
            {currentTotalMax === (rubricDept === "sales" ? 70 : 100) ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>
              مجموع سقف: {toPersianDigits(currentTotalMax)} /{" "}
              {rubricDept === "sales" ? "۷۰ + ۳۰ اشتباهات" : "۱۰۰"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveRubric}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره رابریک و ارتقای نسخه (Save & Bump Version)</span>
          </button>
        </div>
      </div>

      {/* Feedback Toasts */}
      {rubricSaveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{rubricSaveSuccess}</span>
        </div>
      )}
      {rubricSaveError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2 border border-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{rubricSaveError}</span>
        </div>
      )}

      {/* Rubric Sections Table */}
      <div className="space-y-4">
        {activeSections.map((section) => (
          <div
            key={section.id}
            className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="bg-slate-100/80 dark:bg-slate-750 px-4 py-3 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                بخش: {section.title}
              </span>
              <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                سقف تجمیعی بخش: {toPersianDigits(section.maxPoints)} امتیاز
              </span>
            </div>

            <div className="p-4 space-y-3">
              <button
                type="button"
                onClick={() =>
                  editSections((ss) =>
                    ss.map((s) =>
                      s.id !== section.id
                        ? s
                        : {
                            ...s,
                            criteria: [
                              ...s.criteria,
                              {
                                id: crypto.randomUUID(),
                                title: "معیار جدید",
                                maxPoints: 1,
                                items: [
                                  {
                                    id: crypto.randomUUID(),
                                    title: "زیرمعیار جدید",
                                    maxPoints: 1,
                                  },
                                ],
                              },
                            ],
                          },
                    ),
                  )
                }
              >
                افزودن معیار
              </button>
              {section.criteria.map((criterion) => (
                <div
                  key={criterion.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <input
                      aria-label="عنوان معیار"
                      value={criterion.title}
                      className="border rounded p-1 bg-transparent"
                      onChange={(e) =>
                        renameCriterion(
                          section.id,
                          criterion.id,
                          e.target.value,
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        editSections((ss) =>
                          ss.map((s) =>
                            s.id !== section.id
                              ? s
                              : {
                                  ...s,
                                  criteria: s.criteria.filter(
                                    (c) => c.id !== criterion.id,
                                  ),
                                },
                          ),
                        )
                      }
                    >
                      حذف معیار
                    </button>
                    <span className="text-[11px] font-mono text-slate-500">
                      جمع زیرمعیارها: {toPersianDigits(criterion.maxPoints)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      editSections((ss) =>
                        ss.map((s) =>
                          s.id !== section.id
                            ? s
                            : {
                                ...s,
                                criteria: s.criteria.map((c) =>
                                  c.id !== criterion.id
                                    ? c
                                    : {
                                        ...c,
                                        items: [
                                          ...c.items,
                                          {
                                            id: crypto.randomUUID(),
                                            title: "زیرمعیار جدید",
                                            maxPoints: 1,
                                          },
                                        ],
                                      },
                                ),
                              },
                        ),
                      )
                    }
                  >
                    افزودن زیرمعیار
                  </button>
                  {/* Sub-items with editable points */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {criterion.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between text-xs"
                      >
                        <input
                          aria-label="عنوان زیرمعیار"
                          value={item.title}
                          className="min-w-0 w-full border rounded p-1 bg-transparent"
                          onChange={(e) =>
                            renameItem(
                              section.id,
                              criterion.id,
                              item.id,
                              e.target.value,
                            )
                          }
                        />
                        <button
                          type="button"
                          title="حذف زیرمعیار"
                          onClick={() =>
                            editSections((ss) =>
                              ss.map((s) =>
                                s.id !== section.id
                                  ? s
                                  : {
                                      ...s,
                                      criteria: s.criteria.map((c) =>
                                        c.id !== criterion.id
                                          ? c
                                          : {
                                              ...c,
                                              items: c.items.filter(
                                                (i) => i.id !== item.id,
                                              ),
                                            },
                                      ),
                                    },
                              ),
                            )
                          }
                        >
                          ×
                        </button>
                        <div className="flex items-center gap-1 shrink-0 mr-2">
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={item.maxPoints}
                            onChange={(e) =>
                              handleUpdateItemPoints(
                                section.id,
                                criterion.id,
                                item.id,
                                Number(e.target.value) || 0,
                              )
                            }
                            className="w-12 p-1 text-center font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs text-slate-900 dark:text-white"
                          />
                          <span className="text-[10px] text-slate-400">
                            امتیاز
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
