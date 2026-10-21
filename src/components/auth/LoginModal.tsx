import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  LogIn,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";
import { UserRole } from "../../types/index.ts";

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

const QUICK_USERS: Array<{
  label: string;
  username: string;
  role: UserRole;
  roleLabel: string;
  color: string;
}> = [];

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("لطفاً نام کاربری و رمز عبور را وارد فرمایید.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "نام کاربری یا رمز عبور اشتباه است.");
        return;
      }

      login(data.user);
      if (onClose) onClose();
    } catch (err: any) {
      setError("خطا در برقراری ارتباط با سرور. لطفاً مجدداً تلاش فرمایید.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (u: string) => {
    setUsername(u);
    setPassword("");
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 text-right">
        {/* Header with Snappfood QA brand */}
        <div className="flex items-center gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-sky-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              ورود به سامانه کیفیت اسنپ‌فود
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              احراز هویت امن با نشست HttpOnly و کنترل دسترسی RBAC
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              نام کاربری (Username)
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                aria-label="نام کاربری"
                placeholder="نام کاربری شما"
                className="w-full text-xs py-2.5 pr-9 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-left"
                dir="ltr"
              />
              <UserIcon className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              رمز عبور (Password)
            </label>
            <div className="relative">
              <input
                aria-label="رمز عبور"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="رمز عبور"
                className="w-full text-xs py-2.5 pr-9 pl-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-left"
                dir="ltr"
              />
              <Lock className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-600/20 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>ورود به سامانه</span>
              </>
            )}
          </button>
        </form>

        {/* Quick select demo accounts */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>انتخاب سریع حساب‌های مرجع (Demo Users):</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_USERS.map((u) => (
              <button
                key={u.username}
                type="button"
                onClick={() => handleQuickSelect(u.username)}
                className={`text-right p-2 rounded-xl text-[11px] border transition-all flex items-center gap-2 ${
                  username === u.username
                    ? "border-sky-500 bg-sky-50/70 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200 font-bold"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${u.color} shrink-0`} />
                <div className="truncate">
                  <div className="font-semibold truncate">{u.label}</div>
                  <div className="text-[9px] text-slate-400 truncate">
                    {u.roleLabel}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
