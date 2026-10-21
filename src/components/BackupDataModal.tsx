import React from "react";
import { Database, Download, X } from "lucide-react";
import { useApp } from "../context/AppContext.tsx";

export const BackupDataModal: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const { exportDataToJson } = useApp();

  const handleDownloadBackup = () => {
    const jsonStr = exportDataToJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `snappfood_qa_snapshot_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              دریافت داده‌های قابل مشاهده
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

        <div className="space-y-3 text-xs">
          {/* 1. Export JSON */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-2">
            <div className="font-bold text-slate-800 dark:text-slate-200">
              خروجی محدود JSON
            </div>
            <p className="text-slate-500 text-[11px]">
              این فایل فقط شامل داده‌های بارگذاری‌شده و مجاز حساب شماست و
              پشتیبان کامل پایگاه داده نیست. برای خروجی کامل ارزیابی‌های مجاز از
              خروجی تاریخچه استفاده کنید.
            </p>
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-semibold hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>دانلود داده‌های فعلی</span>
            </button>
          </div>

          <p className="text-slate-500 leading-6">
            بازیابی JSON و بازنشانی داده‌ها در این صفحه فعال نیست. برای ورود
            داده از CSV معتبر و برای پشتیبان‌گیری و بازیابی کامل از رویه پایگاه
            داده در راهنمای استقرار استفاده کنید.
          </p>
        </div>
      </div>
    </div>
  );
};
