import React, { useState, useMemo } from 'react';
import {
  Users,
  Settings,
  ShieldAlert,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Upload,
  Save,
  X,
  Sliders,
  Layers,
  Award,
  Calendar,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import {
  Agent,
  Fault,
  DepartmentType,
  RubricSection,
  RubricCriterion,
  RubricSubItem,
  PortalSettings,
} from '../../types/index.ts';
import { toPersianDigits, toEnglishDigits } from '../../utils/persian.ts';

export const SupervisorAdminDashboard: React.FC = () => {
  const {
    agents,
    addAgent,
    updateAgent,
    faults,
    addFault,
    updateFault,
    deleteFault,
    teams,
    controllers,
    teamLeads,
    supportRubric,
    salesRubric,
    supportFormVersion,
    salesFormVersion,
    updateFullRubric,
    settings,
    updateSettings,
    importAgentsFromCsv,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'roster' | 'rubric' | 'faults' | 'settings'>('roster');

  // --- Sub-Tab 1: Agent Roster States ---
  const [agentSearch, setAgentSearch] = useState('');
  const [filterRosterTeam, setFilterRosterTeam] = useState('all');
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvResult, setCsvResult] = useState<{ count: number; errors: string[] } | null>(null);

  // New Agent Form
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

  // --- Sub-Tab 2: Rubric Editor States ---
  const [rubricDept, setRubricDept] = useState<DepartmentType>('support');
  const [activeSupportSections, setActiveSupportSections] = useState<RubricSection[]>(supportRubric);
  const [activeSalesSections, setActiveSalesSections] = useState<RubricSection[]>(salesRubric);
  const [rubricSaveSuccess, setRubricSaveSuccess] = useState<string | null>(null);
  const [rubricSaveError, setRubricSaveError] = useState<string | null>(null);

  // Calculate live total max points
  const activeSections = rubricDept === 'support' ? activeSupportSections : activeSalesSections;
  const currentTotalMax = useMemo(() => {
    return activeSections.reduce((sum, s) => sum + s.maxPoints, 0);
  }, [activeSections]);

  // --- Sub-Tab 3: Faults States ---
  const [showFaultModal, setShowFaultModal] = useState(false);
  const [editingFault, setEditingFault] = useState<Fault | null>(null);
  const [faultForm, setFaultForm] = useState({
    title: '',
    department: 'both' as DepartmentType | 'both',
    category: 'Process problem',
    is_critical: false,
    description: '',
  });

  // --- Sub-Tab 4: Settings State ---
  const [settingsForm, setSettingsForm] = useState<PortalSettings>(settings);
  const [settingsSaveToast, setSettingsSaveToast] = useState(false);

  // 1. Filtered Agents List
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

    setShowAddAgentModal(false);
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

  const handleImportCsv = () => {
    if (!csvText.trim()) return;
    const res = importAgentsFromCsv(csvText, false);
    setCsvResult(res);
    if (res.success && res.errors.length === 0) {
      setTimeout(() => {
        setShowCsvImportModal(false);
        setCsvResult(null);
        setCsvText('');
      }, 1500);
    }
  };

  // 2. Rubric Sub-item updates
  const handleUpdateItemPoints = (sectionId: string, criterionId: string, itemId: string, newPoints: number) => {
    const updater = (sections: RubricSection[]) => {
      return sections.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const newCriteria = sec.criteria.map((crit) => {
          if (crit.id !== criterionId) return crit;
          const newItems = crit.items.map((it) => (it.id === itemId ? { ...it, maxPoints: newPoints } : it));
          const critTotal = newItems.reduce((acc, it) => acc + it.maxPoints, 0);
          return { ...crit, items: newItems, maxPoints: critTotal };
        });
        const secTotal = newCriteria.reduce((acc, c) => acc + c.maxPoints, 0);
        return { ...sec, criteria: newCriteria, maxPoints: secTotal };
      });
    };

    if (rubricDept === 'support') {
      setActiveSupportSections((prev) => updater(prev));
    } else {
      setActiveSalesSections((prev) => updater(prev));
    }
  };

  const handleSaveRubric = () => {
    setRubricSaveError(null);
    const res = updateFullRubric(rubricDept, activeSections);
    if (!res.success) {
      setRubricSaveError(res.error || 'خطا در اعتبارسنجی مجموع نمرات');
    } else {
      setRubricSaveSuccess(`رابریک با موفقیت ذخیره شد و نسخه فرم ارتقا یافت.`);
      setTimeout(() => setRubricSaveSuccess(null), 3500);
    }
  };

  // 3. Faults management
  const handleSaveFault = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faultForm.title.trim()) return;

    if (editingFault) {
      updateFault(editingFault.id, faultForm);
      setEditingFault(null);
    } else {
      addFault(faultForm);
    }

    setShowFaultModal(false);
    setFaultForm({
      title: '',
      department: 'both',
      category: 'Process problem',
      is_critical: false,
      description: '',
    });
  };

  // 4. Settings save
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(settingsForm);
    setSettingsSaveToast(true);
    setTimeout(() => setSettingsSaveToast(false), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              ماژول مدیریت، رستر کارشناسان و تنظیمات سیستم (Admin Suite)
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-semibold">
              سطح سوپروایزر و ادمین
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            مدیریت کامل کارشناسان رستر (All Source)، ویرایشگر رابریک با اعتبارسنجی ۱۰۰ امتیاز، ماتریس خطاها و قوانین نمره‌دهی
          </p>
        </div>

        {/* Action button based on active subtab */}
        <div className="flex items-center gap-2">
          {activeTab === 'roster' && (
            <>
              <button
                type="button"
                onClick={() => setShowCsvImportModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
              >
                <Upload className="w-4 h-4 text-sky-600" />
                <span>ایمپورت CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddAgentModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>افزودن کارشناس جدید</span>
              </button>
            </>
          )}

          {activeTab === 'faults' && (
            <button
              type="button"
              onClick={() => {
                setEditingFault(null);
                setFaultForm({
                  title: '',
                  department: 'both',
                  category: 'Process problem',
                  is_critical: false,
                  description: '',
                });
                setShowFaultModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف خطای جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 4 Sub-Tabs as per PRD */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeTab === 'roster'
              ? 'bg-sky-600 text-white shadow-xs font-bold'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>۱. مدیریت کارشناسان و کاربران (All Source)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rubric')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeTab === 'rubric'
              ? 'bg-sky-600 text-white shadow-xs font-bold'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>۲. ویرایشگر فرم‌ها و نسخه‌بندی (Rubric Editor)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('faults')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeTab === 'faults'
              ? 'bg-sky-600 text-white shadow-xs font-bold'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>۳. مدیریت خطاها (Faults Master List)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-sky-600 text-white shadow-xs font-bold'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>۴. تنظیمات سیستم و قوانین نمره‌دهی</span>
        </button>
      </div>

      {/* --- SUB-TAB 1: AGENT ROSTER (All Source) --- */}
      {activeTab === 'roster' && (
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
        </div>
      )}

      {/* --- SUB-TAB 2: RUBRIC & FORM VERSIONING EDITOR --- */}
      {activeTab === 'rubric' && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
          {/* Header & Department Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ویرایشگر سقف نمرات رابریک و نسخه‌بندی خودکار
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold">
                  نسخه فعال: v{rubricDept === 'support' ? supportFormVersion : salesFormVersion}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                سقف کل نمرات بخش‌ها باید دقیقاً برابر با ۱۰۰ امتیاز باشد. با ذخیره، نسخه فرم یک شماره ارتقا می‌یابد تا سوابق گذشته دست‌نخورده باقی بماند.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setRubricDept('support')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    rubricDept === 'support'
                      ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  پشتیبانی تجاری (Support - ۱۰۰ امتیاز)
                </button>
                <button
                  type="button"
                  onClick={() => setRubricDept('sales')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    rubricDept === 'sales'
                      ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  فروش و بازاریابی (Sales - ۱۰۰ امتیاز)
                </button>
              </div>

              {/* Total score badge validation */}
              <div
                className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${
                  currentTotalMax === 100
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 animate-pulse'
                }`}
              >
                {currentTotalMax === 100 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>مجموع سقف: {toPersianDigits(currentTotalMax)} / ۱۰۰</span>
              </div>

              <button
                type="button"
                onClick={handleSaveRubric}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
              >
                <Save className="w-4 h-4" />
                <span>ذخیره رابریک و ارتقای نسخه (Save & Bump Version)</span>
              </button>
            </div>
          </div>

          {/* Feedback Toasts */}
          {rubricSaveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{rubricSaveSuccess}</span>
            </div>
          )}
          {rubricSaveError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2 border border-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{rubricSaveError}</span>
            </div>
          )}

          {/* Rubric Sections Table */}
          <div className="space-y-4">
            {activeSections.map((section) => (
              <div
                key={section.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
              >
                <div className="bg-slate-100/80 dark:bg-slate-750 px-4 py-3 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                    بخش: {section.title}
                  </span>
                  <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                    سقف تجمیعی بخش: {toPersianDigits(section.maxPoints)} امتیاز
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {section.criteria.map((criterion) => (
                    <div key={criterion.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <span>معیار: {criterion.title}</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          جمع زیرمعیارها: {toPersianDigits(criterion.maxPoints)}
                        </span>
                      </div>

                      {/* Sub-items with editable points */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {criterion.items.map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between text-xs"
                          >
                            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[170px]" title={item.title}>
                              {item.title}
                            </span>
                            <div className="flex items-center gap-1 shrink-0 mr-2">
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={item.maxPoints}
                                onChange={(e) =>
                                  handleUpdateItemPoints(
                                    section.id,
                                    criterion.id,
                                    item.id,
                                    Number(e.target.value) || 0
                                  )
                                }
                                className="w-12 p-1 text-center font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs text-slate-900 dark:text-white"
                              />
                              <span className="text-[10px] text-slate-400">امتیاز</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- SUB-TAB 3: FAULTS MASTER LIST --- */}
      {activeTab === 'faults' && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-xs">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                ماتریس خطاهای سیستمی، وندور و رفتاری (Faults Master List)
              </h3>
              <p className="text-[11px] text-slate-400">
                خطاهای بحرانی (Critical) منجر به صفر شدن آنی نمره کل ارزیابی می‌گردند.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">عنوان خطا</th>
                  <th className="py-2.5 px-3">واحد سازمانی</th>
                  <th className="py-2.5 px-3">دسته‌بندی (Category)</th>
                  <th className="py-2.5 px-3">شدت و وضعیت بحرانی</th>
                  <th className="py-2.5 px-3">توضیحات فرآیندی</th>
                  <th className="py-2.5 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-sans">
                {faults.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition">
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">
                      {f.title}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                        {f.department === 'both' ? 'هر دو واحد' : f.department === 'support' ? 'پشتیبانی' : 'فروش'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                      {f.category}
                    </td>
                    <td className="py-3 px-3">
                      {f.is_critical ? (
                        <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10px] font-bold">
                          بحرانی (صفر شدن نمره)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-medium">
                          اخطار فرآیندی
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 max-w-[200px] truncate" title={f.description}>
                      {f.description || '-'}
                    </td>
                    <td className="py-3 px-3 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFault(f);
                            setFaultForm({
                              title: f.title,
                              department: f.department,
                              category: f.category,
                              is_critical: f.is_critical,
                              description: f.description || '',
                            });
                            setShowFaultModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="ویرایش خطا"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`آیا از حذف خطای "${f.title}" اطمینان دارید؟`)) {
                              deleteFault(f.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="حذف خطا"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- SUB-TAB 4: SYSTEM SETTINGS & SCORING RULES --- */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                پیکربندی قوانین نمره‌دهی، جریمه‌ها و آستانه‌های کیفی
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تنظیم دقیق جدول کسر نمره سکوت/انضباط فروش، مهلت ثبت اعتراض و آستانه‌های تفکیک کیفیت
              </p>
            </div>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره تغییرات تنظیمات</span>
            </button>
          </div>

          {settingsSaveToast && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>تنظیمات و قوانین نمره‌دهی سیستم با موفقیت بروزرسانی شد.</span>
            </div>
          )}

          {/* Section 1: Sales Mistake Deduction Table */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-sky-600" />
              <span>جدول نمره خطاهای انضباط مکالمه و سکوت فروش (Sales Mistakes Schedule - سقف ۳۰ امتیاز)</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              بر اساس شیت فرمول فروش: ۰ خطا = ۳۰ نمره، ۱ خطا = ۲۵ نمره، ۲ خطا = ۲۰ نمره، ۳ خطا = ۱۵ نمره، ۴ خطا = ۱۰ نمره، ۵ خطا یا بیشتر = ۰ نمره
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              {[0, 1, 2, 3, 4, 5].map((count) => (
                <div key={count} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center space-y-1">
                  <span className="text-[11px] text-slate-400 block">
                    {count === 5 ? '۵ خطا و بیشتر' : `${toPersianDigits(count)} خطا`}
                  </span>
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={settingsForm.sales_mistake_deductions[count] ?? 0}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          sales_mistake_deductions: {
                            ...settingsForm.sales_mistake_deductions,
                            [count]: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-14 p-1 text-center font-mono font-bold rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs"
                    />
                    <span className="text-[10px] text-slate-400">نمره</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Quality Thresholds & Dispute Window */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                مهلت ثبت اعتراض توسط کارشناس (روز کاری):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={settingsForm.dispute_window_days}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, dispute_window_days: Number(e.target.value) || 3 })
                  }
                  className="w-20 p-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono font-bold"
                />
                <span className="text-slate-500">روز از تاریخ ثبت بررسی</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2">
              <label className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">
                آستانه عملکرد عالی (High Quality &ge;):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={85}
                  max={100}
                  value={settingsForm.high_quality_threshold}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, high_quality_threshold: Number(e.target.value) || 95 })
                  }
                  className="w-20 p-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 font-mono font-bold text-emerald-600"
                />
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">امتیاز</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20 space-y-2">
              <label className="text-[11px] font-bold text-rose-800 dark:text-rose-300 block">
                آستانه هشدار کیفی (Low Quality &lt;):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={50}
                  max={90}
                  value={settingsForm.low_quality_threshold}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, low_quality_threshold: Number(e.target.value) || 80 })
                  }
                  className="w-20 p-2 rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-800 font-mono font-bold text-rose-600"
                />
                <span className="text-rose-700 dark:text-rose-400 font-semibold">امتیاز</span>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* --- MODAL: Add New Agent --- */}
      {showAddAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-600" />
                <span>تعریف کارشناس جدید (All Source Roster)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddAgentModal(false)}
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
                    پنل اپراتور:
                  </label>
                  <select
                    value={agentForm.operator_panel}
                    onChange={(e) => setAgentForm({ ...agentForm, operator_panel: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    <option value="Ring">Ring</option>
                    <option value="VOIP">VOIP</option>
                    <option value="Jira">Jira</option>
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
                        {tl.name} ({tl.team})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    کنترلر اختصاصی:
                  </label>
                  <select
                    value={agentForm.controller}
                    onChange={(e) => setAgentForm({ ...agentForm, controller: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    {controllers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.display_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddAgentModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold"
                >
                  افزودن به رستر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: Edit Agent --- */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-500" />
                <span>ویرایش کارشناس {editingAgent.name}</span>
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
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    نام:
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAgent.name}
                    onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
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
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
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
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    پنل اپراتور:
                  </label>
                  <select
                    value={editingAgent.operator_panel || 'Ring'}
                    onChange={(e) => setEditingAgent({ ...editingAgent, operator_panel: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    <option value="Ring">Ring</option>
                    <option value="VOIP">VOIP</option>
                    <option value="Jira">Jira</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold"
                >
                  ذخیره مشخصات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CSV Import --- */}
      {showCsvImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-600" />
                <span>ایمپورت کارشناسان از فایل CSV (Import Roster)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCsvImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              ستون‌های مجاز (با کاما تفکیک شود):<br />
              <code className="text-[10px] bg-slate-100 dark:bg-slate-700 p-1 rounded font-mono block mt-1">
                name,source_id,team,department,team_lead,controller,operator_panel,sample_name,check_process,min_monthly_reviews
              </code>
            </p>

            <textarea
              rows={6}
              placeholder="name,source_id,team,department,team_lead,controller,operator_panel,sample_name,check_process,min_monthly_reviews
احسان علوی,7301,Technical,support,حسین جدیری,Asal,Ring,Support group,if needed,40"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
            />

            {csvResult && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  csvResult.errors.length === 0
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {csvResult.errors.length === 0 ? (
                  <span>{toPersianDigits(csvResult.count)} کارشناس با موفقیت افزوده شدند.</span>
                ) : (
                  <span>خطا: {csvResult.errors.join(' | ')}</span>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowCsvImportModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600"
              >
                بستن
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold"
              >
                تایید و ایمپورت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: Add/Edit Fault --- */}
      {showFaultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingFault ? 'ویرایش خطا' : 'تعریف خطای جدید'}
              </h3>
              <button
                type="button"
                onClick={() => setShowFaultModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFault} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  عنوان خطا:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: قطع عمدی تماس توسط کارشناس"
                  value={faultForm.title}
                  onChange={(e) => setFaultForm({ ...faultForm, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  واحد مربوطه:
                </label>
                <select
                  value={faultForm.department}
                  onChange={(e) => setFaultForm({ ...faultForm, department: e.target.value as any })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                >
                  <option value="both">هر دو واحد (پشتیبانی و فروش)</option>
                  <option value="support">پشتیبانی تجاری</option>
                  <option value="sales">فروش و بازاریابی</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  دسته‌بندی خطا:
                </label>
                <select
                  value={faultForm.category}
                  onChange={(e) => setFaultForm({ ...faultForm, category: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                >
                  <option value="Process problem">Process problem (فرآیندی)</option>
                  <option value="Policy problem">Policy problem (سیاست‌گذاری)</option>
                  <option value="Snappfood problem">Snappfood problem (سیستمی اسنپ‌فود)</option>
                  <option value="Vendor problem">Vendor problem (مشکل وندور)</option>
                  <option value="Support problem">Support problem (پشتیبانی)</option>
                  <option value="Other teams">Other teams (سایر تیم‌ها)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="criticalFaultCheck"
                  checked={faultForm.is_critical}
                  onChange={(e) => setFaultForm({ ...faultForm, is_critical: e.target.checked })}
                  className="w-4 h-4 text-rose-600 rounded"
                />
                <label htmlFor="criticalFaultCheck" className="text-xs font-bold text-rose-600">
                  خطای بحرانی (صفر شدن آنی نمره کل ارزیابی)
                </label>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  شرح گایدلاین خطا:
                </label>
                <textarea
                  rows={2}
                  value={faultForm.description}
                  onChange={(e) => setFaultForm({ ...faultForm, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowFaultModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold"
                >
                  ذخیره خطا
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
