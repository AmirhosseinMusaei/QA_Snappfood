import React, { useState } from 'react';
import {
  Users,
  Settings,
  ShieldAlert,
  FileSpreadsheet,
  UserPlus,
  Upload,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.tsx';
import { AgentRosterTab } from './supervisorAdmin/AgentRosterTab.tsx';
import { RubricEditorTab } from './supervisorAdmin/RubricEditorTab.tsx';
import { FaultsManagementTab } from './supervisorAdmin/FaultsManagementTab.tsx';
import { PortalSettingsTab } from './supervisorAdmin/PortalSettingsTab.tsx';

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

  // Modal triggers
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [showFaultModal, setShowFaultModal] = useState(false);

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
              دسترسی ادمین و سوپروایزر
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            مدیریت کامل رستر All Source، ماتریس خطاهای فرآیندی، جدول کسر نمره سکوت و ویرایشگر نسخه‌بندی رابریک‌ها
          </p>
        </div>

        {/* Action Buttons depending on active tab */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'roster' && (
            <>
              <button
                type="button"
                onClick={() => setShowCsvImportModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-750 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
              >
                <Upload className="w-4 h-4" />
                <span>ایمپورت CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddAgentModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>تعریف کارشناس جدید</span>
              </button>
            </>
          )}

          {activeTab === 'faults' && (
            <button
              type="button"
              onClick={() => setShowFaultModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition"
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

      {/* Sub-Tab 1: Agent Roster */}
      {activeTab === 'roster' && (
        <AgentRosterTab
          agents={agents}
          teams={teams}
          controllers={controllers}
          teamLeads={teamLeads}
          addAgent={addAgent}
          updateAgent={updateAgent}
          importAgentsFromCsv={importAgentsFromCsv}
          showAddModal={showAddAgentModal}
          setShowAddModal={setShowAddAgentModal}
          showImportModal={showCsvImportModal}
          setShowImportModal={setShowCsvImportModal}
        />
      )}

      {/* Sub-Tab 2: Rubric Editor */}
      {activeTab === 'rubric' && (
        <RubricEditorTab
          supportRubric={supportRubric}
          salesRubric={salesRubric}
          supportFormVersion={supportFormVersion}
          salesFormVersion={salesFormVersion}
          updateFullRubric={updateFullRubric}
        />
      )}

      {/* Sub-Tab 3: Faults Management */}
      {activeTab === 'faults' && (
        <FaultsManagementTab
          faults={faults}
          addFault={addFault}
          updateFault={updateFault}
          deleteFault={deleteFault}
          showModal={showFaultModal}
          setShowModal={setShowFaultModal}
        />
      )}

      {/* Sub-Tab 4: Settings */}
      {activeTab === 'settings' && (
        <PortalSettingsTab
          settings={settings}
          updateSettings={updateSettings}
        />
      )}
    </div>
  );
};
