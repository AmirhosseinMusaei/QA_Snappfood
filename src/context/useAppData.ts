import { useState, useCallback, useRef } from "react";
import {
  Assessment,
  Agent,
  Fault,
  Team,
  AuditLog,
  PortalSettings,
  ProblemItem,
  RubricSection,
} from "../types/index.ts";
import { DEFAULT_SETTINGS } from "../data/seedData.ts";
import { SUPPORT_RUBRIC, SALES_RUBRIC } from "../utils/scoring.ts";

export function useAppData() {
  const epoch = useRef(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize with empty arrays - never fall back to seed business data
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [faults, setFaults] = useState<Fault[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_SETTINGS);
  const [navigationCounts, setNavigationCounts] = useState({
    needToCheck: 0,
    pendingDisputes: 0,
  });
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [controllers, setControllers] = useState<
    {
      id: string;
      name: string;
      display_name: string;
      username?: string;
      role?: string;
      target?: number;
    }[]
  >([]);
  const [teamLeads, setTeamLeads] = useState<
    {
      id: string;
      name: string;
      username?: string;
      team?: string;
      department?: string;
    }[]
  >([]);

  const [supportRubric, setSupportRubric] =
    useState<RubricSection[]>(SUPPORT_RUBRIC);
  const [salesRubric, setSalesRubric] = useState<RubricSection[]>(SALES_RUBRIC);
  const [supportFormVersion, setSupportFormVersion] = useState<number>(1);
  const [salesFormVersion, setSalesFormVersion] = useState<number>(1);
  const [supportFormId, setSupportFormId] = useState<string>("form-support-v1");
  const [salesFormId, setSalesFormId] = useState<string>("form-sales-v1");

  const clearData = useCallback(() => {
    epoch.current++;
    setAssessments([]);
    setAgents([]);
    setTeams([]);
    setFaults([]);
    setAuditLogs([]);
    setProblems([]);
    setNavigationCounts({ needToCheck: 0, pendingDisputes: 0 });
    setControllers([]);
    setTeamLeads([]);
  }, []);

  const refreshAuditLogs = useCallback(async () => {
    const expected = epoch.current;
    try {
      const [res, counts] = await Promise.all([
        fetch("/api/audit-logs"),
        fetch("/api/navigation-counts"),
      ]);
      if (counts.ok) {
        const value = await counts.json();
        if (expected === epoch.current && value.success)
          setNavigationCounts(value.data);
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          if (expected === epoch.current) setAuditLogs(json.data);
        }
      }
    } catch (e) {
      console.error("Failed to fetch audit logs:", e);
    }
  }, []);

  const refreshData = useCallback(
    async (onUnauthorized?: () => void) => {
      const requestEpoch = epoch.current;
      try {
        setLoading(true);
        setError(null);

        const [
          assessmentsRes,
          agentsRes,
          teamsRes,
          faultsRes,
          formsRes,
          settingsRes,
          problemsRes,
          auditLogsRes,
          staffRes,
          countsRes,
        ] = await Promise.all([
          fetch("/api/assessments?page=1&limit=20"),
          fetch("/api/agents"),
          fetch("/api/teams"),
          fetch("/api/faults"),
          fetch("/api/forms"),
          fetch("/api/settings"),
          fetch("/api/problems"),
          fetch("/api/audit-logs"),
          fetch("/api/staff"),
          fetch("/api/navigation-counts"),
        ]);

        if (requestEpoch !== epoch.current) return;
        // If unauthorized on any primary route, clear sensitive data immediately
        if (
          assessmentsRes.status === 401 ||
          agentsRes.status === 401 ||
          teamsRes.status === 401
        ) {
          clearData();
          if (onUnauthorized) onUnauthorized();
          return;
        }

        const responses = [
          assessmentsRes,
          agentsRes,
          teamsRes,
          faultsRes,
          formsRes,
          settingsRes,
          problemsRes,
          auditLogsRes,
          staffRes,
          countsRes,
        ];
        const payloads = await Promise.all(
          responses.map((r) => (r.ok ? r.json() : Promise.resolve(null))),
        );
        if (requestEpoch !== epoch.current) return;
        const [a, g, t, f, forms, config, p, logs, staff, counts] = payloads;
        if (counts?.success) setNavigationCounts(counts.data);
        if (a?.success) setAssessments(a.data);
        if (g?.success) setAgents(g.data);
        if (t?.success) setTeams(t.data);
        if (f?.success) setFaults(f.data);
        if (forms?.success) {
          setSupportRubric(forms.supportRubric);
          setSalesRubric(forms.salesRubric);
          setSupportFormVersion(forms.supportFormVersion);
          setSalesFormVersion(forms.salesFormVersion);
          setSupportFormId(forms.supportFormId);
          setSalesFormId(forms.salesFormId);
        }
        if (config?.success) setSettings(config.data);
        setProblems(p?.success ? p.data : []);
        setAuditLogs(logs?.success ? logs.data : []);
        if (staff?.success) {
          setControllers(staff.controllers);
          setTeamLeads(staff.teamLeads);
        }
        if (responses.slice(0, 6).some((r) => !r.ok && r.status !== 403))
          setError("دریافت بخشی از داده‌ها ناموفق بود؛ دوباره تلاش کنید.");
      } catch (err: any) {
        console.error("Error connecting to backend REST API:", err);
        if (requestEpoch === epoch.current)
          setError(
            "خطا در ارتباط با سرور پایگاه داده. لطفاً ارتباط را بررسی کنید.",
          );
      } finally {
        if (requestEpoch === epoch.current) setLoading(false);
      }
    },
    [clearData],
  );

  return {
    navigationCounts,
    loading,
    setLoading,
    error,
    setError,
    assessments,
    setAssessments,
    agents,
    setAgents,
    teams,
    setTeams,
    controllers,
    setControllers,
    teamLeads,
    setTeamLeads,
    faults,
    setFaults,
    auditLogs,
    setAuditLogs,
    settings,
    setSettings,
    problems,
    setProblems,
    supportRubric,
    setSupportRubric,
    salesRubric,
    setSalesRubric,
    supportFormVersion,
    setSupportFormVersion,
    salesFormVersion,
    setSalesFormVersion,
    supportFormId,
    setSupportFormId,
    salesFormId,
    setSalesFormId,
    refreshAuditLogs,
    refreshData,
    clearData,
  };
}
