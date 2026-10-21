import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.tsx";
import { api } from "../../utils/api.ts";
import {
  dateToJalali,
  JALALI_MONTHS,
  toPersianDigits,
  formatScoreBadge,
} from "../../utils/persian.ts";
import { AuditsHistory } from "../AuditsHistory.tsx";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
export function MonthlyDashboard({
  kind = "reports",
}: {
  kind?: "agent" | "lead" | "manager" | "reports";
}) {
  const { currentUser, activeTab, settings } = useApp();
  const now = dateToJalali(new Date());
  const [quality, setQuality] = useState("all");
  const [year, setYear] = useState(now.year),
    [month, setMonth] = useState(now.month),
    [data, setData] = useState<any>(null),
    [history, setHistory] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    const periods = [0, 1, 2].map((i) => {
      const value = year * 12 + month - 1 - i;
      return { year: Math.floor(value / 12), month: (value % 12) + 1 };
    });
    Promise.all(
      periods.map((p) =>
        api(`/api/monthly-scores?year=${p.year}&month=${p.month}`),
      ),
    )
      .then((result) => {
        if (current) {
          setData(result[0].data);
          setHistory(result.map((r) => r.data).reverse());
        }
      })
      .catch((e) => {
        if (current) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [year, month, currentUser.id]);
  const score = (value: number | null | undefined) =>
    value === null || value === undefined
      ? "بدون ارزیابی"
      : toPersianDigits(value);
  const rows: any[] = data?.rows || [];
  const self = rows.find(
    (r) =>
      r.agent.user_id === currentUser.id || r.agent.id === currentUser.agent_id,
  );
  const selected = kind === "agent" ? (self ? [self] : []) : rows;
  const visible =
    quality === "all" ? selected : selected.filter((r) => r.status === quality);
  const scored = selected.filter((r) => r.finalMonthlyScore !== null);
  const overall = scored.length
    ? Math.round(
        (scored.reduce((n, r) => n + r.finalMonthlyScore, 0) / scored.length) *
          10,
      ) / 10
    : null;
  const trend = history.map((report) => {
    const list = report.rows.filter(
      (r: any) => kind !== "agent" || r.agent.id === currentUser.agent_id,
    );
    const values = list.filter((r: any) => r.finalMonthlyScore !== null);
    return {
      title: JALALI_MONTHS[report.period.month - 1],
      score: values.length
        ? Math.round(
            (values.reduce((n: number, r: any) => n + r.finalMonthlyScore, 0) /
              values.length) *
              10,
          ) / 10
        : null,
    };
  });
  const three = trend.filter((t) => t.score !== null);
  const threeAvg = three.length
    ? Math.round(
        (three.reduce((n, t) => n + t.score!, 0) / three.length) * 10,
      ) / 10
    : null;
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" dir="rtl">
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">
            {kind === "agent"
              ? "کارنامه و نمرات من"
              : kind === "lead"
                ? "داشبورد تیم من"
                : kind === "manager"
                  ? "داشبورد واحد"
                  : "گزارش‌های کیفیت"}
          </h1>
          <p className="text-xs mt-2 text-slate-500">
            ماه شمسی بر اساس زمان تهران؛ نمره نهایی با اعمال قواعد همان ماه
          </p>
        </div>
        <div className="flex gap-2">
          <input
            aria-label="سال گزارش"
            className="w-24 p-2 rounded border bg-transparent"
            type="number"
            min={1200}
            max={1600}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <select
            aria-label="ماه گزارش"
            className="p-2 rounded border dark:bg-slate-800"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {JALALI_MONTHS.map((m, i) => (
              <option value={i + 1} key={m}>
                {m}
              </option>
            ))}
          </select>
          {currentUser.role !== "agent" && (
            <a
              className="rounded-xl px-4 py-2 bg-sky-600 text-white"
              href={`/api/export/monthly-scores.xlsx?year=${year}&month=${month}`}
            >
              خروجی اکسل
            </a>
          )}
        </div>
      </section>
      {error && (
        <p role="alert" className="text-rose-600">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">در حال دریافت گزارش…</p>
      ) : (
        data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                ["نمره نهایی ماه", score(overall)],
                [
                  "تعداد ارزیابی",
                  toPersianDigits(
                    selected.reduce((n, r) => n + r.assessmentCount, 0),
                  ),
                ],
                ["میانگین سه ماه", score(threeAvg)],
              ].map(([title, value]) => (
                <div
                  key={title}
                  className="p-5 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700"
                >
                  <p className="text-sm text-slate-500">{title}</p>
                  <strong className="text-2xl mt-3 block">{value}</strong>
                </div>
              ))}
            </div>
            <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 border dark:border-slate-700">
              <h2 className="font-bold mb-4">روند نمره نهایی سه ماه</h2>
              <div dir="ltr" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <XAxis dataKey="title" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar
                      dataKey="score"
                      name="نمره نهایی"
                      fill="#0284c7"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500">
                ماه بدون ارزیابی از میانگین سه‌ماهه حذف می‌شود؛ میانگین تیم،
                میانگین برابر نمرات نهایی افراد دارای ارزیابی است.
              </p>
            </section>
            <section className="overflow-x-auto bg-white dark:bg-slate-800 rounded-2xl p-4 border dark:border-slate-700">
              <select
                aria-label="سطح کیفیت"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="border p-2 rounded dark:bg-slate-800"
              >
                <option value="all">همه سطوح</option>
                <option value="high_quality">کیفیت بالا</option>
                <option value="low_quality">کیفیت پایین</option>
                <option value="no_assessments">بدون ارزیابی</option>
              </select>
              <table className="w-full text-sm text-right">
                <thead>
                  <tr>
                    {[
                      "کارشناس",
                      "تیم",
                      "نمره نهایی",
                      "میانگین خام",
                      "ماه قبل",
                      "تغییر",
                      "پوشش ارزیابی",
                      "تقلب",
                    ].map((t) => (
                      <th key={t} className="p-3">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr
                      key={r.agent.id}
                      className="border-t dark:border-slate-700"
                    >
                      <td className="p-3">{r.agent.name}</td>
                      <td>{r.agent.team_name}</td>
                      <td>
                        <span
                          className={
                            r.finalMonthlyScore === null
                              ? ""
                              : formatScoreBadge(r.finalMonthlyScore, {
                                  high: settings.high_quality_threshold,
                                  low: settings.low_quality_threshold,
                                }).textClass
                          }
                        >
                          {score(r.finalMonthlyScore)}
                        </span>
                      </td>
                      <td>{score(r.rawAverage)}</td>
                      <td>{score(r.previousScore)}</td>
                      <td>
                        {r.delta === null ? "—" : toPersianDigits(r.delta)}
                      </td>
                      <td>
                        {toPersianDigits(r.assessmentCount)} /{" "}
                        {toPersianDigits(r.target)}
                        <progress
                          className="block w-24"
                          max={r.target}
                          value={Math.min(r.target, r.assessmentCount)}
                        />
                      </td>
                      <td>{toPersianDigits(r.fraudCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!selected.length && (
                <p className="p-4">کارشناس قابل مشاهده‌ای وجود ندارد.</p>
              )}
            </section>
            <div className="grid lg:grid-cols-2 gap-4">
              <section className="rounded-2xl border dark:border-slate-700 p-5 bg-white dark:bg-slate-800">
                <h2 className="font-bold mb-3">معیارهای دارای بیشترین کسری</h2>
                {data.criteriaLoss.slice(0, 15).map((c: any) => (
                  <p key={c.id} className="text-sm py-1">
                    {c.title} — نسخه {toPersianDigits(c.formVersion)}:{" "}
                    {toPersianDigits(c.lostPoints)} امتیاز در{" "}
                    {toPersianDigits(c.count)} نمونه
                  </p>
                ))}
                {!data.criteriaLoss.length && (
                  <p>دادهٔ جزئی قابل تحلیل وجود ندارد.</p>
                )}
                {data.detailUnavailableCount > 0 && (
                  <p className="text-amber-600 text-xs mt-3">
                    {toPersianDigits(data.detailUnavailableCount)} رکورد تاریخی
                    فاقد جزئیات، در تحلیل معیارها لحاظ نشده است.
                  </p>
                )}
              </section>
              <section className="rounded-2xl border dark:border-slate-700 p-5 bg-white dark:bg-slate-800">
                <h2 className="font-bold mb-3">توزیع خطاها</h2>
                {data.faultDistribution.map((f: any) => (
                  <p key={f.id}>
                    {f.title}: {toPersianDigits(f.count)}
                  </p>
                ))}
                <p>خطای بک‌اند: {toPersianDigits(data.backendGeneralCount)}</p>
                {data.supportCategories.map((c: any) => (
                  <p key={c.title}>
                    {c.title}: {toPersianDigits(c.count)}
                  </p>
                ))}
              </section>
            </div>
            {kind !== "agent" && (
              <div className="grid lg:grid-cols-2 gap-4">
                <section className="p-5 rounded-2xl border dark:border-slate-700 bg-white dark:bg-slate-800">
                  <h2 className="font-bold">مقایسه تیم‌ها</h2>
                  {data.teams.map((t: any) => (
                    <p key={t.id} className="py-2">
                      {t.title}: {score(t.score)} —{" "}
                      {toPersianDigits(t.assessmentCount)} ارزیابی
                    </p>
                  ))}
                </section>
                <section className="p-5 rounded-2xl border dark:border-slate-700 bg-white dark:bg-slate-800">
                  <h2 className="font-bold">عملکرد کنترلرها نسبت به هدف</h2>
                  {data.controllers.map((c: any) => (
                    <p key={c.id} className="py-2">
                      {c.name}: {toPersianDigits(c.count)} /{" "}
                      {toPersianDigits(c.target)}
                    </p>
                  ))}
                </section>
              </div>
            )}
          </>
        )
      )}
      <AuditsHistory
        initialAgent={kind === "agent" ? currentUser.agent_id : undefined}
        initialResult={
          activeTab === "need_to_check" ? "Need to check" : undefined
        }
        initialYear={year}
        initialMonth={month}
      />
    </div>
  );
}
