import React, { useState } from "react";
import {
  AlertCircle,
  Plus,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  User,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { ProblemItem } from "../types/index.ts";
import { toPersianDigits, getJalaliDateString } from "../utils/persian.ts";

const PRIORITY_BADGES: Record<string, string> = {
  Critical:
    "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold",
  High: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold",
  Medium: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  Low: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
};

export const ProblemsTracker: React.FC = () => {
  const {
    problems,
    addProblem,
    updateProblem,
    deleteProblem,
    teams,
    currentUser,
  } = useApp();

  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "Pending" | "Resolved"
  >("all");

  const [showAddModal, setShowAddModal] = useState(false);
  const [problemForm, setProblemForm] = useState({
    title: "",
    description: "",
    team: "Technical",
    category: "Process problem",
    priority: "High" as ProblemItem["priority"],
    owner: currentUser.name || "سرپرست تیم",
    issue_date: getJalaliDateString(),
  });

  const filteredProblems = problems.filter((p) => {
    if (filterTeam !== "all" && p.team !== filterTeam) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.owner.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemForm.title.trim()) return;

    try {
      await addProblem({
        ...problemForm,
        status: "Pending",
      });

      setShowAddModal(false);
      setProblemForm({
        title: "",
        description: "",
        team: "Technical",
        category: "Process problem",
        priority: "High",
        owner: currentUser.name || "سرپرست تیم",
        issue_date: getJalaliDateString(),
      });
    } catch {}
  };

  const handleToggleStatus = (p: ProblemItem) => {
    const isNowResolved = p.status === "Pending";
    updateProblem(p.id, {
      status: isNowResolved ? "Resolved" : "Pending",
      resolved_at: isNowResolved ? getJalaliDateString() : undefined,
    }).catch(() => {});
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              ثبت و پیگیری مشکلات سیستمی و فرآیندی (Cross-Team Problems Tracker)
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
              {toPersianDigits(
                problems.filter((p) => p.status === "Pending").length,
              )}{" "}
              مشکل باز
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            ردگیری و حل موانع بین‌تیمی، مغایرت‌های فنی و باگ‌های گزارش‌شده از
            طریق ارزیابی‌ها
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت مشکل جدید (New Problem)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="جستجو در عنوان، شرح یا مسئول مشکل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-8 pl-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
          >
            <option value="all">همه تیم‌ها</option>
            {teams.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="Pending">در انتظار حل (Pending)</option>
            <option value="Resolved">حل شده (Resolved)</option>
          </select>
        </div>
      </div>

      {/* Problems List */}
      <div className="space-y-3">
        {filteredProblems.map((p) => (
          <div
            key={p.id}
            className={`p-4 rounded-xl border transition ${
              p.status === "Resolved"
                ? "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/60 opacity-80"
                : "bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-900/60 shadow-2xs"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] ${PRIORITY_BADGES[p.priority]}`}
                >
                  اولویت: {p.priority}
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  {p.title}
                </span>
                <span className="text-[10px] px-2 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                  {p.team} · {p.category}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400">
                  تاریخ: {toPersianDigits(p.issue_date)}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] text-slate-500">
                  مسئول: {p.owner}
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleStatus(p)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition ${
                    p.status === "Resolved"
                      ? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  <Check className="w-3 h-3" />
                  <span>
                    {p.status === "Resolved" ? "حل شد" : "تغییر به حل‌شده"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => deleteProblem(p.id).catch(() => {})}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                  title="حذف"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              {p.description}
            </p>

            {p.solution_note && (
              <div className="mt-2 text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200">
                <strong>نتیجه اقدام اصلاحی:</strong> {p.solution_note}
              </div>
            )}
          </div>
        ))}

        {filteredProblems.length === 0 && (
          <div className="py-10 text-center text-slate-400">
            مشکلی مطابق با فیلتر انتخابی یافت نشد.
          </div>
        )}
      </div>

      {/* Modal: New Problem */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>ثبت مشکل سیستمی یا فرآیندی جدید</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  عنوان مشکل:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: قطعی وب‌سرویس استعلام منوی وندورها"
                  value={problemForm.title}
                  onChange={(e) =>
                    setProblemForm({ ...problemForm, title: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    تیم درگیر:
                  </label>
                  <select
                    value={problemForm.team}
                    onChange={(e) =>
                      setProblemForm({ ...problemForm, team: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    اولویت:
                  </label>
                  <select
                    value={problemForm.priority}
                    onChange={(e) =>
                      setProblemForm({
                        ...problemForm,
                        priority: e.target.value as any,
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    <option value="Critical">بحرانی (Critical)</option>
                    <option value="High">بالا (High)</option>
                    <option value="Medium">متوسط (Medium)</option>
                    <option value="Low">کم (Low)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  شرح دقیق مشکل و اثر بر تماس‌ها:
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="شرح جزئیات..."
                  value={problemForm.description}
                  onChange={(e) =>
                    setProblemForm({
                      ...problemForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold"
                >
                  ثبت مشکل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
