import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Header } from './components/Header.tsx';
import { SplitWorkspace } from './components/workspace/SplitWorkspace.tsx';
import { AuditsHistory } from './components/AuditsHistory.tsx';
import { AgentDashboard } from './components/dashboards/AgentDashboard.tsx';
import { TeamLeadDashboard } from './components/dashboards/TeamLeadDashboard.tsx';
import { ManagerDashboard } from './components/dashboards/ManagerDashboard.tsx';
import { SupervisorAdminDashboard } from './components/dashboards/SupervisorAdminDashboard.tsx';
import { DisputesQueue } from './components/disputes/DisputesQueue.tsx';
import { BackupDataModal } from './components/BackupDataModal.tsx';
import { toPersianDigits } from './utils/persian.ts';

const AppContent: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();
  const [showBackupModal, setShowBackupModal] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors">
      <Header onOpenBackupModal={() => setShowBackupModal(true)} />

      <main className="flex-1">
        {activeTab === 'workspace' && (
          <SplitWorkspace
            onAssessmentSubmitted={() => {
              setActiveTab('audits');
            }}
          />
        )}

        {activeTab === 'audits' && <AuditsHistory />}

        {activeTab === 'disputes' && <DisputesQueue />}

        {activeTab === 'need_to_check' && <TeamLeadDashboard />}

        {activeTab === 'agent_view' && <AgentDashboard />}

        {activeTab === 'team_view' && <TeamLeadDashboard />}

        {activeTab === 'manager_view' && <ManagerDashboard />}

        {activeTab === 'admin_view' && <SupervisorAdminDashboard />}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            سامانه کنترل کیفیت عملیات تجاری اسنپ‌فود (SnappFood Commercial QA Portal)
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span>طراحی بر اساس بنچمارک Klaus / MaestroQA</span>
            <span>·</span>
            <span>سال ۱۴۰۳</span>
          </div>
        </div>
      </footer>

      {showBackupModal && (
        <BackupDataModal onClose={() => setShowBackupModal(false)} />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
