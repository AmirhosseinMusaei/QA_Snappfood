import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  X,
  FileSpreadsheet,
  AlertTriangle,
  Database,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { toPersianDigits } from '../utils/persian.ts';

interface ImportError {
  row: string;
  id?: string;
  message: string;
}

interface ImportPreviewItem {
  id: string;
  agent_id: string;
  agent_name?: string;
  agent_source_id?: string;
  form_type: string;
  vendor_title?: string;
  check_date_jalali?: string;
  total_score: number;
  result?: string;
  ticket_number?: string;
  phone_number?: string;
}

interface ImportAssessmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportAssessmentsModal: React.FC<ImportAssessmentsModalProps> = ({ isOpen, onClose }) => {
  const { refreshData } = useApp();

  const [activeMode, setActiveMode] = useState<'upload' | 'paste'>('upload');
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dry-run results
  const [dryRunDone, setDryRunDone] = useState<boolean>(false);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [validCount, setValidCount] = useState<number>(0);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle file drop / change
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg(null);
    setDryRunDone(false);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvContent(text || '');
    };
    reader.onerror = () => {
      setErrorMsg('خطا در خواندن فایل. لطفاً مجدداً امتحان کنید.');
    };
    reader.readAsText(file);
  };

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const sampleHeaders = [
      'کد سورس کارشناس',
      'نام کارشناس',
      'واحد سازمانی',
      'تاریخ بررسی (شمسی)',
      'شناسه وندور',
      'نام مجموعه / وندور',
      'نمره کل',
      'شماره تیکت / تماس',
      'نتیجه ارزیابی',
    ];

    const sampleRows = [
      ['3718', 'علی محمدی', 'پشتیبانی', '۱۴۰۳/۰۷/۱۵', 'v-1024', 'رستوران شاندیز', '95', 'T-884920', 'No problem'],
      ['4102', 'فاطمه احمدی', 'فروش', '۱۴۰۳/۰۷/۱۶', 'v-2051', 'کافه پاریس', '88', '09121112233', 'Need to check'],
      ['3820', 'رضا کریمی', 'پشتیبانی', '۱۴۰۳/۰۷/۱۸', 'v-1090', 'سوپرمارکت ارکیده', '100', 'T-885102', 'No problem'],
    ];

    const csvStr =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [sampleHeaders.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvStr);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sample_assessments_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Run Dry-Run Preview
  const handleRunDryRun = async () => {
    if (!csvContent.trim()) {
      setErrorMsg('لطفاً ابتدا فایل CSV را بارگذاری کرده یا متن آن را در کادر جای‌گذاری کنید.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setImportSuccess(false);

    try {
      const res = await fetch('/api/assessments/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: csvContent,
          dryRun: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'خطا در ارزیابی و پردازش اولیه فایل CSV');
      }

      setDryRunDone(true);
      setTotalRows(data.totalRows || 0);
      setValidCount(data.validCount || 0);
      setErrorCount(data.errorCount || 0);
      setErrors(data.errors || []);
      setPreviewItems(data.preview || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطای برقراری ارتباط با سرور');
      setDryRunDone(false);
    } finally {
      setLoading(false);
    }
  };

  // Confirm Final Persistence
  const handleConfirmImport = async () => {
    if (validCount === 0) {
      setErrorMsg('هیچ رکورد معتبری برای ذخیره در پایگاه داده وجود ندارد.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/assessments/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: csvContent,
          dryRun: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'خطا در ثبت نهایی ارزیابی‌ها در پایگاه داده');
      }

      setImportSuccess(true);
      await refreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ذخیره‌سازی داده‌ها');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                ایمپورت سوابق ارزیابی گذشته (Historical CSV Import)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                بارگذاری گروهی فایل ارزیابی‌های گذشته با پیش‌نمایش و اعتبارسنجی اولیه (Dry Run)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>دانلود فایل نمونه (Template)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Success Banner */}
          {importSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm">ارزیابی‌ها با موفقیت در سیستم ثبت شدند!</div>
                <p className="text-emerald-700 dark:text-emerald-400">
                  تعداد {toPersianDigits(validCount)} ارزیابی با موفقیت در پایگاه داده ذخیره شد و داده‌های گزارش‌ها و داشبوردها به‌روزرسانی گردید.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition text-xs shadow-xs"
                  >
                    بستن پنجره
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Switcher */}
          {!importSuccess && (
            <div className="flex border-b border-slate-200 dark:border-slate-700 pb-3 gap-3">
              <button
                type="button"
                onClick={() => setActiveMode('upload')}
                className={`flex items-center gap-2 pb-1.5 font-bold border-b-2 transition ${
                  activeMode === 'upload'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>بارگذاری فایل CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('paste')}
                className={`flex items-center gap-2 pb-1.5 font-bold border-b-2 transition ${
                  activeMode === 'paste'
                    ? 'border-sky-600 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>جای‌گذاری مستقیم متن CSV</span>
              </button>
            </div>
          )}

          {/* Upload or Paste Area */}
          {!importSuccess && (
            <>
              {activeMode === 'upload' ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-sky-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-900/20 hover:bg-sky-50/20 space-y-2"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv,text/csv"
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-950/60 mx-auto flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {fileName ? `فایل انتخاب‌شده: ${fileName}` : 'برای انتخاب فایل CSV کلیک کنید یا آن را اینجا رها نمایید'}
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    پشتیبانی از فایل‌های CSV استاندارد با کدگذاری UTF-8 یا UTF-8 BOM
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    متن فایل CSV را در کادر زیر وارد کنید (شامل سطر عناوین):
                  </label>
                  <textarea
                    rows={6}
                    value={csvContent}
                    onChange={(e) => {
                      setCsvContent(e.target.value);
                      setDryRunDone(false);
                      setImportSuccess(false);
                    }}
                    placeholder={`کد سورس کارشناس,نام کارشناس,واحد سازمانی,تاریخ بررسی (شمسی),شناسه وندور,نام مجموعه / وندور,نمره کل,شماره تیکت / تماس,نتیجه ارزیابی\n3718,علی محمدی,پشتیبانی,۱۴۰۳/۰۷/۱۵,v-1024,رستوران شاندیز,95,T-884920,No problem`}
                    className="w-full p-3 font-mono text-[11px] rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                    dir="ltr"
                  />
                </div>
              )}

              {/* Action Buttons for Dry-Run */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={loading || !csvContent.trim()}
                  onClick={handleRunDryRun}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold transition shadow-xs"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>اعتبارسنجی اولیه و پیش‌نمایش (Dry Run)</span>
                </button>
              </div>
            </>
          )}

          {/* Dry-Run Results Section */}
          {dryRunDone && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              {/* Stats Counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">کل سطرهای پردازش‌شده:</span>
                  <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100">
                    {toPersianDigits(totalRows)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>سطرهای معتبر:</span>
                  </span>
                  <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-300">
                    {toPersianDigits(validCount)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between">
                  <span className="text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    <span>سطرهای دارای خطا:</span>
                  </span>
                  <span className="font-mono font-bold text-sm text-rose-700 dark:text-rose-300">
                    {toPersianDigits(errorCount)}
                  </span>
                </div>
              </div>

              {/* Error List */}
              {errors.length > 0 && (
                <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
                  <div className="font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>گزارش خطاهای اعتبارسنجی ({toPersianDigits(errors.length)} مورد):</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 text-[11px] pr-1">
                    {errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-rose-100 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-start gap-2"
                      >
                        <span className="font-bold text-rose-900 dark:text-rose-200 shrink-0">
                          سطر {toPersianDigits(err.row)}:
                        </span>
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valid Preview Table */}
              {previewItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      پیش‌نمایش داده‌های معتبر آماده ایمپورت (نمایش حداکثر ۱۵ سطر):
                    </span>
                    <span className="text-[11px] text-slate-400">
                      تاریخ‌ها به صورت میلادی UTC در پایگاه داده و شمسی در خروجی ذخیره خواهند شد.
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2 px-2.5">کارشناس</th>
                          <th className="py-2 px-2.5">کد سورس</th>
                          <th className="py-2 px-2.5">واحد</th>
                          <th className="py-2 px-2.5">تاریخ بررسی</th>
                          <th className="py-2 px-2.5">مجموعه / وندور</th>
                          <th className="py-2 px-2.5">تیکت / تماس</th>
                          <th className="py-2 px-2.5 text-center">نمره</th>
                          <th className="py-2 px-2.5">نتیجه</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {previewItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                            <td className="py-2 px-2.5 font-semibold text-slate-800 dark:text-slate-200">
                              {item.agent_name || item.agent_id}
                            </td>
                            <td className="py-2 px-2.5 font-mono text-slate-500">
                              {toPersianDigits(item.agent_source_id)}
                            </td>
                            <td className="py-2 px-2.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {item.form_type === 'support' ? 'پشتیبانی' : 'فروش'}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 font-mono text-slate-600 dark:text-slate-300">
                              {item.check_date_jalali || '-'}
                            </td>
                            <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300">
                              {item.vendor_title || '-'}
                            </td>
                            <td className="py-2 px-2.5 font-mono text-slate-500">
                              {item.ticket_number || item.phone_number || '-'}
                            </td>
                            <td className="py-2 px-2.5 text-center font-mono font-bold text-sky-600 dark:text-sky-400">
                              {toPersianDigits(item.total_score)}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500">
                              {item.result || 'No problem'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Confirm Persistence Button */}
              {!importSuccess && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-xs text-slate-500">
                    {validCount > 0
                      ? `آماده ذخیره ${toPersianDigits(validCount)} ارزیابی در پایگاه داده Prisma.`
                      : 'هیچ سطر معتبری یافت نشد. لطفاً فایل را اصلاح و مجدداً بارگذاری کنید.'}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDryRunDone(false)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold"
                    >
                      ویرایش ورودی
                    </button>
                    <button
                      type="button"
                      disabled={loading || validCount === 0}
                      onClick={handleConfirmImport}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold transition shadow-xs text-xs"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      <span>تایید و ثبت نهایی در پایگاه داده ({toPersianDigits(validCount)} ارزیابی)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
