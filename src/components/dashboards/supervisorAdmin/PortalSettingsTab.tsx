import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { PortalSettings } from '../../../types/index.ts';
import { toPersianDigits } from '../../../utils/persian.ts';

interface PortalSettingsTabProps {
  settings: PortalSettings;
  updateSettings: (newSettings: Partial<PortalSettings>) => void;
}

export const PortalSettingsTab: React.FC<PortalSettingsTabProps> = ({
  settings,
  updateSettings,
}) => {
  const [settingsForm, setSettingsForm] = useState<PortalSettings>(settings);
  const [settingsSaveToast, setSettingsSaveToast] = useState(false);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(settingsForm);
    setSettingsSaveToast(true);
    setTimeout(() => setSettingsSaveToast(false), 3000);
  };

  return (
    <form
      onSubmit={handleSaveSettings}
      className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 text-xs"
    >
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            پیکربندی قوانین نمره‌دهی، جریمه‌ها و آستانه‌های کیفی
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            تنظیم دقیق جدول کسر نمره سکوت/انضباط فروش، مهلت ثبت اعتراض و آستانه‌های تفکیک کیفیت
          </p>
        </div>

        <button
          type="submit"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition"
        >
          <Save className="w-4 h-4" />
          <span>ذخیره تغییرات تنظیمات</span>
        </button>
      </div>

      {settingsSaveToast && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>تنظیمات و قوانین نمره‌دهی سیستم با موفقیت بروزرسانی شد.</span>
        </div>
      )}

      {/* Section 1: Sales Mistake Deduction Table */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-sky-600" />
          <span>جدول نمره خطاهای انضباط مکالمه و سکوت فروش (Sales Mistakes Schedule - سقف ۳۰ امتیاز)</span>
        </h4>
        <p className="text-[11px] text-slate-400">
          بر اساس شیت فرمول فروش: ۰ خطا = ۳۰ نمره، ۱ خطا = ۲۵ نمره، ۲ خطا = ۲۰ نمره، ۳ خطا = ۱۵ نمره، ۴ خطا = ۱۰ نمره، ۵ خطا یا بیشتر = ۰ نمره
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[0, 1, 2, 3, 4, 5].map((count) => (
            <div
              key={count}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center space-y-1"
            >
              <span className="text-[11px] text-slate-400 block">
                {count === 5 ? '۵ خطا و بیشتر' : `${toPersianDigits(count)} خطا`}
              </span>
              <div className="flex items-center justify-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={settingsForm.sales_mistake_deductions[count] ?? 0}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      sales_mistake_deductions: {
                        ...settingsForm.sales_mistake_deductions,
                        [count]: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-14 p-1 text-center font-mono font-bold rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs"
                />
                <span className="text-[10px] text-slate-400">نمره</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Quality Thresholds, Targets & Dispute Window */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
            مهلت ثبت اعتراض توسط کارشناس (روز کاری):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={14}
              value={settingsForm.dispute_window_days}
              onChange={(e) =>
                setSettingsForm({
                  ...settingsForm,
                  dispute_window_days: Number(e.target.value) || 3,
                })
              }
              className="w-20 p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono font-bold"
            />
            <span className="text-slate-500">روز از تاریخ ثبت بررسی</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2">
          <label className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">
            آستانه عملکرد عالی (High Quality &ge;):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={85}
              max={100}
              value={settingsForm.high_quality_threshold}
              onChange={(e) =>
                setSettingsForm({
                  ...settingsForm,
                  high_quality_threshold: Number(e.target.value) || 95,
                })
              }
              className="w-20 p-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 font-mono font-bold text-emerald-600"
            />
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">امتیاز</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20 space-y-2">
          <label className="text-[11px] font-bold text-rose-800 dark:text-rose-300 block">
            آستانه هشدار کیفی (Low Quality &lt;):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={50}
              max={90}
              value={settingsForm.low_quality_threshold}
              onChange={(e) =>
                setSettingsForm({
                  ...settingsForm,
                  low_quality_threshold: Number(e.target.value) || 80,
                })
              }
              className="w-20 p-2 rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-800 font-mono font-bold text-rose-600"
            />
            <span className="text-rose-700 dark:text-rose-400 font-semibold">امتیاز</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/30 dark:bg-sky-950/20 space-y-2">
          <label className="text-[11px] font-bold text-sky-800 dark:text-sky-300 block">
            تارگت ماهانه هر کنترلر کیفیت (Controller Target):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={50}
              max={500}
              value={settingsForm.controller_monthly_target}
              onChange={(e) =>
                setSettingsForm({
                  ...settingsForm,
                  controller_monthly_target: Number(e.target.value) || 160,
                })
              }
              className="w-24 p-2 rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-800 font-mono font-bold text-sky-700 dark:text-sky-300"
            />
            <span className="text-sky-700 dark:text-sky-400 font-semibold">ارزیابی در ماه</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-2">
          <label className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 block">
            حداقل بررسی ماهانه کارشناس (Min Monthly Reviews):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              max={200}
              value={settingsForm.min_monthly_reviews_default}
              onChange={(e) =>
                setSettingsForm({
                  ...settingsForm,
                  min_monthly_reviews_default: Number(e.target.value) || 40,
                })
              }
              className="w-24 p-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 font-mono font-bold text-indigo-700 dark:text-indigo-300"
            />
            <span className="text-indigo-700 dark:text-indigo-400 font-semibold">بررسی در ماه</span>
          </div>
        </div>
      </div>
    </form>
  );
};
