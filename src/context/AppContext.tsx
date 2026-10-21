import { api } from "../utils/api.ts";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { UserRole, DepartmentType, User } from "../types/index.ts";
import { AppContextType } from "./types.ts";
import { useAppMutations } from "./useAppMutations.ts";
import { useAppData } from "./useAppData.ts";
import { useTheme } from "./useTheme.ts";

export type { AppContextType };

export const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [role, setRoleState] = useState<UserRole>("qa_controller");
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  const [currentAgentId, setCurrentAgentId] = useState<string>("");
  const [currentTeamLeadId, setCurrentTeamLeadId] = useState<string>("");
  const [currentManagerDept, setCurrentManagerDept] =
    useState<DepartmentType>("sales");
  const [currentControllerId, setCurrentControllerId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("workspace");

  // Theme hook
  const { theme, toggleTheme } = useTheme();

  // App Data hook (assessments, agents, teams, rubrics, settings, etc.)
  const data = useAppData();

  const clearAppData = data.clearData;
  const refreshAppData = data.refreshData;

  // Handle unauthorized session
  const handleUnauthorized = useCallback(() => {
    setActiveUser(null);
    setIsAuthenticated(false);
    clearAppData();
    setShowLoginModal(true);
  }, [clearAppData]);

  // Current logged in user object based on authenticated user or active user
  const currentUser: User = activeUser || {
    id: `usr-${role}`,
    username: role,
    name: "کاربر سیستم",
    role,
    active: true,
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole === "agent") {
      setActiveTab("agent_view");
    } else if (newRole === "team_lead") {
      setActiveTab("team_view");
    } else if (newRole === "manager") {
      setActiveTab("manager_view");
    } else if (newRole === "qa_controller") {
      setActiveTab("workspace");
    } else if (newRole === "qa_supervisor") {
      setActiveTab("audits");
    } else if (newRole === "admin") {
      setActiveTab("admin_view");
    }
  };

  // Bind relationships based on authenticated user profile
  const bindUserRelationships = useCallback((user: User) => {
    if (user.agent_id) {
      setCurrentAgentId(user.agent_id);
    }
    if (user.team_id) {
      setCurrentTeamLeadId(user.id);
    } else if (user.team) {
      setCurrentTeamLeadId(user.id);
    }
    if (user.department) {
      setCurrentManagerDept(user.department as DepartmentType);
    }
    if (user.role === "qa_controller") {
      setCurrentControllerId(user.id || user.username);
    }
  }, []);

  // Initial load & session restore from /api/auth/me (runs once on mount)
  useEffect(() => {
    let isMounted = true;
    setAuthLoading(true);

    const initAuth = async () => {
      try {
        const meRes = await fetch("/api/auth/me");
        const meData = await meRes.json();
        if (
          isMounted &&
          meData.success &&
          meData.authenticated &&
          meData.user
        ) {
          setActiveUser(meData.user);
          setRoleState(meData.user.role);
          setIsAuthenticated(true);
          bindUserRelationships(meData.user);
          setRole(meData.user.role);
          await refreshAppData(handleUnauthorized);
          return;
        }

        if (isMounted) {
          setActiveUser(null);
          setIsAuthenticated(false);
          setShowLoginModal(true);
        }
      } catch (err) {
        console.error("Initial session check error:", err);
        if (isMounted) {
          setActiveUser(null);
          setIsAuthenticated(false);
          setShowLoginModal(true);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [bindUserRelationships, refreshAppData]);

  useEffect(() => {
    const expired = () => handleUnauthorized();
    window.addEventListener("qa-session-expired", expired);
    return () => window.removeEventListener("qa-session-expired", expired);
  }, [handleUnauthorized]);

  // Auth: Login
  const login = async (user: User) => {
    data.clearData();
    setCurrentAgentId("");
    setCurrentTeamLeadId("");
    setCurrentControllerId("");
    setActiveUser(user);
    setRoleState(user.role);
    setIsAuthenticated(true);
    setShowLoginModal(false);
    bindUserRelationships(user);

    if (user.role === "agent") {
      setActiveTab("agent_view");
    } else if (user.role === "team_lead") {
      setActiveTab("team_view");
    } else if (user.role === "manager") {
      setActiveTab("manager_view");
    } else if (user.role === "qa_controller") {
      setActiveTab("workspace");
    } else if (user.role === "admin") {
      setActiveTab("admin_view");
    } else {
      setActiveTab("audits");
    }

    data.refreshData(handleUnauthorized);
  };

  // Auth: Logout
  const logout = async () => {
    try {
      await api("/api/auth/logout", "POST", {});
      setActiveUser(null);
      setIsAuthenticated(false);
      data.clearData();
      setCurrentAgentId("");
      setCurrentTeamLeadId("");
      setCurrentControllerId("");
      setShowLoginModal(true);
    } catch (e: any) {
      data.setError(e.message);
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
    refreshData: () => data.refreshData(handleUnauthorized),
    setError: data.setError,
    setLoading: data.setLoading,
  });

  return (
    <AppContext.Provider
      value={{
        authLoading,
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
        refreshData: () => data.refreshData(handleUnauthorized),
        assessments: data.assessments.filter((a) => !a.deleted_at),
        allAssessments: data.assessments,
        agents: data.agents,
        faults: data.faults,
        teams: data.teams,
        controllers: data.controllers,
        teamLeads: data.teamLeads,
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
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
