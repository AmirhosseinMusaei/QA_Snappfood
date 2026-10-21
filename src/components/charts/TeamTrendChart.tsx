import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Award,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Table as TableIcon,
  BarChart2,
  HelpCircle,
} from "lucide-react";
import type { Assessment, Agent, DepartmentType } from "../../types/index.ts";
import {
  calculatePerformanceTrend,
  TrendDataPoint,
  FilterOptions,
} from "../../utils/trendMetrics.ts";
import { toPersianDigits, formatScoreBadge } from "../../utils/persian.ts";

interface TeamTrendChartProps {
  title?: string;
  subtitle?: string;
  assessments: Assessment[];
  agents: Agent[];
  filterOptions?: FilterOptions;
  defaultGranularity?: "weekly" | "monthly";
  showScopeSelector?: boolean;
  availableTeams?: string[];
  selectedTeam?: string;
  onSelectTeam?: (team: string) => void;
  availableDepts?: DepartmentType[];
  selectedDept?: DepartmentType | "all";
  onSelectDept?: (dept: DepartmentType | "all") => void;
}

// Custom Tooltip component for Persian RTL chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data: TrendDataPoint = payload[0].payload;
    const badge = formatScoreBadge(data.avgScore);

    return (
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 min-w-[220px] text-right space-y-2.5 font-sans z-50">
        <div className="border-b border-slate-100 dark:border-slate-700/80 pb-2">
          <p className="text-xs font-bold text-slate-900 dark:text-white">
            {data.fullTitle || label}
          </p>
          <span className="text-[10px] text-slate-400">
            بررسی آماری دوره‌ای کنترل کیفیت
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">
              میانگین کیفیت:
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded-md font-bold text-xs ${badge.badgeClass}`}
              >
                {toPersianDigits(data.avgScore)}
              </span>
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                ({badge.label})
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">
              حجم ارزیابی‌ها:
            </span>
            <span className="font-bold font-mono text-sky-600 dark:text-sky-400">
              {toPersianDigits(data.volume)} مورد
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/50">
            <span>دامنه نمرات (کمترین / بیشترین):</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {toPersianDigits(data.minScore)} ~{" "}
              {toPersianDigits(data.maxScore)}
            </span>
          </div>

          {(data.lowScoreCount > 0 || data.fraudCount > 0) && (
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/50 space-y-1">
              {data.lowScoreCount > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>
                    {toPersianDigits(data.lowScoreCount)} ارزیابی زیر ۸۰
                    (نیازمند کوچینگ)
                  </span>
                </div>
              )}
              {data.fraudCount > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>
                    {toPersianDigits(data.fraudCount)} مورد تقلب/خطای بحرانی
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const TeamTrendChart: React.FC<TeamTrendChartProps> = ({
  title = "روند عملکرد کیفی و حجم ارزیابی‌ها",
  subtitle = "نمودار تحلیلی تغییرات هفتگی و ماهانه نمرات کیفیت و حجم تماس‌های بررسی‌شده",
  assessments,
  agents,
  filterOptions = {},
  defaultGranularity = "weekly",
  showScopeSelector = false,
  availableTeams = [],
  selectedTeam = "all",
  onSelectTeam,
  availableDepts = ["support", "sales"],
  selectedDept = "all",
  onSelectDept,
}) => {
  const [granularity, setGranularity] = useState<"weekly" | "monthly">(
    defaultGranularity,
  );
  const [viewMode, setViewMode] = useState<"composed" | "score" | "volume">(
    "composed",
  );
  const [showTable, setShowTable] = useState(false);

  // Combine filters
  const effectiveFilters: FilterOptions = useMemo(() => {
    return {
      ...filterOptions,
      team: selectedTeam !== "all" ? selectedTeam : filterOptions.team,
      department:
        selectedDept !== "all" ? selectedDept : filterOptions.department,
    };
  }, [filterOptions, selectedTeam, selectedDept]);

  // Calculate metrics
  const { data, summary } = useMemo(() => {
    return calculatePerformanceTrend(
      assessments,
      agents,
      effectiveFilters,
      granularity,
    );
  }, [assessments, agents, effectiveFilters, granularity]);

  // Compute dynamic domain for score Y-axis
  const scoreDomain = useMemo<[number, number]>(() => {
    if (data.length === 0) return [60, 100];
    const minVal = Math.min(...data.map((d) => d.avgScore));
    const floor = Math.max(0, Math.floor((minVal - 10) / 10) * 10);
    return [floor, 100];
  }, [data]);

  const isScoreImproving = summary.scoreDelta >= 0;

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 transition-colors">
      {/* 1. Header with Title & Granularity Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Optional Team / Department selector */}
          {showScopeSelector && onSelectTeam && availableTeams.length > 0 && (
            <select
              value={selectedTeam}
              onChange={(e) => onSelectTeam(e.target.value)}
              className="text-xs py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
            >
              <option value="all">همه تیم‌ها</option>
              {availableTeams.map((t) => (
                <option key={t} value={t}>
                  تیم {t}
                </option>
              ))}
            </select>
          )}

          {showScopeSelector && onSelectDept && (
            <select
              value={selectedDept}
              onChange={(e) => onSelectDept(e.target.value as any)}
              className="text-xs py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium"
            >
              <option value="all">همه بخش‌ها</option>
              <option value="support">پشتیبانی تجاری</option>
              <option value="sales">فروش و بازاریابی</option>
            </select>
          )}

          {/* Granularity Toggle: Weekly vs Monthly */}
          <div className="bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-600">
            <button
              type="button"
              onClick={() => setGranularity("weekly")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                granularity === "weekly"
                  ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              روند هفتگی (Weekly)
            </button>
            <button
              type="button"
              onClick={() => setGranularity("monthly")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                granularity === "monthly"
                  ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              روند ماهانه (Monthly)
            </button>
          </div>

          {/* View Mode: Composed vs Score vs Volume */}
          <div className="bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-600">
            <button
              type="button"
              onClick={() => setViewMode("composed")}
              title="نمای ترکیبی"
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                viewMode === "composed"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              ترکیبی
            </button>
            <button
              type="button"
              onClick={() => setViewMode("score")}
              title="فقط نمرات"
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                viewMode === "score"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              فقط نمره
            </button>
            <button
              type="button"
              onClick={() => setViewMode("volume")}
              title="فقط حجم ارزیابی"
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                viewMode === "volume"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              فقط حجم
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Performance Indicators Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Overall Average */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-750/70 border border-slate-100 dark:border-slate-700/60 space-y-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            میانگین کیفیت دوره
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {toPersianDigits(
                summary.totalVolume ? summary.overallAvgScore : "—",
              )}
            </span>
            <div
              className={`flex items-center text-[10px] font-bold ${
                isScoreImproving ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {!summary.totalVolume ? (
                <span>—</span>
              ) : isScoreImproving ? (
                <>
                  <TrendingUp className="w-3 h-3 ml-0.5" />
                  <span>+{toPersianDigits(summary.scoreDelta)}</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-3 h-3 ml-0.5" />
                  <span>{toPersianDigits(summary.scoreDelta)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Metric 2: Total Volume */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-750/70 border border-slate-100 dark:border-slate-700/60 space-y-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            کل ارزیابی‌های انجام‌شده
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400">
              {toPersianDigits(summary.totalVolume)}
            </span>
            <span className="text-[10px] text-slate-400">
              {granularity === "weekly" ? "در بازه هفتگی" : "در بازه ماهانه"}
            </span>
          </div>
        </div>

        {/* Metric 3: Best Period */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-750/70 border border-slate-100 dark:border-slate-700/60 space-y-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <Award className="w-3 h-3 text-amber-500" />
            <span>بهترین بازه کیفی</span>
          </span>
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
            {summary.bestPeriod ? (
              <span>
                {summary.bestPeriod.label} (
                {toPersianDigits(summary.bestPeriod.score)})
              </span>
            ) : (
              "-"
            )}
          </div>
        </div>

        {/* Metric 4: Standard Target */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-750/70 border border-slate-100 dark:border-slate-700/60 space-y-1">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-500" />
            <span>تارگت کیفیت سازمان</span>
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              ۹۰ امتیاز
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-semibold">
              استاندارد
            </span>
          </div>
        </div>
      </div>

      {/* 3. The Recharts Canvas */}
      {data.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            داده‌ای در این فیلتر زمانی یافت نشد
          </p>
          <p className="text-xs text-slate-400 mt-1">
            لطفاً فیلتر تیم یا بازه زمانی را تغییر دهید.
          </p>
        </div>
      ) : (
        <div className="w-full h-80 pt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 15, right: 20, left: 10, bottom: 25 }}
            >
              <defs>
                <linearGradient
                  id="volumeBarGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient
                  id="scoreAreaGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#0284c7" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#94a3b8"
                opacity={0.2}
              />

              <XAxis
                dataKey="label"
                tick={{
                  fill: "#64748b",
                  fontSize: 11,
                  fontFamily: "Vazirmatn, sans-serif",
                }}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                dy={8}
              />

              {/* Left Y Axis for Scores */}
              {(viewMode === "composed" || viewMode === "score") && (
                <YAxis
                  yAxisId="score"
                  domain={scoreDomain}
                  orientation="left"
                  tick={{
                    fill: "#0284c7",
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickFormatter={(val) => toPersianDigits(val)}
                  label={{
                    value: "میانگین نمره (۰-۱۰۰)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#64748b",
                    fontSize: 10,
                    style: { textAnchor: "middle", fontFamily: "Vazirmatn" },
                  }}
                />
              )}

              {/* Right Y Axis for Volume */}
              {(viewMode === "composed" || viewMode === "volume") && (
                <YAxis
                  yAxisId="volume"
                  orientation="right"
                  tick={{
                    fill: "#0284c7",
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickFormatter={(val) => toPersianDigits(val)}
                  label={{
                    value: "تعداد ارزیابی",
                    angle: 90,
                    position: "insideRight",
                    fill: "#64748b",
                    fontSize: 10,
                    style: { textAnchor: "middle", fontFamily: "Vazirmatn" },
                  }}
                />
              )}

              <Tooltip content={<CustomTooltip />} />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{
                  paddingBottom: "10px",
                  fontSize: "11px",
                  fontFamily: "Vazirmatn",
                }}
                formatter={(value) => {
                  if (value === "avgScore") return "میانگین نمره کیفیت";
                  if (value === "volume") return "حجم ارزیابی‌ها";
                  return value;
                }}
              />

              {/* QA standard reference line */}
              {(viewMode === "composed" || viewMode === "score") && (
                <ReferenceLine
                  yAxisId="score"
                  y={90}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={1.8}
                  label={{
                    value: "تارگت کیفیت (۹۰)",
                    position: "insideTopLeft",
                    fill: "#059669",
                    fontSize: 10,
                    fontFamily: "Vazirmatn",
                  }}
                />
              )}

              {/* Volume Bars */}
              {(viewMode === "composed" || viewMode === "volume") && (
                <Bar
                  yAxisId="volume"
                  dataKey="volume"
                  name="volume"
                  fill="url(#volumeBarGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
              )}

              {/* Score Line */}
              {(viewMode === "composed" || viewMode === "score") && (
                <Line
                  yAxisId="score"
                  type="monotone"
                  dataKey="avgScore"
                  name="avgScore"
                  stroke="#0284c7"
                  strokeWidth={2.8}
                  dot={{
                    r: 4,
                    fill: "#0284c7",
                    strokeWidth: 2,
                    stroke: "#ffffff",
                  }}
                  activeDot={{
                    r: 6,
                    fill: "#0284c7",
                    strokeWidth: 2,
                    stroke: "#ffffff",
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 4. Table toggle & detailed numeric breakdown */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>
            {showTable
              ? "بستن جدول ریز داده‌ها"
              : "مشاهده جدول تفکیکی اعداد دوره"}
          </span>
          {showTable ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {showTable && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs text-right divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-750 font-bold text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-3">بازه زمانی</th>
                  <th className="py-2.5 px-3">تعداد ارزیابی</th>
                  <th className="py-2.5 px-3">میانگین نمره</th>
                  <th className="py-2.5 px-3">کمترین / بیشترین</th>
                  <th className="py-2.5 px-3">موارد نیازمند کوچینگ (&lt;۸۰)</th>
                  <th className="py-2.5 px-3">تقلب/بحرانی</th>
                  <th className="py-2.5 px-3">وضعیت کیفی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-600 dark:text-slate-300">
                {data.map((row) => {
                  const badge = formatScoreBadge(row.avgScore);
                  return (
                    <tr
                      key={row.key}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30"
                    >
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {row.label}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        {toPersianDigits(row.volume)}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {toPersianDigits(row.avgScore)}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                        {toPersianDigits(row.minScore)} ~{" "}
                        {toPersianDigits(row.maxScore)}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        {row.lowScoreCount > 0 ? (
                          <span className="text-amber-600 font-bold">
                            {toPersianDigits(row.lowScoreCount)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        {row.fraudCount > 0 ? (
                          <span className="text-rose-600 font-bold">
                            {toPersianDigits(row.fraudCount)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.badgeClass}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
