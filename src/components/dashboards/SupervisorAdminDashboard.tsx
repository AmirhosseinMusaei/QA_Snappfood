import React, { useState, useMemo } from 'react';
import {
  Users,
  Settings,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { Agent, Fault, DepartmentType } from '../../types/index.ts';
import { toPersianDigits } from '../../utils/persian.ts';

export const SupervisorAdminDashboard: React.FC = () => {
  const {
    agents,
    addAgent,
    updateAgent,
    faults,
    addFault,
    updateFault,
    teams,
    controllers,
    teamLeads,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'agents' | 'faults' | 'productivity'>('agents');

  // New Agent Form Modal State
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentSourceId, setNewAgentSourceId] = useState('');
  const [newAgentDept, setNewAgentDept] = useState<DepartmentType>('sales');
  const [newAgentTeam, setNewAgentTeam] = useState('Campaign');
  const [newAgentLead, setNewAgentLead] = useState('نگین رضایی');
  const [newAgentController, setNewAgentController] = useState('meysam');

  // New Fault Form Modal State
  const [showAddFaultModal, setShowAddFaultModal] = useState(false);
  const [newFaultTitle, setNewFaultTitle] = useState('');
  const [newFaultDept, setNewFaultDept] = useState<DepartmentType | 'both'>('both');
  const [newFaultCategory, setNewFaultCategory] = useState('فرایندی');
  const [newFaultCritical, setNewFaultCritical] = useState(false);
  const [newFaultDesc, setNewFaultDesc] = useState('');

  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName || !newAgentSourceId) return;

    addAgent({
      name: newAgentName,
      source_id: newAgentSourceId,
      department: newAgentDept,
      team: newAgentTeam,
      team_lead: newAgentLead,
      controller: newAgentController,
      min_monthly_reviews: 40,
      active: true,
    });

    setNewAgentName('');
    setNewAgentSourceId('');
    setShowAddAgentModal(false);
  };

  const handleCreateFault = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaultTitle) return;

    addFault({
      title: newFaultTitle,
      department: newFaultDept,
      category: newFaultCategory,
      is_critical: newFaultCritical,
      description: newFaultDesc,
    });

    setNewFaultTitle('');
    setNewFaultDesc('');
    setShowAddFaultModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              تنظیمات سیستم، رستر کارشناسان و قوانین ارزیابی
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-semibold">
              سطح سوپروایزر و ادمین (Admin)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تعریف و ویرایش کارشناسان، ماتریس خطاها، سهمیه‌ها و نظارت بر بهره‌وری کنترلرها
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'agents' && (
            <button
              type="button"
              onClick={() => setShowAddAgentModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>افزودن کارشناس جدید</span>
            </button>
          )}

          {activeTab === 'faults' && (
            <button
              type="button"
              onClick={() => setShowAddFaultModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف خطای جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'agents'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>رستر و لیست کارشناسان ({toPersianDigits(agents.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('faults')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'faults'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>ماتریس خطاها و خطاهای بحرانی ({toPersianDigits(faults.length)})</span>
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'agents' ? (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">نام کارشناس</th>
                  <th className="py-2.5 px-3">کد سورس</th>
                  <th className="py-2.5 px-3">واحد</th>
                  <th className="py-2.5 px-3">تیم</th>
                  <th className="py-2.5 px-3">سرپرست تیم (Lead)</th>
                  <th className="py-2.5 px-3">کنترلر تخصیص‌یافته</th>
                  <th className="py-2.5 px-3">سهمیه ماهانه</th>
                  <th className="py-2.5 px-3">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {agents.map((ag) => (
                  <tr
                    key={ag.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition"
                  >
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                      {ag.name}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                      {toPersianDigits(ag.source_id)}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {ag.department === 'support' ? 'پشتیبانی' : 'فروش'}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {ag.team}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {ag.team_lead}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {ag.controller}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {toPersianDigits(ag.min_monthly_reviews)} ارزیابی
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => updateAgent(ag.id, { active: !ag.active })}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                          ag.active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {ag.active ? 'فعال' : 'غیرفعال'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Faults Tab */
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">عنوان خطا</th>
                  <th className="py-2.5 px-3">واحد مربوطه</th>
                  <th className="py-2.5 px-3">دسته‌بندی</th>
                  <th className="py-2.5 px-3">شرح و شرایط خطا</th>
                  <th className="py-2.5 px-3">نوع خطا</th>
                  <th className="py-2.5 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {faults.map((f) => (
                  <tr
                    key={f.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition"
                  >
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                      {f.title}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {f.department === 'both'
                        ? 'مشترک (پشتیبانی و فروش)'
                        : f.department === 'support'
                        ? 'پشتیبانی'
                        : 'فروش'}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {f.category}
                    </td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs">
                      {f.description || '-'}
                    </td>
                    <td className="py-3 px-3">
                      {f.is_critical ? (
                        <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold text-[11px]">
                          بحرانی (صفر شدن ارزیابی)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px]">
                          عادی
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-left">
                      <button
                        type="button"
                        onClick={() => updateFault(f.id, { is_critical: !f.is_critical })}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                      >
                        {f.is_critical ? 'تبدیل به عادی' : 'تبدیل به بحرانی'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Agent */}
      {showAddAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              افزودن کارشناس جدید به رستر
            </h3>

            <form onSubmit={handleCreateAgent} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">
                  نام و نام خانوادگی
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مریم کریمی"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    کد سورس (Source ID)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 3740"
                    value={newAgentSourceId}
                    onChange={(e) => setNewAgentSourceId(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    واحد
                  </label>
                  <select
                    value={newAgentDept}
                    onChange={(e) => setNewAgentDept(e.target.value as DepartmentType)}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  >
                    <option value="sales">فروش (Sales)</option>
                    <option value="support">پشتیبانی (Support)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    نام تیم
                  </label>
                  <select
                    value={newAgentTeam}
                    onChange={(e) => setNewAgentTeam(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  >
                    {teams
                      .filter((t) => t.department === newAgentDept)
                      .map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    سرپرست تیم (Lead)
                  </label>
                  <select
                    value={newAgentLead}
                    onChange={(e) => setNewAgentLead(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  >
                    {teamLeads.map((tl) => (
                      <option key={tl.id} value={tl.name}>
                        {tl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">
                  کنترلر کیفیت تخصیص‌یافته
                </label>
                <select
                  value={newAgentController}
                  onChange={(e) => setNewAgentController(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  {controllers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddAgentModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 hover:bg-slate-100"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-sky-600 text-white font-bold hover:bg-sky-700"
                >
                  ذخیره کارشناس
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Fault */}
      {showAddFaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              تعریف خطای جدید در ماتریس
            </h3>

            <form onSubmit={handleCreateFault} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">
                  عنوان خطا
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عدم تایید شناسه وندور در CRM"
                  value={newFaultTitle}
                  onChange={(e) => setNewFaultTitle(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    واحد مربوطه
                  </label>
                  <select
                    value={newFaultDept}
                    onChange={(e) => setNewFaultDept(e.target.value as DepartmentType | 'both')}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  >
                    <option value="both">مشترک (پشتیبانی و فروش)</option>
                    <option value="sales">فروش (Sales)</option>
                    <option value="support">پشتیبانی (Support)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">
                    دسته‌بندی
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: عملیاتی"
                    value={newFaultCategory}
                    onChange={(e) => setNewFaultCategory(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">
                  شرح دقیق و ضوابط خطا
                </label>
                <textarea
                  rows={2}
                  placeholder="توضیح دهید در چه شرایطی این خطا ثبت می‌شود..."
                  value={newFaultDesc}
                  onChange={(e) => setNewFaultDesc(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-rose-700 dark:text-rose-400">
                <input
                  type="checkbox"
                  checked={newFaultCritical}
                  onChange={(e) => setNewFaultCritical(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <span>این خطای بحرانی است (نمره ارزیابی صفر می‌شود)</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddFaultModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 hover:bg-slate-100"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-sky-600 text-white font-bold hover:bg-sky-700"
                >
                  افزودن خطا
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
