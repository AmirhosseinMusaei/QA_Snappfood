import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserRole,
  Assessment,
  Agent,
  Fault,
  Team,
  DepartmentType,
  AuditLog,
  PortalSettings,
  User,
  RubricSection,
} from '../types/index.ts';
import {
  SEED_ASSESSMENTS,
  SEED_AGENTS,
  SEED_FAULTS,
  SEED_TEAMS,
  SEED_CONTROLLERS,
  SEED_TEAM_LEADS,
  SEED_AUDIT_LOGS,
  DEFAULT_SETTINGS,
  SEED_USERS,
} from '../data/seedData.ts';
import { SUPPORT_RUBRIC, SALES_RUBRIC } from '../utils/scoring.ts';

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  currentUser: User;
  currentAgentId: string;
  setCurrentAgentId: (id: string) => void;
  currentTeamLeadId: string;
  setCurrentTeamLeadId: (id: string) => void;
  currentManagerDept: DepartmentType;
  setCurrentManagerDept: (dept: DepartmentType) => void;
  currentControllerId: string;
  setCurrentControllerId: (id: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;

  assessments: Assessment[];
  agents: Agent[];
  faults: Fault[];
  teams: Team[];
  controllers: typeof SEED_CONTROLLERS;
  teamLeads: typeof SEED_TEAM_LEADS;
  auditLogs: AuditLog[];
  settings: PortalSettings;

  // Rubrics with versioning
  supportRubric: RubricSection[];
  salesRubric: RubricSection[];
  supportFormVersion: number;
  salesFormVersion: number;

  addAssessment: (assessment: Omit<Assessment, 'id' | 'created_at'>) => Assessment;
  updateAssessment: (id: string, updates: Partial<Assessment>) => void;
  deleteAssessment: (id: string) => void;

  // Team Lead review
  markTeamLeadReviewed: (assessmentId: string, note: string) => void;

  // Disputes
  submitDispute: (
    assessmentId: string,
    criterionId: string,
    criterionTitle: string,
    agentComment: string
  ) => void;
  resolveDispute: (
    assessmentId: string,
    status: 'resolved' | 'rejected',
    controllerComment: string,
    revisedScore?: number
  ) => void;

  // Backup & Import
  resetToSeedData: () => void;
  exportDataToJson: () => string;
  importDataFromJson: (jsonStr: string) => boolean;
  importAgentsFromCsv: (csvText: string, dryRun: boolean) => { success: boolean; count: number; errors: string[] };

  // Settings & Rubric editing
  updateRubricItemWeight: (formType: DepartmentType, itemId: string, newWeight: number) => void;
  updateSettings: (newSettings: Partial<PortalSettings>) => void;

  // Roster / Fault management
  addAgent: (agent: Omit<Agent, 'id'>) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  addFault: (fault: Omit<Fault, 'id'>) => void;
  updateFault: (id: string, updates: Partial<Fault>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEYS = {
  ASSESSMENTS: 'snappfood_qa_assessments_v2',
  AGENTS: 'snappfood_qa_agents_v2',
  FAULTS: 'snappfood_qa_faults_v2',
  THEME: 'snappfood_qa_theme_v2',
  ROLE: 'snappfood_qa_role_v2',
  AUDIT_LOGS: 'snappfood_qa_logs_v2',
  SETTINGS: 'snappfood_qa_settings_v2',
  SUPPORT_RUBRIC: 'snappfood_qa_rubric_support_v2',
  SALES_RUBRIC: 'snappfood_qa_rubric_sales_v2',
  VERSIONS: 'snappfood_qa_versions_v2',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROLE);
    return (saved as UserRole) || 'qa_controller';
  });

  const [currentAgentId, setCurrentAgentId] = useState<string>('agent-3718'); // Mahya Mamizadeh default
  const [currentTeamLeadId, setCurrentTeamLeadId] = useState<string>('negin');
  const [currentManagerDept, setCurrentManagerDept] = useState<DepartmentType>('sales');
  const [currentControllerId, setCurrentControllerId] = useState<string>('meysam');
  const [activeTab, setActiveTab] = useState<string>('workspace');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return (saved as 'light' | 'dark') || 'light';
  });

  const [assessments, setAssessments] = useState<Assessment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading assessments', e);
      }
    }
    return SEED_ASSESSMENTS;
  });

  const [agents, setAgents] = useState<Agent[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AGENTS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading agents', e);
      }
    }
    return SEED_AGENTS;
  });

  const [faults, setFaults] = useState<Fault[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FAULTS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading faults', e);
      }
    }
    return SEED_FAULTS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading audit logs', e);
      }
    }
    return SEED_AUDIT_LOGS;
  });

  const [settings, setSettings] = useState<PortalSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading settings', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [supportRubric, setSupportRubric] = useState<RubricSection[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SUPPORT_RUBRIC);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return SUPPORT_RUBRIC;
  });

  const [salesRubric, setSalesRubric] = useState<RubricSection[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SALES_RUBRIC);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return SALES_RUBRIC;
  });

  const [supportFormVersion, setSupportFormVersion] = useState<number>(1);
  const [salesFormVersion, setSalesFormVersion] = useState<number>(1);

  // Current logged in user object based on active role
  const currentUser: User = (() => {
    const u = SEED_USERS.find((item) => item.role === role);
    return (
      u || {
        id: `usr-${role}`,
        username: role,
        name: role === 'agent' ? 'کارشناس' : 'کاربر سیستم',
        role,
        active: true,
      }
    );
  })();

  // Keep theme class synced on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(assessments));
  }, [assessments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FAULTS, JSON.stringify(faults));
  }, [faults]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUPPORT_RUBRIC, JSON.stringify(supportRubric));
    localStorage.setItem(STORAGE_KEYS.SALES_RUBRIC, JSON.stringify(salesRubric));
  }, [supportRubric, salesRubric]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem(STORAGE_KEYS.ROLE, newRole);

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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const addAuditLogEntry = (
    entity: AuditLog['entity'],
    entity_id: string,
    action: AuditLog['action'],
    field?: string,
    old_value?: string,
    new_value?: string
  ) => {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_role: role,
      entity,
      entity_id,
      action,
      field,
      old_value,
      new_value,
      created_at: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };
    setAuditLogs((prev) => [log, ...prev]);
  };

  const addAssessment = (assessmentData: Omit<Assessment, 'id' | 'created_at'>): Assessment => {
    const newId = `qa-${Date.now().toString().slice(-6)}`;
    const newAssessment: Assessment = {
      ...assessmentData,
      id: newId,
      created_at: new Date().toISOString(),
    };
    setAssessments((prev) => [newAssessment, ...prev]);

    addAuditLogEntry(
      'assessment',
      newId,
      'create',
      'total_score',
      undefined,
      `نمره: ${newAssessment.total_score} | وندور: ${newAssessment.vendor_id || newAssessment.vendor_title}`
    );

    return newAssessment;
  };

  const updateAssessment = (id: string, updates: Partial<Assessment>) => {
    const current = assessments.find((a) => a.id === id);
    setAssessments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item))
    );

    if (current) {
      addAuditLogEntry(
        'assessment',
        id,
        'update',
        Object.keys(updates).join(', '),
        `نمره قبلی: ${current.total_score}`,
        updates.total_score !== undefined ? `نمره جدید: ${updates.total_score}` : undefined
      );
    }
  };

  const deleteAssessment = (id: string) => {
    const target = assessments.find((a) => a.id === id);
    // Soft delete
    setAssessments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, deleted_at: new Date().toISOString() } : item))
    );

    addAuditLogEntry('assessment', id, 'delete', 'deleted_at', undefined, 'حذف ارزیابی (Soft Delete)');
  };

  const markTeamLeadReviewed = (assessmentId: string, note: string) => {
    updateAssessment(assessmentId, {
      result: 'بررسی شده',
      team_lead_reviewed: true,
      team_lead_note: note,
      team_lead_reviewed_at: new Date().toLocaleDateString('fa-IR'),
    });

    addAuditLogEntry(
      'assessment',
      assessmentId,
      'team_lead_reviewed',
      'team_lead_note',
      undefined,
      note
    );
  };

  const submitDispute = (
    assessmentId: string,
    criterionId: string,
    criterionTitle: string,
    agentComment: string
  ) => {
    const target = assessments.find((a) => a.id === assessmentId);
    if (!target) return;

    const currentAgent = agents.find((a) => a.id === target.agent_id);

    const dispute = {
      id: `disp-${Date.now().toString().slice(-4)}`,
      status: 'pending' as const,
      created_at: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      agent_id: target.agent_id,
      agent_name: currentAgent?.name || 'کارشناس',
      criterion_id: criterionId,
      criterion_title: criterionTitle,
      agent_comment: agentComment,
      original_score: target.total_score,
    };

    updateAssessment(assessmentId, { dispute });

    addAuditLogEntry(
      'dispute',
      assessmentId,
      'dispute_filed',
      'criterion',
      undefined,
      `${criterionTitle}: ${agentComment}`
    );
  };

  const resolveDispute = (
    assessmentId: string,
    status: 'resolved' | 'rejected',
    controllerComment: string,
    revisedScore?: number
  ) => {
    const target = assessments.find((a) => a.id === assessmentId);
    if (!target || !target.dispute) return;

    const updatedDispute = {
      ...target.dispute,
      status,
      controller_id: currentUser.username,
      controller_comment: controllerComment,
      resolved_at: new Date().toLocaleDateString('fa-IR'),
      revised_score: status === 'resolved' && revisedScore !== undefined ? revisedScore : target.total_score,
    };

    const finalScore =
      status === 'resolved' && revisedScore !== undefined ? revisedScore : target.total_score;

    updateAssessment(assessmentId, {
      dispute: updatedDispute,
      total_score: finalScore,
    });

    addAuditLogEntry(
      'dispute',
      assessmentId,
      status === 'resolved' ? 'dispute_resolved' : 'dispute_rejected',
      'revised_score',
      `${target.total_score}`,
      `${finalScore} (${controllerComment})`
    );
  };

  const resetToSeedData = () => {
    localStorage.removeItem(STORAGE_KEYS.ASSESSMENTS);
    localStorage.removeItem(STORAGE_KEYS.AGENTS);
    localStorage.removeItem(STORAGE_KEYS.FAULTS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.SUPPORT_RUBRIC);
    localStorage.removeItem(STORAGE_KEYS.SALES_RUBRIC);
    setAssessments(SEED_ASSESSMENTS);
    setAgents(SEED_AGENTS);
    setFaults(SEED_FAULTS);
    setAuditLogs(SEED_AUDIT_LOGS);
    setSettings(DEFAULT_SETTINGS);
    setSupportRubric(SUPPORT_RUBRIC);
    setSalesRubric(SALES_RUBRIC);
  };

  const exportDataToJson = (): string => {
    const exportData = {
      version: '2.0',
      exported_at: new Date().toISOString(),
      assessments,
      agents,
      faults,
      auditLogs,
      settings,
    };
    return JSON.stringify(exportData, null, 2);
  };

  const importDataFromJson = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.assessments)) setAssessments(parsed.assessments);
      if (Array.isArray(parsed.agents)) setAgents(parsed.agents);
      if (Array.isArray(parsed.faults)) setFaults(parsed.faults);
      if (Array.isArray(parsed.auditLogs)) setAuditLogs(parsed.auditLogs);
      if (parsed.settings) setSettings(parsed.settings);
      return true;
    } catch (err) {
      console.error('Import failed', err);
      return false;
    }
  };

  const importAgentsFromCsv = (
    csvText: string,
    dryRun: boolean
  ): { success: boolean; count: number; errors: string[] } => {
    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) {
      return { success: false, count: 0, errors: ['فایل خالی است یا فقط هدر دارد'] };
    }

    const errors: string[] = [];
    const validAgents: Agent[] = [];

    // Header: Agent, Source, Team, Operator panel, Controller, Team Leads, Minimum review
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 2) {
        errors.push(`سطر ${i + 1}: داده‌های ناکافی`);
        continue;
      }

      const [name, source_id, team, operator_panel, controller, team_lead, min_reviews] = parts;
      if (!name || !source_id) {
        errors.push(`سطر ${i + 1}: نام یا کد سورس کارشناس خالی است`);
        continue;
      }

      const department: DepartmentType =
        team && ['Technical', 'Content', 'General'].includes(team) ? 'support' : 'sales';

      validAgents.push({
        id: `agent-${source_id}`,
        name,
        source_id,
        team: team || 'General',
        department,
        team_lead: team_lead || 'حسین جدیری',
        controller: controller || 'meysam',
        operator_panel: operator_panel || 'CRM Sales',
        min_monthly_reviews: parseInt(min_reviews, 10) || 40,
        active: true,
      });
    }

    if (!dryRun && validAgents.length > 0) {
      setAgents((prev) => {
        const merged = [...prev];
        validAgents.forEach((va) => {
          const idx = merged.findIndex((a) => a.source_id === va.source_id);
          if (idx >= 0) {
            merged[idx] = va;
          } else {
            merged.push(va);
          }
        });
        return merged;
      });

      addAuditLogEntry(
        'agent',
        'roster_import',
        'create',
        'csv_import',
        undefined,
        `ورود ${validAgents.length} کارشناس از فایل CSV`
      );
    }

    return {
      success: errors.length === 0,
      count: validAgents.length,
      errors,
    };
  };

  const updateRubricItemWeight = (
    formType: DepartmentType,
    itemId: string,
    newWeight: number
  ) => {
    if (formType === 'support') {
      setSupportRubric((prev) =>
        prev.map((sec) => ({
          ...sec,
          criteria: sec.criteria.map((crit) => ({
            ...crit,
            items: crit.items.map((item) =>
              item.id === itemId ? { ...item, maxPoints: newWeight } : item
            ),
          })),
        }))
      );
      setSupportFormVersion((v) => v + 1);
    } else {
      setSalesRubric((prev) =>
        prev.map((sec) => ({
          ...sec,
          criteria: sec.criteria.map((crit) => ({
            ...crit,
            items: crit.items.map((item) =>
              item.id === itemId ? { ...item, maxPoints: newWeight } : item
            ),
          })),
        }))
      );
      setSalesFormVersion((v) => v + 1);
    }

    addAuditLogEntry(
      'rubric',
      `${formType}_${itemId}`,
      'update',
      'maxPoints',
      undefined,
      `وزن جدید: ${newWeight} (ارتقای نسخه فرم به ۲)`
    );
  };

  const updateSettings = (newSettings: Partial<PortalSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    addAuditLogEntry(
      'settings',
      'portal_config',
      'update',
      Object.keys(newSettings).join(', '),
      undefined,
      JSON.stringify(newSettings)
    );
  };

  const addAgent = (newAgent: Omit<Agent, 'id'>) => {
    const agent: Agent = {
      ...newAgent,
      id: `agent-${newAgent.source_id || Date.now().toString().slice(-4)}`,
    };
    setAgents((prev) => [...prev, agent]);
    addAuditLogEntry('agent', agent.id, 'create', 'agent_roster', undefined, `${agent.name} (${agent.source_id})`);
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
    addAuditLogEntry('agent', id, 'update', Object.keys(updates).join(', '));
  };

  const addFault = (newFault: Omit<Fault, 'id'>) => {
    const fault: Fault = {
      ...newFault,
      id: `fault-${Date.now().toString().slice(-4)}`,
    };
    setFaults((prev) => [...prev, fault]);
    addAuditLogEntry('fault', fault.id, 'create', 'title', undefined, fault.title);
  };

  const updateFault = (id: string, updates: Partial<Fault>) => {
    setFaults((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
    addAuditLogEntry('fault', id, 'update', Object.keys(updates).join(', '));
  };

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
        assessments: assessments.filter((a) => !a.deleted_at),
        agents,
        faults,
        teams: SEED_TEAMS,
        controllers: SEED_CONTROLLERS,
        teamLeads: SEED_TEAM_LEADS,
        auditLogs,
        settings,
        supportRubric,
        salesRubric,
        supportFormVersion,
        salesFormVersion,
        addAssessment,
        updateAssessment,
        deleteAssessment,
        markTeamLeadReviewed,
        submitDispute,
        resolveDispute,
        resetToSeedData,
        exportDataToJson,
        importDataFromJson,
        importAgentsFromCsv,
        updateRubricItemWeight,
        updateSettings,
        addAgent,
        updateAgent,
        addFault,
        updateFault,
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
