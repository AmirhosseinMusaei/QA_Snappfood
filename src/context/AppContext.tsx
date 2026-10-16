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
  ProblemItem,
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
  SEED_PROBLEMS,
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
  allAssessments: Assessment[];
  agents: Agent[];
  faults: Fault[];
  teams: Team[];
  controllers: typeof SEED_CONTROLLERS;
  teamLeads: typeof SEED_TEAM_LEADS;
  auditLogs: AuditLog[];
  settings: PortalSettings;
  problems: ProblemItem[];

  // Rubrics with versioning
  supportRubric: RubricSection[];
  salesRubric: RubricSection[];
  supportFormVersion: number;
  salesFormVersion: number;

  addAssessment: (assessment: Omit<Assessment, 'id' | 'created_at'>) => Assessment;
  updateAssessment: (id: string, updates: Partial<Assessment>) => void;
  deleteAssessment: (id: string) => void;
  restoreAssessment: (id: string) => void;

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
  updateFullRubric: (formType: DepartmentType, sections: RubricSection[]) => { success: boolean; error?: string };
  updateSettings: (newSettings: Partial<PortalSettings>) => void;

  // Roster / Fault management
  addAgent: (agent: Omit<Agent, 'id'>) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  addFault: (fault: Omit<Fault, 'id'>) => void;
  updateFault: (id: string, updates: Partial<Fault>) => void;
  deleteFault: (id: string) => void;

  // Problems Tracker
  addProblem: (problem: Omit<ProblemItem, 'id' | 'created_at'>) => void;
  updateProblem: (id: string, updates: Partial<ProblemItem>) => void;
  deleteProblem: (id: string) => void;

  // Auth & Login
  isAuthenticated: boolean;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  login: (user: User) => void;
  logout: () => void;
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
  PROBLEMS: 'snappfood_qa_problems_v2',
  ACTIVE_USER: 'snappfood_qa_active_user_v2',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROLE);
    return (saved as UserRole) || 'qa_controller';
  });

  const [activeUser, setActiveUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

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
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Error loading settings', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [problems, setProblems] = useState<ProblemItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PROBLEMS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading problems', e);
      }
    }
    return SEED_PROBLEMS;
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

  const login = (user: User) => {
    setActiveUser(user);
    setRoleState(user.role);
    setIsAuthenticated(true);
    setShowLoginModal(false);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.ROLE, user.role);

    addAuditLogEntry(
      'settings',
      user.id,
      'create',
      'user_session',
      undefined,
      `ورود موفق کاربر: ${user.name} (${user.role})`
    );
  };

  const logout = () => {
    setActiveUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    setShowLoginModal(true);
  };

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
    localStorage.setItem(STORAGE_KEYS.PROBLEMS, JSON.stringify(problems));
  }, [problems]);

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
      created_at:
        new Date().toLocaleDateString('fa-IR') +
        ' ' +
        new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
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
      prev.map((item) =>
        item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
      )
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
      prev.map((item) =>
        item.id === id ? { ...item, deleted_at: new Date().toISOString() } : item
      )
    );

    addAuditLogEntry(
      'assessment',
      id,
      'delete',
      'deleted_at',
      target?.total_score ? `نمره: ${target.total_score}` : undefined,
      'حذف ارزیابی (Soft Delete)'
    );
  };

  const restoreAssessment = (id: string) => {
    setAssessments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, deleted_at: null } : item))
    );

    addAuditLogEntry('assessment', id, 'update', 'deleted_at', 'deleted', 'بازیابی ارزیابی حذف‌شده');
  };

  const markTeamLeadReviewed = (assessmentId: string, note: string) => {
    const target = assessments.find((a) => a.id === assessmentId);
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
      target?.result,
      `بررسی شده: ${note}`
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
      created_at:
        new Date().toLocaleDateString('fa-IR') +
        ' ' +
        new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
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

    const finalScore =
      status === 'resolved' && revisedScore !== undefined ? revisedScore : target.total_score;

    const updatedDispute = {
      ...target.dispute,
      status,
      controller_id: currentUser.username,
      controller_comment: controllerComment,
      resolved_at: new Date().toLocaleDateString('fa-IR'),
      revised_score: finalScore,
    };

    // If score was revised, also update the criterion item score in rubric scores if matching
    let updatedSupportScores = target.support_scores;
    let updatedSalesScores = target.sales_scores;
    const critId = target.dispute.criterion_id;

    if (status === 'resolved' && critId && critId !== 'general') {
      if (target.form_type === 'support' && updatedSupportScores) {
        updatedSupportScores = { ...updatedSupportScores, [critId]: 5 }; // restored
      } else if (target.form_type === 'sales' && updatedSalesScores) {
        updatedSalesScores = { ...updatedSalesScores, [critId]: 5 };
      }
    }

    updateAssessment(assessmentId, {
      dispute: updatedDispute,
      total_score: finalScore,
      support_scores: updatedSupportScores,
      sales_scores: updatedSalesScores,
    });

    addAuditLogEntry(
      'dispute',
      assessmentId,
      status === 'resolved' ? 'dispute_resolved' : 'dispute_rejected',
      'revised_score',
      `${target.total_score}`,
      `نمره اصلاح‌شده: ${finalScore} | نظر کنترلر: ${controllerComment}`
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
    localStorage.removeItem(STORAGE_KEYS.PROBLEMS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);

    setAssessments(SEED_ASSESSMENTS);
    setAgents(SEED_AGENTS);
    setFaults(SEED_FAULTS);
    setAuditLogs(SEED_AUDIT_LOGS);
    setSettings(DEFAULT_SETTINGS);
    setSupportRubric(SUPPORT_RUBRIC);
    setSalesRubric(SALES_RUBRIC);
    setProblems(SEED_PROBLEMS);
    setActiveUser(null);
  };

  const exportDataToJson = () => {
    const data = {
      assessments,
      agents,
      faults,
      auditLogs,
      settings,
      problems,
      supportRubric,
      salesRubric,
    };
    return JSON.stringify(data, null, 2);
  };

  const importDataFromJson = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.assessments) setAssessments(data.assessments);
      if (data.agents) setAgents(data.agents);
      if (data.faults) setFaults(data.faults);
      if (data.settings) setSettings(data.settings);
      if (data.problems) setProblems(data.problems);
      if (data.supportRubric) setSupportRubric(data.supportRubric);
      if (data.salesRubric) setSalesRubric(data.salesRubric);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const importAgentsFromCsv = (
    csvText: string,
    dryRun: boolean
  ): { success: boolean; count: number; errors: string[] } => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return { success: false, count: 0, errors: ['فایل فاقد ردیف‌های داده است'] };
    }

    const errors: string[] = [];
    const newAgents: Agent[] = [];

    lines.slice(1).forEach((line, index) => {
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 3) {
        errors.push(`ردیف ${index + 2}: تعداد ستون‌ها ناکافی است`);
        return;
      }

      const [name, source_id, team, dept, lead, controller, panel, sample, process, minReviews] = parts;
      if (!name || !source_id) {
        errors.push(`ردیف ${index + 2}: نام کارشناس یا کد سورس خالی است`);
        return;
      }

      newAgents.push({
        id: `agent-${source_id}`,
        name,
        source_id,
        team: team || 'General',
        department: dept === 'support' || dept === 'پشتیبانی' ? 'support' : 'sales',
        team_lead: lead || 'نگین رضایی',
        controller: controller || 'meysam',
        operator_panel: panel || 'Ring',
        sample_name: sample || 'Random Sampling',
        check_process: process || 'if needed',
        min_monthly_reviews: Number(minReviews) || 40,
        active: true,
      });
    });

    if (errors.length > 0 && newAgents.length === 0) {
      return { success: false, count: 0, errors };
    }

    if (!dryRun) {
      setAgents((prev) => {
        const existingIds = new Set(prev.map((a) => a.source_id));
        const filteredNew = newAgents.filter((a) => !existingIds.has(a.source_id));
        return [...prev, ...filteredNew];
      });

      addAuditLogEntry(
        'agent',
        'roster_import',
        'create',
        'csv_import',
        undefined,
        `ایمپورت ${newAgents.length} کارشناس از فایل CSV`
      );
    }

    return { success: true, count: newAgents.length, errors };
  };

  const updateRubricItemWeight = (formType: DepartmentType, itemId: string, newWeight: number) => {
    if (formType === 'support') {
      setSupportRubric((prev) =>
        prev.map((sec) => ({
          ...sec,
          criteria: sec.criteria.map((crit) => ({
            ...crit,
            items: crit.items.map((it) => (it.id === itemId ? { ...it, maxPoints: newWeight } : it)),
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
            items: crit.items.map((it) => (it.id === itemId ? { ...it, maxPoints: newWeight } : it)),
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
      `وزن جدید: ${newWeight} (ارتقای نسخه فرم)`
    );
  };

  const updateFullRubric = (
    formType: DepartmentType,
    sections: RubricSection[]
  ): { success: boolean; error?: string } => {
    const totalMax = sections.reduce((sum, s) => sum + s.maxPoints, 0);
    if (totalMax !== 100) {
      return {
        success: false,
        error: `مجموع سقف نمرات بخش‌ها برابر ${totalMax} است. مجموع کل نمرات باید دقیقاً ۱۰۰ باشد.`,
      };
    }

    if (formType === 'support') {
      setSupportRubric(sections);
      setSupportFormVersion((v) => v + 1);
    } else {
      setSalesRubric(sections);
      setSalesFormVersion((v) => v + 1);
    }

    addAuditLogEntry(
      'rubric',
      formType,
      'rubric_updated',
      'sections',
      undefined,
      `بروزرسانی رابریک ${formType === 'support' ? 'پشتیبانی' : 'فروش'} و ارتقای نسخه فرم`
    );

    return { success: true };
  };

  const updateSettings = (newSettings: Partial<PortalSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    addAuditLogEntry(
      'settings',
      'portal_config',
      'settings_updated',
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
    addAuditLogEntry(
      'agent',
      agent.id,
      'create',
      'agent_roster',
      undefined,
      `${agent.name} (کد: ${agent.source_id} | تیم: ${agent.team})`
    );
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    const prevAgent = agents.find((a) => a.id === id);
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    addAuditLogEntry(
      'agent',
      id,
      'update',
      Object.keys(updates).join(', '),
      prevAgent?.name,
      updates.name || 'ویرایش مشخصات'
    );
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
    setFaults((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    addAuditLogEntry('fault', id, 'update', Object.keys(updates).join(', '));
  };

  const deleteFault = (id: string) => {
    const target = faults.find((f) => f.id === id);
    setFaults((prev) => prev.filter((f) => f.id !== id));
    addAuditLogEntry('fault', id, 'delete', 'title', target?.title, 'حذف خطا از ماتریس');
  };

  const addProblem = (problemData: Omit<ProblemItem, 'id' | 'created_at'>) => {
    const newProblem: ProblemItem = {
      ...problemData,
      id: `prob-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString(),
    };
    setProblems((prev) => [newProblem, ...prev]);
    addAuditLogEntry('settings', newProblem.id, 'create', 'problem_tracker', undefined, newProblem.title);
  };

  const updateProblem = (id: string, updates: Partial<ProblemItem>) => {
    setProblems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    addAuditLogEntry('settings', id, 'update', 'problem_tracker', undefined, updates.status || 'ویرایش مشکل');
  };

  const deleteProblem = (id: string) => {
    setProblems((prev) => prev.filter((p) => p.id !== id));
    addAuditLogEntry('settings', id, 'delete', 'problem_tracker');
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
        allAssessments: assessments,
        agents,
        faults,
        teams: SEED_TEAMS,
        controllers: SEED_CONTROLLERS,
        teamLeads: SEED_TEAM_LEADS,
        auditLogs,
        settings,
        problems,
        supportRubric,
        salesRubric,
        supportFormVersion,
        salesFormVersion,
        addAssessment,
        updateAssessment,
        deleteAssessment,
        restoreAssessment,
        markTeamLeadReviewed,
        submitDispute,
        resolveDispute,
        resetToSeedData,
        exportDataToJson,
        importDataFromJson,
        importAgentsFromCsv,
        updateRubricItemWeight,
        updateFullRubric,
        updateSettings,
        addAgent,
        updateAgent,
        addFault,
        updateFault,
        deleteFault,
        addProblem,
        updateProblem,
        deleteProblem,
        isAuthenticated,
        showLoginModal,
        setShowLoginModal,
        login,
        logout,
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
