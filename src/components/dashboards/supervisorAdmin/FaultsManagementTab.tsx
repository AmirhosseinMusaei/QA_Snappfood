import React, { useState } from 'react';
import {
  ShieldAlert,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import {
  Fault,
  DepartmentType,
} from '../../../types/index.ts';

interface FaultsManagementTabProps {
  faults: Fault[];
  addFault: (fault: Omit<Fault, 'id'>) => void;
  updateFault: (id: string, updates: Partial<Fault>) => void;
  deleteFault: (id: string) => void;
  showModal: boolean;
  setShowModal: (show: boolean) => void;
}

export const FaultsManagementTab: React.FC<FaultsManagementTabProps> = ({
  faults,
  addFault,
  updateFault,
  deleteFault,
  showModal,
  setShowModal,
}) => {
  const [editingFault, setEditingFault] = useState<Fault | null>(null);
  const [faultForm, setFaultForm] = useState({
    title: '',
    department: 'both' as DepartmentType | 'both',
    category: 'Process problem',
    is_critical: false,
    description: '',
  });

  const handleSaveFault = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faultForm.title.trim()) return;

    if (editingFault) {
      updateFault(editingFault.id, faultForm);
      setEditingFault(null);
    } else {
      addFault(faultForm);
    }

    setShowModal(false);
    setFaultForm({
      title: '',
      department: 'both',
      category: 'Process problem',
      is_critical: false,
      description: '',
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
      <div className="flex items-center justify-between text-xs">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">
            ماتریس خطاهای سیستمی، وندور و رفتاری (Faults Master List)
          </h3>
          <p className="text-[11px] text-slate-400">
            خطاهای بحرانی (Critical) منجر به صفر شدن آنی نمره کل ارزیابی می‌گردند.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
              <th className="py-2.5 px-3">عنوان خطا</th>
              <th className="py-2.5 px-3">واحد سازمانی</th>
              <th className="py-2.5 px-3">دسته‌بندی (Category)</th>
              <th className="py-2.5 px-3">شدت و وضعیت بحرانی</th>
              <th className="py-2.5 px-3">توضیحات فرآیندی</th>
              <th className="py-2.5 px-3 text-left">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-sans">
            {faults.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition">
                <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">
                  {f.title}
                </td>
                <td className="py-3 px-3">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                    {f.department === 'both' ? 'هر دو واحد' : f.department === 'support' ? 'پشتیبانی' : 'فروش'}
                  </span>
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                  {f.category}
                </td>
                <td className="py-3 px-3">
                  {f.is_critical ? (
                    <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10px] font-bold">
                      بحرانی (صفر شدن نمره)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-medium">
                      اخطار فرآیندی
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-slate-400 max-w-[200px] truncate" title={f.description}>
                  {f.description || '-'}
                </td>
                <td className="py-3 px-3 text-left">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFault(f);
                        setFaultForm({
                          title: f.title,
                          department: f.department,
                          category: f.category,
                          is_critical: f.is_critical,
                          description: f.description || '',
                        });
                        setShowModal(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                      title="ویرایش خطا"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`آیا از حذف خطای "${f.title}" اطمینان دارید؟`)) {
                          deleteFault(f.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                      title="حذف خطا"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL: Add / Edit Fault */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>{editingFault ? 'ویرایش عنوان خطا' : 'تعریف خطای جدید در ماتریس'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingFault(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFault} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  عنوان خطا:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عدم ارائه پاسخ صحیح به مشتری"
                  value={faultForm.title}
                  onChange={(e) => setFaultForm({ ...faultForm, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    واحد مرتبط:
                  </label>
                  <select
                    value={faultForm.department}
                    onChange={(e) =>
                      setFaultForm({
                        ...faultForm,
                        department: e.target.value as DepartmentType | 'both',
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    <option value="both">هر دو واحد</option>
                    <option value="support">فقط پشتیبانی</option>
                    <option value="sales">فقط فروش</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    دسته‌بندی (Category):
                  </label>
                  <input
                    type="text"
                    value={faultForm.category}
                    onChange={(e) => setFaultForm({ ...faultForm, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    خطای بحرانی (Critical Fault)
                  </div>
                  <div className="text-[10px] text-slate-400">
                    انتخاب این خطا در ارزیابی منجر به صفر شدن فوری امتیاز کل می‌شود.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={faultForm.is_critical}
                  onChange={(e) => setFaultForm({ ...faultForm, is_critical: e.target.checked })}
                  className="w-4 h-4 text-rose-600 rounded"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  توضیحات تکمیلی:
                </label>
                <textarea
                  rows={2}
                  value={faultForm.description}
                  onChange={(e) => setFaultForm({ ...faultForm, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingFault(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold"
                >
                  {editingFault ? 'ذخیره تغییرات' : 'افزودن خطا'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
