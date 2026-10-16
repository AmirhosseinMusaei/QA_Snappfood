import React, { useState } from 'react';
import { Database, Download, Upload, RotateCcw, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';

export const BackupDataModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { exportDataToJson, importDataFromJson, resetToSeedData } = useApp();
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleDownloadBackup = () => {
    const jsonStr = exportDataToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `snappfood_qa_backup_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const success = importDataFromJson(text);
      if (success) {
        setImportStatus('داده‌ها با موفقیت بازیابی شدند.');
      } else {
        setImportStatus('خطا در خواندن فایل پشتیبان. فرمت نامعتبر است.');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm('آیا مطمئن هستید که می‌خواهید تمام تغییرات پاک شده و به داده‌های اولیه بازگردید؟')) {
      resetToSeedData();
      setImportStatus('سیستم با موفقیت به داده‌های اولیه بازنشانی شد.');
      setTimeout(onClose, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              پشتیبان‌گیری و مدیریت داده‌ها
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {importStatus && (
          <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-600" />
            <span>{importStatus}</span>
          </div>
        )}

        <div className="space-y-3 text-xs">
          {/* 1. Export JSON */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-2">
            <div className="font-bold text-slate-800 dark:text-slate-200">
              خروجی پشتیبان (JSON Export)
            </div>
            <p className="text-slate-500 text-[11px]">
              دانلود کامل تمام ارزیابی‌ها، کارشناسان و خطاهای ثبت‌شده در قالب یک فایل استاندارد JSON.
            </p>
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-semibold hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>دانلود فایل پشتیبان</span>
            </button>
          </div>

          {/* 2. Import JSON */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-2">
            <div className="font-bold text-slate-800 dark:text-slate-200">
              بازیابی از فایل (JSON Restore)
            </div>
            <p className="text-slate-500 text-[11px]">
              بارگذاری فایل پشتیبان قبلی و اعمال آن بر روی سامانه.
            </p>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-semibold hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-xs cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-sky-600" />
              <span>انتخاب و بارگذاری فایل JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* 3. Reset to Seed */}
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-2">
            <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>بازنشانی به داده‌های اولیه اسنپ‌فود</span>
            </div>
            <p className="text-rose-600/80 dark:text-rose-400 text-[11px]">
              پاک کردن ارزیابی‌های تستی و بازگرداندن داده‌های اولیه کارشناسان و ارزیابی‌های شیت مرجع.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>بازنشانی به داده‌های پیش‌فرض</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
