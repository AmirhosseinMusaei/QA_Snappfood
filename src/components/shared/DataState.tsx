import React from "react";
export function DataState({
  loading,
  error,
}: {
  loading: boolean;
  error: string;
}) {
  return error ? (
    <p
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
    >
      {error}
    </p>
  ) : loading ? (
    <p role="status" className="p-3 text-xs text-slate-500">
      در حال دریافت اطلاعات…
    </p>
  ) : null;
}
export function PageControls({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return pages > 1 || page > 1 ? (
    <nav
      aria-label="صفحه‌بندی"
      className="flex items-center justify-center gap-4 p-3 text-xs"
    >
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border px-3 py-2 disabled:opacity-40"
      >
        قبلی
      </button>
      <span>
        {page} / {pages}
      </span>
      <button
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border px-3 py-2 disabled:opacity-40"
      >
        بعدی
      </button>
    </nav>
  ) : null;
}
