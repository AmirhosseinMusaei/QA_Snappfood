import React, { useEffect, useState } from "react";
import { api } from "../utils/api.ts";
import { toPersianDigits } from "../utils/persian.ts";
export const SystemAuditLog = () => {
  const [rows, setRows] = useState<any[]>([]),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [search, setSearch] = useState(""),
    [entity, setEntity] = useState("all"),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api(
      `/api/audit-logs?page=${page}&limit=50&entity=${entity}&search=${encodeURIComponent(search)}`,
    )
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
  }, [page, search, entity]);
  return (
    <section className="max-w-7xl mx-auto p-4 space-y-4">
      <h1 className="font-bold text-xl">تاریخچهٔ تغییرات سامانه</h1>
      <div className="flex gap-3">
        <input
          aria-label="جستجوی لاگ"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="border rounded p-2 bg-transparent"
          placeholder="جستجو…"
        />
        <select
          aria-label="موجودیت لاگ"
          className="border rounded p-2 bg-transparent"
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
        >
          {[
            "all",
            "assessment",
            "dispute",
            "user",
            "agent",
            "team",
            "rubric",
            "fault",
            "settings",
            "problem",
          ].map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr>
              {["زمان", "کاربر", "بخش", "عملیات", "فیلد", "قبل", "بعد"].map(
                (t) => (
                  <th key={t} className="p-2">
                    {t}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t dark:border-slate-700">
                <td className="p-2">{r.created_at}</td>
                <td>{r.user_name}</td>
                <td>{r.entity}</td>
                <td>{r.action}</td>
                <td>{r.field}</td>
                <td className="max-w-64 break-words">{r.old_value}</td>
                <td className="max-w-64 break-words">{r.new_value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    </section>
  );
};
