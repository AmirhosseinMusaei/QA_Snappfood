import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserRole,
  DepartmentType,
  User,
} from '../types/index.ts';
import {
  SEED_CONTROLLERS,
  SEED_TEAM_LEADS,
  SEED_USERS,
} from '../data/seedData.ts';
import { AppContextType } from './types.ts';
import { useAppMutations } from './useAppMutations.ts';
import { useAppData } from './useAppData.ts';
import { useTheme } from './useTheme.ts';

export type { AppContextType };

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>('qa_controller');
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  const [currentAgentId, setCurrentAgentId] = useState<string>('agent-3718');
  const [currentTeamLeadId, setCurrentTeamLeadId] = useState<string>('negin');
  const [currentManagerDept, setCurrentManagerDept] = useState<DepartmentType>('sales');
  const [currentControllerId, setCurrentControllerId] = useState<string>('meysam');
  const [activeTab, setActiveTab] = useState<string>('workspace');

  // Theme hook
  const { theme, toggleTheme } = useTheme();

  // App Data hook (assessments, agents, teams, rubrics, settings, etc.)
  const data = useAppData();

  // Current logged in user object based on active role
  const currentUser: User = (() => {
    if (activeUser && activeUser.role === role) return activeUser;
    const u = SEED_USERS.find((item) => item.role === role);
    return (
      u || {
        id: `usr-${role}`,
        username: role,
        name: role === 'agent' ? 'کارشناس عملیات' : 'کاربر سیستم',
        role,
        active: true,
      }
    );
  })();

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole === 'agent') {
      setActiveTab('agent_view');
    } else if (newRole === 'team_lead') {
      setActiveTab('team_view');
    } else if (newRole === 'manager') {
      setActiveTab('manager_view');
    } else if (newRole === 'qa_controller') {
      setActiveTab('workspace');
    } else if (newRole === 'qa_supervisor') {
      setActiveTab('audits');
    } else if (newRole === 'admin') {
      setActiveTab('admin_view');
    }
  };

  // Initial load & session restore
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.authenticated && d.user) {
          setActiveUser(d.user);
          setRoleState(d.user.role);
          setIsAuthenticated(true);
        }
      })
      .catch(() => {});
    data.refreshData();
  }, [data.refreshData]);

  // Auth
  const login = async (user: User) => {
    setActiveUser(user);
    setRoleState(user.role);
    setIsAuthenticated(true);
    setShowLoginModal(false);

    if (user.role === 'agent') {
      setActiveTab('agent_view');
    } else if (user.role === 'team_lead') {
      setActiveTab('team_view');
    } else if (user.role === 'manager') {
      setActiveTab('manager_view');
    } else if (user.role === 'qa_controller') {
      setActiveTab('workspace');
    } else if (user.role === 'admin') {
      setActiveTab('admin_view');
    } else {
      setActiveTab('audits');
    }

    data.refreshData();
  };

  const logout = async () => {
    setActiveUser(null);
    setIsAuthenticated(false);
    setShowLoginModal(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const mutations = useAppMutations({
    currentUser,
    assessments: data.assessments,
    setAssessments: data.setAssessments,
    agents: data.agents,
    setAgents: data.setAgents,
    faults: data.faults,
    setFaults: data.setFaults,
    problems: data.problems,
    setProblems: data.setProblems,
    settings: data.settings,
    setSettings: data.setSettings,
    supportRubric: data.supportRubric,
    setSupportRubric: data.setSupportRubric,
    salesRubric: data.salesRubric,
    setSalesRubric: data.setSalesRubric,
    supportFormVersion: data.supportFormVersion,
    setSupportFormVersion: data.setSupportFormVersion,
    salesFormVersion: data.salesFormVersion,
    setSalesFormVersion: data.setSalesFormVersion,
    supportFormId: data.supportFormId,
    setSupportFormId: data.setSupportFormId,
    salesFormId: data.salesFormId,
    setSalesFormId: data.setSalesFormId,
    refreshAuditLogs: data.refreshAuditLogs,
    refreshData: data.refreshData,
    setError: data.setError,
    setLoading: data.setLoading,
  });

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        currentUser,
        currentAgentId,
        setCurrentAgentId,
        currentTeamLeadId,
        setCurrentTeamLeadId,
        currentManagerDept,
        setCurrentManagerDept,
        currentControllerId,
        setCurrentControllerId,
        theme,
        toggleTheme,
        activeTab,
        setActiveTab,
        loading: data.loading,
        error: data.error,
        refreshData: data.refreshData,
        assessments: data.assessments.filter((a) => !a.deleted_at),
        allAssessments: data.assessments,
        agents: data.agents,
        faults: data.faults,
        teams: data.teams,
        controllers: SEED_CONTROLLERS,
        teamLeads: SEED_TEAM_LEADS,
        auditLogs: data.auditLogs,
        settings: data.settings,
        problems: data.problems,
        supportRubric: data.supportRubric,
        salesRubric: data.salesRubric,
        supportFormVersion: data.supportFormVersion,
        salesFormVersion: data.salesFormVersion,
        supportFormId: data.supportFormId,
        salesFormId: data.salesFormId,
        isAuthenticated,
        showLoginModal,
        setShowLoginModal,
        login,
        logout,
        ...mutations,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
