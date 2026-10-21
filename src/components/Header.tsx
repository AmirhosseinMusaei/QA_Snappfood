import React, { useState } from 'react';
import {
  ShieldCheck,
  Moon,
  Sun,
  Database,
  UserCheck,
  Inbox,
  BarChart3,
  Users,
  Settings,
  HelpCircle,
  FileEdit,
  Menu,
  X,
  Compass,
  FileSpreadsheet,
  CheckCircle2,
  Activity,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { UserRole } from '../types/index.ts';
import { toPersianDigits } from '../utils/persian.ts';

const ROLE_LABELS: Record<UserRole, { title: string; color: string; desc: string }> = {
  agent: { title: 'کارشناس (Agent)', color: 'bg-emerald-500', desc: 'مشاهده کارنامه، نمرات و ثبت اعتراض' },
  team_lead: { title: 'سرپرست تیم (Lead)', color: 'bg-indigo-500', desc: 'روند تیم، صندوق نیازمند بررسی و تارگت ۴۰' },
  manager: { title: 'مدیر واحد (Manager)', color: 'bg-purple-500', desc: 'تحلیل کلان، مقایسه تیم‌ها و رتبه‌بندی' },
  qa_controller: { title: 'کنترلر کیفیت (QA)', color: 'bg-sky-500', desc: 'میز ارزیابی، بازشنوایی و رسیدگی به اعتراضات' },
  qa_supervisor: { title: 'سوپروایزر (Supervisor)', color: 'bg-amber-500', desc: 'نظارت جامع، مدیریت رستر و دسترسی کامل' },
  admin: { title: 'ادمین سیستم (Admin)', color: 'bg-rose-500', desc: 'تنظیمات رابریک، کاربران و داده‌ها' },
};

export const Header: React.FC<{ onOpenBackupModal: () => void }> = ({ onOpenBackupModal }) => {
  const {
    role,
    setRole,
    theme,
    toggleTheme,
    activeTab,
    setActiveTab,
    assessments,
    currentAgentId,
    setCurrentAgentId,
    agents,
    currentUser,
    isAuthenticated,
    logout,
    setShowLoginModal,
  } = useApp();

  // Permit DEV_ROLE_SWITCH only in explicitly configured development
  const isDevRoleSwitch = import.meta.env.VITE_DEV_ROLE_SWITCH === 'true';

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Count pending items for badges
  const needToCheckCount = assessments.filter(
    (a) => a.result === 'Need to check' && !a.team_lead_reviewed
  ).length;
  const pendingDisputesCount = assessments.filter((a) => a.dispute?.status === 'pending').length;

  const currentAgent = agents.find((a) => a.id === currentAgentId) || agents[0];

  const handleTabClick = (tabKey: string) => {
    setActiveTab(tabKey);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          {/* Brand Wordmark & Logo */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center text-white shadow-sm shadow-sky-500/20">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                  <span className="hidden sm:inline">سامانه کیفیت </span>اسنپ‌فود
                </span>
                <span className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hidden md:inline-block">
                  عملیات تجاری
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links based on active role */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
            {/* QA Controller / Supervisor / Admin: New Evaluation */}
            {(role === 'qa_controller' || role === 'qa_supervisor' || role === 'admin') && (
              <button
                type="button"
                onClick={() => handleTabClick('workspace')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'workspace'
                    ? 'bg-sky-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>میز ارزیابی جدید</span>
              </button>
            )}

            {/* Agent: My Scorecard */}
            {role === 'agent' && (
              <button
                type="button"
                onClick={() => handleTabClick('agent_view')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'agent_view'
                    ? 'bg-sky-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>کارنامه و نمرات من</span>
              </button>
            )}

            {/* Team Lead: Team Dashboard & Trend Charts */}
            {(role === 'team_lead' || role === 'qa_supervisor' || role === 'admin') && (
              <button
                type="button"
                onClick={() => handleTabClick('team_view')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'team_view'
                    ? 'bg-sky-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>داشبورد و روند تیم</span>
              </button>
            )}

            {/* Need to Check Queue (Team Lead & QA) */}
            {(role === 'team_lead' || role === 'manager' || role === 'qa_supervisor' || role === 'admin') && (
              <button
                type="button"
                onClick={() => handleTabClick('need_to_check')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'need_to_check'
                    ? 'bg-amber-500 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Inbox className="w-4 h-4" />
                <span>صندوق نیازمند بررسی</span>
                {needToCheckCount > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      activeTab === 'need_to_check'
                        ? 'bg-white text-amber-600'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {toPersianDigits(needToCheckCount)}
                  </span>
                )}
              </button>
            )}

            {/* Disputes Queue (QA Controller, Supervisor, Admin) */}
            {(role === 'qa_controller' || role === 'qa_supervisor' || role === 'admin') && (
              <button
                type="button"
                onClick={() => handleTabClick('disputes')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'disputes'
                    ? 'bg-rose-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>رسیدگی به اعتراضات</span>
                {pendingDisputesCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white animate-pulse">
                    {toPersianDigits(pendingDisputesCount)}
                  </span>
                )}
              </button>
            )}

            {/* Manager: Executive Analytics */}
            {(role === 'manager' || role === 'qa_supervisor' || role === 'admin') && (
              <button
                type="button"
                onClick={() => handleTabClick('manager_view')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'manager_view'
                    ? 'bg-purple-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>تحلیل کلان واحدها</span>
              </button>
            )}

            {/* Universal Audits History */}
            <button
              type="button"
              onClick={() => handleTabClick('audits')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'audits'
                  ? 'bg-sky-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>تاریخچه ارزیابی‌ها</span>
            </button>

            {/* Admin: System Settings */}
            {(role === 'admin' || role === 'qa_supervisor') && (
              <button
                type="button"
                onClick={() => handleTabClick('admin_view')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'admin_view'
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>تنظیمات و رستر</span>
              </button>
            )}

            {/* System Audit Log (QA Controller, Supervisor, Admin) */}
            {(role === 'qa_controller' || role === 'qa_supervisor' || role === 'admin') && (
              <button
                type="button"
                onClick={() => handleTabClick('system_audit_log')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === 'system_audit_log'
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>لاگ ممیزی سیستم</span>
              </button>
            )}
          </nav>

          {/* Right Action Cluster: Role Switcher & Utilities */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Role Switcher Button (Gated behind DEV_ROLE_SWITCH in production) */}
            {isDevRoleSwitch && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors shadow-2xs"
                  title="تغییر نقش کاربری جهت تست آسان تمام امکانات (محیط توسعه)"
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${ROLE_LABELS[role].color}`} />
                  <span className="font-bold">نقش: {ROLE_LABELS[role].title.split(' ')[0]}</span>
                  <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                    DEV
                  </span>
                  {pendingDisputesCount > 0 && role === 'qa_controller' && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </button>

                {/* Role Dropdown */}
                {roleMenuOpen && (
                  <div
                    className="absolute left-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl py-2 z-50 text-right"
                    onMouseLeave={() => setRoleMenuOpen(false)}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700/80 mb-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                          تغییر سریع سطح دسترسی
                        </span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          DEV_ROLE_SWITCH
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        مشاهده دقیق امکانات سامانه از زاویه دید هر کاربر
                      </span>
                    </div>

                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => {
                      const info = ROLE_LABELS[r];
                      const isSelected = role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setRole(r);
                            setRoleMenuOpen(false);
                            if (r === 'agent') setActiveTab('agent_view');
                            else if (r === 'team_lead') setActiveTab('team_view');
                            else if (r === 'manager') setActiveTab('manager_view');
                          }}
                          className={`w-full text-right px-3.5 py-2.5 flex items-start gap-2.5 transition-colors ${
                            isSelected
                              ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200 font-medium'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${info.color}`}
                          />
                          <div className="flex-1">
                            <div className="text-xs font-bold flex items-center justify-between">
                              <span>{info.title}</span>
                              {isSelected && (
                                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                                  فعال
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {info.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {/* Agent identity select if in agent role */}
                    {role === 'agent' && (
                      <div className="p-3 border-t border-slate-100 dark:border-slate-700/80 mt-1 bg-slate-50/50 dark:bg-slate-900/40">
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                          انتخاب کارشناس فعال جهت نمایش کارنامه:
                        </label>
                        <select
                          value={currentAgentId}
                          onChange={(e) => setCurrentAgentId(e.target.value)}
                          className="w-full text-xs p-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                        >
                          {agents.map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {ag.name} ({ag.team} - {toPersianDigits(ag.source_id)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* User Profile Pill & Login / Logout */}
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200 dark:border-slate-800">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                title={`کاربر: ${currentUser?.name || ''} (${currentUser?.username || ''})`}
              >
                <span className={`w-2 h-2 rounded-full ${ROLE_LABELS[role].color}`} />
                <span className="font-bold text-slate-800 dark:text-slate-200 hidden sm:inline max-w-[110px] truncate">
                  {currentUser?.name || 'کاربر'}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold border border-slate-200/60 dark:border-slate-600">
                  {ROLE_LABELS[role].title.split(' ')[0]}
                </span>
              </div>

              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={logout}
                  className="p-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                  title="خروج از حساب کاربری"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  title="ورود با نام کاربری و رمز عبور"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>ورود</span>
                </button>
              )}
            </div>

            {/* Backup / Seed Data Modal Trigger */}
            <button
              type="button"
              onClick={onOpenBackupModal}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="پشتیبان‌گیری و بازنشانی داده‌های نمونه"
            >
              <Database className="w-4 h-4" />
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={theme === 'dark' ? 'حالت روز' : 'حالت شب'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Mobile Menu Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="منوی ناوبری"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
          {(role === 'qa_controller' || role === 'qa_supervisor' || role === 'admin') && (
            <button
              type="button"
              onClick={() => handleTabClick('workspace')}
              className={`w-full text-right p-2.5 rounded-xl text-xs font-semibold ${
                activeTab === 'workspace'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              میز ارزیابی جدید
            </button>
          )}

          {role === 'agent' && (
            <button
              type="button"
              onClick={() => handleTabClick('agent_view')}
              className={`w-full text-right p-2.5 rounded-xl text-xs font-semibold ${
                activeTab === 'agent_view'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              کارنامه و نمرات من
            </button>
          )}

          {(role === 'team_lead' || role === 'qa_supervisor' || role === 'admin') && (
            <button
              type="button"
              onClick={() => handleTabClick('team_view')}
              className={`w-full text-right p-2.5 rounded-xl text-xs font-semibold ${
                activeTab === 'team_view'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              داشبورد و روند تیم
            </button>
          )}

          {(role === 'team_lead' || role === 'manager' || role === 'qa_supervisor' || role === 'admin') && (
            <button
              type="button"
              onClick={() => handleTabClick('need_to_check')}
              className={`w-full text-right p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                activeTab === 'need_to_check'
                  ? 'bg-amber-500 text-white font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>صندوق نیازمند بررسی</span>
              {needToCheckCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-amber-600">
                  {toPersianDigits(needToCheckCount)}
                </span>
              )}
            </button>
          )}

          {(role === 'qa_controller' || role === 'qa_supervisor' || role === 'admin') && (
            <button
              type="button"
              onClick={() => handleTabClick('disputes')}
              className={`w-full text-right p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                activeTab === 'disputes'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>رسیدگی به اعتراضات</span>
              {pendingDisputesCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                  {toPersianDigits(pendingDisputesCount)}
                </span>
              )}
            </button>
          )}

          {(role === 'manager' || role === 'qa_supervisor' || role === 'admin') && (
            <button
              type="button"
              onClick={() => handleTabClick('manager_view')}
              className={`w-full text-right p-2.5 rounded-xl text-xs font-semibold ${
                activeTab === 'manager_view'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              تحلیل کلان واحدها
            </button>
          )}

          <button
            type="button"
            onClick={() => handleTabClick('audits')}
            className={`w-full text-right p-2.5 rounded-xl text-xs font-semibold ${
              activeTab === 'audits'
                ? 'bg-sky-600 text-white font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            تاریخچه ارزیابی‌ها
          </button>

          {(role === 'admin' || role === 'qa_supervisor') && (
            <button
              type="button"
              onClick={() => handleTabClick('admin_view')}
              className={`w-full text-right p-2.5 rounded-xl text-xs font-semibold ${
                activeTab === 'admin_view'
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              تنظیمات و رستر
            </button>
          )}
        </div>
      )}
    </header>
  );
};
