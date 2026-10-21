import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext.tsx";
import type { Assessment } from "../types/index.ts";
import { api } from "../utils/api.ts";
import {
  dateToJalali,
  JALALI_MONTHS,
  toPersianDigits,
  formatJalaliDate,
} from "../utils/persian.ts";
import { AuditDetailModal } from "./AuditDetailModal.tsx";
import { ScoreCorrectionEditor } from "./ScoreCorrectionEditor.tsx";
import { ImportAssessmentsModal } from "./ImportAssessmentsModal.tsx";
export function AuditsHistory({
  initialAgent,
  initialResult,
  initialYear,
  initialMonth,
}: {
  initialAgent?: string;
  initialResult?: string;
  initialYear?: number;
  initialMonth?: number;
} = {}) {
  const {
    agents,
    teams,
    controllers,
    faults,
    role,
    currentUser,
    updateAssessment,
    deleteAssessment,
    restoreAssessment,
    settings,
    assessments,
  } = useApp();
  const now = dateToJalali(new Date());
  const [year, setYear] = useState(initialYear || now.year),
    [month, setMonth] = useState(initialMonth ? String(initialMonth) : "all"),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [team, setTeam] = useState("all"),
    [agent, setAgent] = useState(initialAgent || "all"),
    [controller, setController] = useState("all"),
    [fault, setFault] = useState("all"),
    [result, setResult] = useState(initialResult || "all"),
    [fraud, setFraud] = useState("all"),
    [range, setRange] = useState("all"),
    [deleted, setDeleted] = useState(false),
    [rows, setRows] = useState<Assessment[]>([]),
    [total, setTotal] = useState(0),
    [selected, setSelected] = useState<Assessment | null>(null),
    [editing, setEditing] = useState<Assessment | null>(null),
    [scores, setScores] = useState<Record<string, number>>({}),
    [comment, setComment] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0),
    [importing, setImporting] = useState(false);
  useEffect(() => {
    if (initialYear) setYear(initialYear);
    if (initialMonth) setMonth(String(initialMonth));
  }, [initialYear, initialMonth]);
  const query = useMemo(() => {
    const q = new URLSearchParams({
      page: String(page),
      limit: "25",
      search,
      team,
      agent_id: agent,
      controller_id: controller,
      fault_id: fault,
      result,
    });
    if (month !== "all") {
      q.set("year", String(year));
      q.set("month", month);
    }
    if (fraud !== "all") q.set("is_fraud", fraud);
    if (range === "high") q.set("min_score", "90");
    if (range === "mid") {
      q.set("min_score", "70");
      q.set("max_score", "89");
    }
    if (range === "low") q.set("max_score", "69");
    if (deleted) {
      q.set("include_deleted", "true");
      q.set("deleted_only", "true");
    }
    return q;
  }, [
    page,
    search,
    team,
    agent,
    controller,
    fault,
    result,
    month,
    year,
    fraud,
    range,
    deleted,
  ]);
  useEffect(
    () => setPage(1),
    [
      search,
      team,
      agent,
      controller,
      fault,
      result,
      month,
      year,
      fraud,
      range,
      deleted,
    ],
  );
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(
      () =>
        api("/api/assessments?" + query)
          .then((r) => {
            if (live) {
              setRows(r.data);
              setTotal(r.total);
            }
          })
          .catch((e) => {
            if (live) setError(e.message);
          })
          .finally(() => {
            if (live) setLoading(false);
          }),
      150,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query.toString(), reload, assessments]);
  const select = (
    value: string,
    change: (s: string) => void,
    options: Array<[string, string]>,
    label: string,
  ) => (
    <label className="text-xs">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => change(e.target.value)}
        className="block p-2 rounded border dark:bg-slate-800"
      >
        <option value="all">همه</option>
        {options.map(([v, t]) => (
          <option value={v} key={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
  const execute = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setReload((n) => n + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const exportQuery = new URLSearchParams(query);
  exportQuery.delete("page");
  exportQuery.delete("limit");
  return (
    <section className="max-w-7xl mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="font-bold text-xl">تاریخچه ارزیابی‌ها</h2>
        {role !== "agent" && (
          <div className="flex gap-3">
            <a href={"/api/export/assessments.xlsx?" + exportQuery}>
              خروجی اکسل همه نتایج
            </a>
            <a href={"/api/export/assessments.csv?" + exportQuery}>CSV</a>
            {["qa_supervisor", "qa_controller"].includes(role) && (
              <button onClick={() => setImporting(true)}>ورود تاریخچه</button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
        <input
          aria-label="جستجوی ارزیابی"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجوی تیکت، وندور، کارشناس…"
          className="p-2 border rounded bg-transparent"
        />
        <input
          aria-label="سال تاریخچه"
          value={year}
          type="number"
          min={1200}
          max={1600}
          onChange={(e) => setYear(+e.target.value)}
          className="w-24 p-2 border rounded bg-transparent"
        />
        {select(
          month,
          setMonth,
          JALALI_MONTHS.map((m, i) => [String(i + 1), m]),
          "ماه",
        )}
        {select(
          team,
          setTeam,
          teams.map((t) => [t.id, t.name]),
          "تیم",
        )}
        {role !== "agent" &&
          select(
            agent,
            setAgent,
            agents.map((a) => [a.id, a.name]),
            "کارشناس",
          )}
        {select(
          controller,
          setController,
          controllers.map((c) => [c.id, c.display_name]),
          "کنترلر",
        )}
        {select(
          fault,
          setFault,
          faults.map((f) => [f.id, f.title]),
          "خطا",
        )}
        {select(
          result,
          setResult,
          (
            (settings as any).result_options || [
              "No problem",
              "Need to check",
              "Coaching Required",
              "بررسی شده",
            ]
          ).map((s: string) => [s, s]),
          "نتیجه",
        )}
        {select(
          fraud,
          setFraud,
          [
            ["true", "دارای تقلب"],
            ["false", "بدون تقلب"],
          ],
          "تقلب",
        )}
        {select(
          range,
          setRange,
          [
            ["high", "۹۰ تا ۱۰۰"],
            ["mid", "۷۰ تا ۸۹"],
            ["low", "کمتر از ۷۰"],
          ],
          "بازه نمره",
        )}
        {["qa_supervisor", "admin", "qa_controller"].includes(role) && (
          <label>
            <input
              type="checkbox"
              checked={deleted}
              onChange={(e) => setDeleted(e.target.checked)}
            />{" "}
            حذف‌شده‌ها
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      )}
      {loading && <p role="status">در حال دریافت…</p>}
      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
        <table className="w-full text-right text-sm">
          <thead>
            <tr>
              {[
                "کارشناس",
                "تاریخ شمسی",
                "تیکت / تماس",
                "نمره",
                "نتیجه",
                "عملیات",
              ].map((t) => (
                <th className="p-3" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr className="border-t dark:border-slate-700" key={a.id}>
                <td className="p-3">
                  {agents.find((g) => g.id === a.agent_id)?.name ||
                    (a as any).agent?.name}
                </td>
                <td>{a.check_date_jalali || formatJalaliDate(a.check_date)}</td>
                <td>{a.ticket_number || a.phone_number}</td>
                <td>
                  {toPersianDigits(a.total_score)}
                  {a.legacy_aggregate && (
                    <small className="block">فاقد جزئیات تاریخی</small>
                  )}
                </td>
                <td>{a.result}</td>
                <td>
                  <div className="flex flex-wrap gap-3 p-2">
                    <button onClick={() => setSelected(a)}>جزئیات</button>
                    {!a.deleted_at &&
                      !a.legacy_aggregate &&
                      (role === "qa_supervisor" ||
                        (role === "qa_controller" &&
                          a.controller_id === currentUser.id)) && (
                        <button
                          onClick={() => {
                            setEditing(a);
                            setScores(
                              a.form_type === "sales"
                                ? a.sales_scores || {}
                                : a.support_scores || {},
                            );
                            setComment(a.result_comment || "");
                          }}
                        >
                          ویرایش
                        </button>
                      )}
                    {!a.deleted_at &&
                      (role === "qa_supervisor" ||
                        (role === "qa_controller" &&
                          a.controller_id === currentUser.id)) && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (confirm("ارزیابی حذف موقت شود؟"))
                              execute(() => deleteAssessment(a.id, a.revision));
                          }}
                        >
                          حذف
                        </button>
                      )}
                    {a.deleted_at && role === "qa_supervisor" && (
                      <button
                        disabled={busy}
                        onClick={() => execute(() => restoreAssessment(a.id))}
                      >
                        بازیابی
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !rows.length && (
          <p className="p-5">ارزیابی مطابق فیلترها یافت نشد.</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          قبلی
        </button>
        <span>
          صفحه {toPersianDigits(page)} از{" "}
          {toPersianDigits(Math.max(1, Math.ceil(total / 25)))} —{" "}
          {toPersianDigits(total)} ارزیابی
        </span>
        <button
          disabled={page * 25 >= total || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          بعدی
        </button>
      </div>
      {selected && (
        <AuditDetailModal
          assessment={selected}
          onClose={() => {
            setSelected(null);
            setReload((n) => n + 1);
          }}
        />
      )}
      {editing && (
        <div className="fixed inset-0 z-50 p-4 bg-black/60 grid place-items-center">
          <form
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 bg-white dark:bg-slate-800 rounded-2xl space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await execute(async () => {
                await updateAssessment(editing.id, {
                  revision: editing.revision,
                  ...(editing.form_type === "sales"
                    ? { sales_scores: scores }
                    : { support_scores: scores }),
                  result_comment: comment,
                });
                setEditing(null);
              });
            }}
          >
            <h2 className="font-bold">اصلاح نمرات نسخهٔ اصلی</h2>
            <ScoreCorrectionEditor
              assessment={editing}
              scores={scores}
              onChange={setScores}
            />
            <textarea
              aria-label="کامنت اصلاح"
              className="w-full border rounded p-2 bg-transparent"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button disabled={busy}>ذخیرهٔ تأییدشده</button>
            <button type="button" onClick={() => setEditing(null)}>
              انصراف
            </button>
            {error && <p role="alert">{error}</p>}
          </form>
        </div>
      )}
      <ImportAssessmentsModal
        isOpen={importing}
        onClose={() => {
          setImporting(false);
          setReload((n) => n + 1);
        }}
      />
    </section>
  );
}
