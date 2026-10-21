import { useServerPage } from "../context/useServerPage.ts";
import { DataState, PageControls } from "./shared/DataState.tsx";
import { api } from "../utils/api.ts";
import { downloadCsv } from "../utils/downloadTable.ts";
import { formatJalaliDate } from "../utils/persian.ts";
import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Activity,
  Layers,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { AuditLog } from "../types/index.ts";
import { toPersianDigits } from "../utils/persian.ts";

const ENTITY_LABELS: Record<string, { label: string; color: string }> = {
  assessment: {
    label: "ارزیابی",
    color: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
  dispute: {
    label: "اعتراض",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  agent: {
    label: "کارشناس",
    color:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  rubric: {
    label: "رابریک / فرم",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  },
  fault: {
    label: "خطا",
    color: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
  settings: {
    label: "تنظیمات",
    color: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300",
  },
};

const ACTION_LABELS: Record<string, { label: string; badge: string }> = {
  create: {
    label: "ثبت جدید",
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  },
  update: {
    label: "ویرایش",
    badge:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300",
  },
  delete: {
    label: "حذف (Soft Delete)",
    badge:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  },
  dispute_filed: {
    label: "ثبت اعتراض",
    badge:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  },
  dispute_resolved: {
    label: "پذیرش اعتراض",
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  },
  dispute_rejected: {
    label: "رد اعتراض",
    badge:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  },
  team_lead_reviewed: {
    label: "بررسی سرپرست",
    badge:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300",
  },
  rubric_updated: {
    label: "تغییر نسخه رابریک",
    badge:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300",
  },
  settings_updated: {
    label: "بروزرسانی قوانین",
    badge:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300",
  },
};

export const SystemAuditLog: React.FC = () => {
  const { auditLogs: changes, role, currentUser } = useApp();

  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");

  const [page, setPage] = useState(1);
  const query = new URLSearchParams({
    entity: filterEntity,
    action: filterAction,
    search,
  }).toString();
  React.useEffect(() => setPage(1), [query]);
  const resource = useServerPage<AuditLog>(
    "/api/audit-logs",
    query,
    page,
    50,
    changes,
  );
  const filteredLogs = resource.rows;
  // Export CSV with UTF-8 BOM (\uFEFF)
  const handleExportCsv = async () => {
    try {
      let logs: AuditLog[] = [];
      let exportPage = 1,
        total = Infinity;
      while (logs.length < total) {
        const result = await api(
          `/api/audit-logs?${query}&page=${exportPage++}&limit=100`,
        );
        logs.push(...result.data);
        total = result.total;
        if (!result.data.length) break;
      }
      const headers = [
        "شناسه لاگ",
        "تاریخ و زمان (شمسی)",
        "کاربر اقدام‌کننده",
        "نقش کاربر",
        "بخش (Entity)",
        "شناسه هدف",
        "نوع عملیات",
        "فیلد تغییریافته",
        "مقدار قبلی",
        "مقدار جدید",
      ];

      const rows = logs.map((l) => [
        l.id,
        new Date(l.created_at).toLocaleString("fa-IR", {
          timeZone: "Asia/Tehran",
        }),
        l.user_name,
        l.user_role,
        ENTITY_LABELS[l.entity]?.label || l.entity,
        l.entity_id,
        ACTION_LABELS[l.action]?.label || l.action,
        l.field || "-",
        l.old_value || "",
        l.new_value || "",
      ]);

      downloadCsv(headers, rows, `system_audit_log_${Date.now()}.csv`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "دریافت خروجی ناموفق بود");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <DataState loading={resource.loading} error={resource.error} />
      <PageControls
        page={page}
        total={resource.total}
        limit={50}
        onChange={setPage}
      />
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              لاگ ممیزی تغییرات سیستم (System Audit Log)
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-semibold">
              ردگیری تغییرات و شفافیت عملیاتی
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ثبت غیرقابل‌تغییر کلیه رویدادهای ایجاد ارزیابی، ویرایش نمرات، حذف،
            گردش کار اعتراضات و تغییرات رابریک
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition shadow-2xs"
        >
          <Download className="w-4 h-4 text-sky-600" />
          <span>خروجی لاگ ممیزی (Excel / CSV)</span>
        </button>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="جستجو در کاربر، شناسه هدف، فیلد، یا مقادیر..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Entity Filter */}
        <div className="flex items-center gap-2">
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه بخش‌ها (Entities)</option>
            <option value="assessment">ارزیابی‌ها (Assessment)</option>
            <option value="dispute">اعتراضات (Dispute)</option>
            <option value="agent">رستر کارشناسان (Agent)</option>
            <option value="rubric">رابریک و فرم‌ها (Rubric)</option>
            <option value="fault">ماتریس خطاها (Fault)</option>
            <option value="settings">تنظیمات و سهمیه‌ها (Settings)</option>
          </select>

          {/* Action Filter */}
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
          >
            <option value="all">همه نوع عملیات</option>
            <option value="create">ثبت جدید (Create)</option>
            <option value="update">ویرایش (Update)</option>
            <option value="delete">حذف (Soft Delete)</option>
            <option value="dispute_filed">ثبت اعتراض</option>
            <option value="dispute_resolved">پذیرش اعتراض</option>
            <option value="dispute_rejected">رد اعتراض</option>
            <option value="team_lead_reviewed">بررسی سرپرست تیم</option>
            <option value="rubric_updated">تغییر نسخه رابریک</option>
            <option value="settings_updated">بروزرسانی قوانین</option>
          </select>
        </div>
      </div>

      {/* 3. Log Records Table */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
                <th className="py-2.5 px-3">تاریخ و زمان (شمسی)</th>
                <th className="py-2.5 px-3">کاربر اقدام‌کننده</th>
                <th className="py-2.5 px-3">بخش (Entity)</th>
                <th className="py-2.5 px-3">نوع عملیات</th>
                <th className="py-2.5 px-3">فیلد تغییریافته</th>
                <th className="py-2.5 px-3">مقدار قبلی (Old Value)</th>
                <th className="py-2.5 px-3">مقدار جدید (New Value)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-sans">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const entityInfo = ENTITY_LABELS[log.entity] || {
                    label: log.entity,
                    color: "bg-slate-100 text-slate-700",
                  };
                  const actionInfo = ACTION_LABELS[log.action] || {
                    label: log.action,
                    badge: "bg-slate-100 text-slate-700",
                  };

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("fa-IR", {
                          timeZone: "Asia/Tehran",
                        })}
                      </td>

                      {/* User */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {log.user_name}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          نقش: {log.user_role}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${entityInfo.color}`}
                          >
                            {entityInfo.label}
                          </span>
                          <span className="font-mono text-slate-500 text-[11px]">
                            {log.entity_id}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${actionInfo.badge}`}
                        >
                          {actionInfo.label}
                        </span>
                      </td>

                      {/* Field */}
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                        {log.field || "-"}
                      </td>

                      {/* Old Value */}
                      <td
                        className="py-3 px-3 text-slate-400 max-w-[180px] truncate"
                        title={log.old_value}
                      >
                        {log.old_value ? toPersianDigits(log.old_value) : "-"}
                      </td>

                      {/* New Value */}
                      <td
                        className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200 max-w-[240px] truncate"
                        title={log.new_value}
                      >
                        {log.new_value ? toPersianDigits(log.new_value) : "-"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    موردی در لاگ ممیزی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
