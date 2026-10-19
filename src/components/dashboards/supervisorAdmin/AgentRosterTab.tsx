import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Upload,
  X,
  Edit2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  Agent,
  Team,
  DepartmentType,
} from '../../../types/index.ts';
import { toPersianDigits } from '../../../utils/persian.ts';

interface AgentRosterTabProps {
  agents: Agent[];
  teams: Team[];
  controllers: { id: string; name: string }[];
  teamLeads: { id: string; name: string }[];
  addAgent: (agent: Omit<Agent, 'id'>) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  importAgentsFromCsv: (csvText: string, dryRun: boolean) => Promise<{
    success: boolean;
    count: number;
    errors: string[];
  }>;
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (show: boolean) => void;
}

export const AgentRosterTab: React.FC<AgentRosterTabProps> = ({
  agents,
  teams,
  controllers,
  teamLeads,
  addAgent,
  updateAgent,
  importAgentsFromCsv,
  showAddModal,
  setShowAddModal,
  showImportModal,
  setShowImportModal,
}) => {
  const [agentSearch, setAgentSearch] = useState('');
  const [filterRosterTeam, setFilterRosterTeam] = useState('all');
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const [csvText, setCsvText] = useState('');
  const [csvResult, setCsvResult] = useState<{ success: boolean; count: number; errors: string[] } | null>(null);

  // New Agent Form state
  const [agentForm, setAgentForm] = useState({
    name: '',
    source_id: '',
    department: 'support' as DepartmentType,
    team: 'Technical',
    operator_panel: 'Ring',
    team_lead: 'حسین جدیری',
    controller: 'Asal',
    sample_name: 'Support group',
    check_process: 'if needed',
    min_monthly_reviews: 40,
  });

  const filteredAgents = useMemo(() => {
    return agents.filter((ag) => {
      if (filterRosterTeam !== 'all' && ag.team !== filterRosterTeam) return false;
      if (agentSearch.trim()) {
        const q = agentSearch.toLowerCase().trim();
        return (
          ag.name.toLowerCase().includes(q) ||
          ag.source_id.includes(q) ||
          ag.team.toLowerCase().includes(q) ||
          ag.controller.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [agents, filterRosterTeam, agentSearch]);

  const handleSaveNewAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentForm.name || !agentForm.source_id) return;

    addAgent({
      ...agentForm,
      active: true,
    });

    setShowAddModal(false);
    setAgentForm({
      name: '',
      source_id: '',
      department: 'support',
      team: 'Technical',
      operator_panel: 'Ring',
      team_lead: 'حسین جدیری',
      controller: 'Asal',
      sample_name: 'Support group',
      check_process: 'if needed',
      min_monthly_reviews: 40,
    });
  };

  const handleSaveEditAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    updateAgent(editingAgent.id, editingAgent);
    setEditingAgent(null);
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) return;
    const res = await importAgentsFromCsv(csvText, false);
    setCsvResult(res);
    if (res.success && res.errors.length === 0) {
      setTimeout(() => {
        setShowImportModal(false);
        setCsvResult(null);
        setCsvText('');
      }, 1500);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="جستجو نام، کد سورس، تیم، کنترلر..."
            value={agentSearch}
            onChange={(e) => setAgentSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterRosterTeam}
            onChange={(e) => setFilterRosterTeam(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
          >
            <option value="all">همه تیم‌ها</option>
            {teams.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
              <th className="py-2.5 px-3">نام کارشناس (Agent)</th>
              <th className="py-2.5 px-3">کد سورس</th>
              <th className="py-2.5 px-3">تیم</th>
              <th className="py-2.5 px-3">پنل اپراتور</th>
              <th className="py-2.5 px-3">سرپرست تیم</th>
              <th className="py-2.5 px-3">کنترلر کیفیت</th>
              <th className="py-2.5 px-3">نوع سمپل</th>
              <th className="py-2.5 px-3">فرآیند چک</th>
              <th className="py-2.5 px-3">سهمیه هدف</th>
              <th className="py-2.5 px-3">وضعیت</th>
              <th className="py-2.5 px-3 text-left">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-sans">
            {filteredAgents.map((ag) => (
              <tr key={ag.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition">
                <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">
                  {ag.name}
                </td>
                <td className="py-3 px-3 font-mono font-semibold text-sky-600 dark:text-sky-400">
                  {toPersianDigits(ag.source_id)}
                </td>
                <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                  {ag.team}
                </td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[11px]">
                    {ag.operator_panel || 'Ring'}
                  </span>
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                  {ag.team_lead}
                </td>
                <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-200">
                  {ag.controller}
                </td>
                <td className="py-3 px-3 text-slate-500">
                  {ag.sample_name || 'Random'}
                </td>
                <td className="py-3 px-3">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                    {ag.check_process || 'if needed'}
                  </span>
                </td>
                <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                  {toPersianDigits(ag.min_monthly_reviews || 40)}
                </td>
                <td className="py-3 px-3">
                  <button
                    type="button"
                    onClick={() => updateAgent(ag.id, { active: !ag.active })}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ag.active
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {ag.active ? 'فعال' : 'غیرفعال'}
                  </button>
                </td>
                <td className="py-3 px-3 text-left">
                  <button
                    type="button"
                    onClick={() => setEditingAgent(ag)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    title="ویرایش کارشناس"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL: Add New Agent */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-600" />
                <span>تعریف کارشناس جدید (All Source Roster)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewAgent} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    نام و نام‌خانوادگی:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: پرهام سلطانی"
                    value={agentForm.name}
                    onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    کد سورس (Source ID):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 7299"
                    value={agentForm.source_id}
                    onChange={(e) => setAgentForm({ ...agentForm, source_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    تیم سازمانی:
                  </label>
                  <select
                    value={agentForm.team}
                    onChange={(e) => setAgentForm({ ...agentForm, team: e.target.value })}
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
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    دپارتمان:
                  </label>
                  <select
                    value={agentForm.department}
                    onChange={(e) =>
                      setAgentForm({ ...agentForm, department: e.target.value as DepartmentType })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    <option value="support">پشتیبانی (Support)</option>
                    <option value="sales">فروش و بازاریابی (Sales)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    سرپرست تیم (Team Lead):
                  </label>
                  <select
                    value={agentForm.team_lead}
                    onChange={(e) => setAgentForm({ ...agentForm, team_lead: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    {teamLeads.map((tl) => (
                      <option key={tl.id} value={tl.name}>
                        {tl.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    کنترلر کیفیت (Controller):
                  </label>
                  <select
                    value={agentForm.controller}
                    onChange={(e) => setAgentForm({ ...agentForm, controller: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    {controllers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    پنل اپراتور:
                  </label>
                  <input
                    type="text"
                    value={agentForm.operator_panel}
                    onChange={(e) => setAgentForm({ ...agentForm, operator_panel: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    فرآیند چک:
                  </label>
                  <input
                    type="text"
                    value={agentForm.check_process}
                    onChange={(e) => setAgentForm({ ...agentForm, check_process: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    سهمیه هدف:
                  </label>
                  <input
                    type="number"
                    value={agentForm.min_monthly_reviews}
                    onChange={(e) =>
                      setAgentForm({ ...agentForm, min_monthly_reviews: Number(e.target.value) || 40 })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold"
                >
                  ذخیره کارشناس
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Agent */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-600" />
                <span>ویرایش مشخصات کارشناس</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingAgent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAgent} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    نام کارشناس:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAgent.name}
                    onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    کد سورس:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAgent.source_id}
                    onChange={(e) => setEditingAgent({ ...editingAgent, source_id: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    تیم:
                  </label>
                  <select
                    value={editingAgent.team}
                    onChange={(e) => setEditingAgent({ ...editingAgent, team: e.target.value })}
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
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    کنترلر ناظر:
                  </label>
                  <select
                    value={editingAgent.controller}
                    onChange={(e) => setEditingAgent({ ...editingAgent, controller: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    {controllers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    سرپرست مستقیم:
                  </label>
                  <select
                    value={editingAgent.team_lead}
                    onChange={(e) => setEditingAgent({ ...editingAgent, team_lead: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    {teamLeads.map((tl) => (
                      <option key={tl.id} value={tl.name}>
                        {tl.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    حداقل ارزیابی هدف:
                  </label>
                  <input
                    type="number"
                    value={editingAgent.min_monthly_reviews || 40}
                    onChange={(e) =>
                      setEditingAgent({
                        ...editingAgent,
                        min_monthly_reviews: Number(e.target.value) || 40,
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  بروزرسانی کارشناس
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CSV Import */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-600" />
                <span>بارگذاری و ایمپورت گروهی لیست کارشناسان (CSV Import)</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setCsvResult(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-500 text-[11px] leading-relaxed">
              ستون‌های مجاز فایل CSV:
              <br />
              <code className="text-sky-600 font-mono bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded">
                name, source_id, department, team, operator_panel, team_lead, controller,
                sample_name, check_process, min_monthly_reviews
              </code>
            </p>

            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`name,source_id,department,team,operator_panel,team_lead,controller,sample_name,check_process,min_monthly_reviews\nعلی رضایی,9012,support,Technical,Ring,حسین جدیری,Asal,Support group,if needed,40`}
              className="w-full p-3 font-mono text-[11px] rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
            />

            {csvResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold ${
                  csvResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-800 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  {csvResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>
                    {csvResult.success
                      ? `${toPersianDigits(csvResult.count)} کارشناس با موفقیت اضافه یا بروزرسانی شدند.`
                      : 'خطا در بارگذاری کارشناسان:'}
                  </span>
                </div>
                {csvResult.errors.length > 0 && (
                  <ul className="list-disc list-inside text-[11px] font-normal space-y-0.5">
                    {csvResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setCsvResult(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold"
              >
                بستن
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold"
              >
                پردازش و ذخیره در سیستم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
