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
import { SystemAuditLog } from './components/SystemAuditLog.tsx';
import { BackupDataModal } from './components/BackupDataModal.tsx';
import { LoginModal } from './components/auth/LoginModal.tsx';
import { toPersianDigits, getCurrentJalaliYear } from './utils/persian.ts';

const AppContent: React.FC = () => {
  const { activeTab, setActiveTab, loading, error, refreshData, showLoginModal, setShowLoginModal } = useApp();
  const [showBackupModal, setShowBackupModal] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors">
      <Header onOpenBackupModal={() => setShowBackupModal(true)} />

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 p-2 text-center text-xs text-rose-700 dark:text-rose-300 flex items-center justify-center gap-2">
          <span>{error}</span>
          <button onClick={() => refreshData()} className="underline font-bold hover:text-rose-900">
            تلاش مجدد
          </button>
        </div>
      )}

      {loading && (
        <div className="py-1 px-4 text-center text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900 flex items-center justify-center gap-2 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
          <span>در حال دریافت و همگام‌سازی داده‌ها از پایگاه داده (Prisma)...</span>
        </div>
      )}

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
        {activeTab === 'system_audit_log' && <SystemAuditLog />}
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
            <span>سال {toPersianDigits(getCurrentJalaliYear())}</span>
          </div>
        </div>
      </footer>

      {showBackupModal && (
        <BackupDataModal onClose={() => setShowBackupModal(false)} />
      )}

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
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
