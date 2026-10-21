import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.tsx";
import { api } from "../../utils/api.ts";
import { ScoreCorrectionEditor } from "../ScoreCorrectionEditor.tsx";
import { AuditDetailModal } from "../AuditDetailModal.tsx";
import { toPersianDigits, formatJalaliDate } from "../../utils/persian.ts";
import type { Assessment } from "../../types/index.ts";
export const DisputesQueue = () => {
  const { resolveDispute, role, currentUser, assessments } = useApp();
  const [rows, setRows] = useState<Assessment[]>([]),
    [status, setStatus] = useState("open"),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Assessment | null>(null),
    [editing, setEditing] = useState<Assessment | null>(null),
    [scores, setScores] = useState<Record<string, number>>({}),
    [comment, setComment] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    api(`/api/disputes?status=${status}&page=${page}`)
      .then((r) => {
        if (live) {
          setRows(r.data);
          setPages(r.total_pages);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [status, page, reload, assessments]);
  const decide = async (
    a: Assessment,
    state: "accepted" | "rejected" | "in_review",
  ) => {
    setBusy(true);
    setError("");
    try {
      await resolveDispute(
        a.id,
        state,
        comment.trim() || "در حال بررسی",
        state === "accepted" ? scores : undefined,
        { revision: a.revision, disputeId: a.dispute?.id },
      );
      setEditing(null);
      setReload((n) => n + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <h1 className="font-bold text-xl">کارتابل اعتراضات کارشناسان</h1>
      <select
        aria-label="وضعیت اعتراض"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
        className="border p-2 rounded bg-transparent"
      >
        {[
          ["open", "باز"],
          ["in_review", "در حال بررسی"],
          ["accepted", "پذیرفته‌شده"],
          ["rejected", "ردشده"],
          ["all", "همه"],
        ].map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      )}
      {rows.map((a) => (
        <article
          key={a.dispute!.id}
          className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 space-y-3"
        >
          <h2 className="font-bold">
            {a.dispute?.agent_name} — {a.dispute?.criterion_title}
          </h2>
          <p>{a.dispute?.agent_comment}</p>
          <p className="text-xs text-slate-500">
            {formatJalaliDate(a.dispute!.created_at)} — نمره{" "}
            {toPersianDigits(a.total_score)}
          </p>
          <button onClick={() => setSelected(a)}>جزئیات ارزیابی</button>
          {["qa_controller", "qa_supervisor"].includes(role) &&
            (role === "qa_supervisor" || a.controller_id === currentUser.id) &&
            ["open", "in_review"].includes(a.dispute!.status) && (
              <button
                className="mr-4 text-sky-600"
                onClick={() => {
                  setEditing(a);
                  setScores({});
                  setComment("");
                }}
              >
                رسیدگی
              </button>
            )}
        </article>
      ))}
      {!rows.length && <p>اعتراضی در این وضعیت وجود ندارد.</p>}
      <div className="flex gap-4">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          قبلی
        </button>
        <span>
          {toPersianDigits(page)} / {toPersianDigits(pages)}
        </span>
        <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
          بعدی
        </button>
      </div>
      {selected && (
        <AuditDetailModal
          assessment={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 grid place-items-center">
          <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full space-y-4">
            <h2 className="font-bold">اصلاح معیار مورد اعتراض</h2>
            <ScoreCorrectionEditor
              assessment={editing}
              criterionId={editing.dispute?.criterion_id}
              scores={scores}
              onChange={setScores}
            />
            <textarea
              aria-label="دلیل تصمیم"
              className="w-full border p-2 rounded bg-transparent"
              placeholder="دلیل پذیرش یا رد"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            {error && <p role="alert">{error}</p>}
            <div className="flex flex-wrap gap-4">
              <button
                disabled={
                  busy || !comment.trim() || !Object.keys(scores).length
                }
                onClick={() => decide(editing, "accepted")}
              >
                پذیرش و محاسبه مجدد
              </button>
              <button
                disabled={busy || !comment.trim()}
                onClick={() => decide(editing, "rejected")}
              >
                رد اعتراض
              </button>
              <button
                disabled={busy}
                onClick={() => decide(editing, "in_review")}
              >
                در حال بررسی
              </button>
              <button disabled={busy} onClick={() => setEditing(null)}>
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
