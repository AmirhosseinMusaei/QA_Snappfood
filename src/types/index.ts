/**
 * Complete Data types and interfaces for SnappFood Commercial QA Portal
 */

export type UserRole =
  | "agent"
  | "team_lead"
  | "manager"
  | "qa_controller"
  | "qa_supervisor"
  | "admin";

export type DepartmentType = "support" | "sales";

export type SampleType =
  "Support group" | "bi-party" | "Dislike" | "Random Sampling" | "if needed";

export type AssessmentResult =
  "No problem" | "Need to check" | "Coaching Required" | "بررسی شده";

export type SupportFaultCategory =
  | "Snappfood problem"
  | "Vendor problem"
  | "Policy problem"
  | "Process problem"
  | "Support problem"
  | "Other teams";

export type SalesProject =
  "All Project" | "NCR" | "Promotion" | "Campaign" | "Bi-Party";

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  department?: DepartmentType;
  team?: string;
  team_id?: string;
  agent_id?: string;
  avatar?: string;
  active: boolean;
}

export interface Agent {
  id: string;
  source_id: string; // e.g. "3718"
  name: string;
  department: DepartmentType;
  user_id?: string | null;
  team_id?: string;
  team: string; // e.g. "Campaign", "Technical"
  team_lead_id?: string;
  team_lead: string; // e.g. "نگین رضایی"
  controller_id?: string;
  controller: string; // e.g. "meysam"
  operator_panel?: "Ring" | "VOIP" | "Jira" | string;
  sample_name?: string; // e.g. "Support group", "Random Sampling"
  check_process?: "if needed" | "mandatory" | string;
  min_monthly_reviews: number; // default 40
  avatar?: string;
  active: boolean;
}

export interface Team {
  id: string;
  name: string;
  department: DepartmentType;
  lead_name: string;
  lead_id?: string;
}

export interface Fault {
  id: string;
  title: string;
  department: DepartmentType | "both";
  category: string;
  is_critical: boolean; // if true, zeroes the assessment score!
  description?: string;
}

export type DisputeStatus = "open" | "in_review" | "accepted" | "rejected";

export interface Dispute {
  id: string;
  status: DisputeStatus;
  created_at: string; // Jalali timestamp e.g. "1403/07/24 14:30"
  agent_id: string;
  agent_name: string;
  criterion_id?: string;
  criterion_title?: string;
  agent_comment: string;
  controller_id?: string;
  controller_comment?: string;
  resolved_at?: string;
  original_score: number;
  revised_score?: number;
}

export interface Assessment {
  revision?: number;
  legacy_aggregate?: boolean;
  rubric?: RubricSection[] | null;
  id: string;
  agent_id: string;
  controller_id: string;
  form_type: DepartmentType;
  sample_name: SampleType;
  vendor_id?: string;
  vendor_title?: string;
  check_date: string; // Gregorian ISO string
  check_date_jalali?: string; // Derived Jalali display string e.g. "۱۴۰۳/۰۷/۲۲"
  check_date_jalali_plain?: string; // Derived Jalali plain string e.g. "1403/07/22"
  check_date_month?: string; // Derived Jalali month name e.g. "مهر"
  check_date_month_num?: number; // Derived Jalali month number e.g. 7
  check_date_year?: number; // Derived Jalali year e.g. 1403
  fault_id?: string | null;
  backend_general: boolean; // Error from backend (no penalty)
  is_fraud: boolean; // Fraudulent act (drops score to 0)
  result: AssessmentResult;
  result_comment?: string;

  // Team Lead review fields
  team_lead_reviewed?: boolean;
  team_lead_note?: string;
  team_lead_reviewed_at?: string;

  // Support Specific Fields
  ticket_number?: string;
  voice_link?: string;
  fault_categories?: SupportFaultCategory[];
  support_scores?: Record<string, number>; // Sub-item keys and awarded points
  description?: string;

  // Sales Specific Fields
  phone_number?: string;
  project?: SalesProject;
  discount_or_coupon?: string;
  registration_date?: string;
  execution_date?: string;
  mistake_count?: number; // 0=30, 1=25, 2=20, 3=15, 4=10, >=5=0
  sales_scores?: Record<string, number>;

  // Form versioning
  form_id?: string;
  form_version?: number;

  // Improvement Action Taken
  action_taken?:
    | "آموزش فردی"
    | "فیدبک"
    | "بررسی و اصلاح اسکریپت"
    | "تحلیل تماس‌ها"
    | "اصلاح فرآیند"
    | "توضیح اثر خطا"
    | string;

  // Calculated Scores
  total_score: number;
  created_at: string; // ISO string
  updated_at?: string;
  deleted_at?: string | null;

  // Dispute lifecycle
  dispute?: Dispute;
}

export interface RubricSubItem {
  id: string;
  title: string;
  maxPoints: number;
}

export interface RubricCriterion {
  id: string;
  title: string;
  maxPoints: number;
  items: RubricSubItem[];
}

export interface RubricSection {
  id: string;
  title: string;
  maxPoints: number;
  criteria: RubricCriterion[];
}

export interface AssessmentFormConfig {
  id: string;
  form_type: DepartmentType;
  title: string;
  version: number;
  sections: RubricSection[];
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  entity: "assessment" | "dispute" | "agent" | "rubric" | "fault" | "settings";
  entity_id: string;
  action:
    | "create"
    | "update"
    | "delete"
    | "dispute_filed"
    | "dispute_in_review"
    | "dispute_resolved"
    | "dispute_rejected"
    | "team_lead_reviewed"
    | "rubric_updated"
    | "settings_updated";
  field?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface PortalSettings {
  result_options?: string[];
  dispute_window_days: number;
  min_monthly_reviews_default: number;
  controller_monthly_target: number; // default 160
  sales_mistake_deductions: Record<number, number>; // count -> score
  high_quality_threshold: number; // default 95
  low_quality_threshold: number; // default 80
  fraud_penalty_single: number; // 0 (zeroes score)
  fraud_penalty_monthly_1: number; // -10 points
  fraud_penalty_monthly_multiple: number; // 0 (zeroes monthly score)
}

export interface ProblemItem {
  id: string;
  priority: "High" | "Medium" | "Low" | "Critical";
  issue_date: string; // Jalali date e.g. "۱۴۰۳/۰۷/۱۰"
  team: string;
  category: string;
  title: string;
  description: string;
  status: "Pending" | "Resolved";
  owner: string;
  resolved_at?: string;
  solution_note?: string;
  created_at: string;
}
