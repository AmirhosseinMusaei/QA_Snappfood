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
} from "../types/index.ts";
import { SEED_CONTROLLERS, SEED_TEAM_LEADS } from "../data/seedData.ts";

export interface AppContextType {
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
  theme: "light" | "dark";
  toggleTheme: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;

  navigationCounts: { needToCheck: number; pendingDisputes: number };

  // Real backend loading & error states
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;

  authLoading: boolean;
  assessments: Assessment[];
  allAssessments: Assessment[];
  agents: Agent[];
  faults: Fault[];
  teams: Team[];
  controllers: {
    id: string;
    name: string;
    display_name: string;
    username?: string;
    role?: string;
    target?: number;
  }[];
  teamLeads: {
    id: string;
    name: string;
    username?: string;
    team?: string;
    department?: string;
  }[];
  auditLogs: AuditLog[];
  settings: PortalSettings;
  problems: ProblemItem[];

  // Rubrics with versioning
  supportRubric: RubricSection[];
  salesRubric: RubricSection[];
  supportFormVersion: number;
  salesFormVersion: number;
  supportFormId: string;
  salesFormId: string;

  addAssessment: (
    assessment: Omit<Assessment, "id" | "created_at">,
  ) => Promise<Assessment>;
  updateAssessment: (id: string, updates: Partial<Assessment>) => Promise<void>;
  deleteAssessment: (id: string, revision?: number) => Promise<void>;
  restoreAssessment: (id: string) => Promise<void>;

  // Team Lead review
  markTeamLeadReviewed: (assessmentId: string, note: string) => Promise<void>;

  // Disputes
  submitDispute: (
    assessmentId: string,
    criterionId: string,
    criterionTitle: string,
    agentComment: string,
  ) => Promise<void>;
  resolveDispute: (
    assessmentId: string,
    status: "accepted" | "rejected" | "in_review",
    controllerComment: string,
    revisedScores?: Record<string, number>,
    expected?: { revision?: number; disputeId?: string },
  ) => Promise<void>;

  // Backup & Import
  resetToSeedData: () => Promise<void>;
  exportDataToJson: () => string;
  importDataFromJson: (jsonStr: string) => boolean;
  importAgentsFromCsv: (
    csvText: string,
    dryRun: boolean,
  ) => Promise<{ success: boolean; count: number; errors: string[] }>;

  // Settings & Rubric editing
  updateRubricItemWeight: (
    formType: DepartmentType,
    itemId: string,
    newWeight: number,
  ) => Promise<void>;
  updateFullRubric: (
    formType: DepartmentType,
    sections: RubricSection[],
  ) => Promise<{ success: boolean; error?: string }>;
  updateSettings: (newSettings: Partial<PortalSettings>) => Promise<void>;

  // Roster / Fault management
  addAgent: (agent: Omit<Agent, "id">) => Promise<void>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  addFault: (fault: Omit<Fault, "id">) => Promise<void>;
  updateFault: (id: string, updates: Partial<Fault>) => Promise<void>;
  deleteFault: (id: string) => Promise<void>;

  // Problems Tracker
  addProblem: (
    problem: Omit<ProblemItem, "id" | "created_at">,
  ) => Promise<void>;
  updateProblem: (id: string, updates: Partial<ProblemItem>) => Promise<void>;
  deleteProblem: (id: string) => Promise<void>;

  // Auth & Login
  isAuthenticated: boolean;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  login: (user: User) => void;
  logout: () => void;
}

export const THEME_STORAGE_KEY = "snappfood_qa_theme_v2";
