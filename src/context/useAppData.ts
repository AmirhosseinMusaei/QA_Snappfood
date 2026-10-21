import { useState, useCallback } from 'react';
import {
  Assessment,
  Agent,
  Fault,
  Team,
  AuditLog,
  PortalSettings,
  ProblemItem,
  RubricSection,
} from '../types/index.ts';
import { DEFAULT_SETTINGS } from '../data/seedData.ts';
import { SUPPORT_RUBRIC, SALES_RUBRIC } from '../utils/scoring.ts';

export function useAppData() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize with empty arrays - never fall back to seed business data
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [faults, setFaults] = useState<Fault[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_SETTINGS);
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [controllers, setControllers] = useState<{ id: string; name: string; display_name: string; username?: string; role?: string; target?: number }[]>([]);
  const [teamLeads, setTeamLeads] = useState<{ id: string; name: string; username?: string; team?: string; department?: string }[]>([]);

  const [supportRubric, setSupportRubric] = useState<RubricSection[]>(SUPPORT_RUBRIC);
  const [salesRubric, setSalesRubric] = useState<RubricSection[]>(SALES_RUBRIC);
  const [supportFormVersion, setSupportFormVersion] = useState<number>(1);
  const [salesFormVersion, setSalesFormVersion] = useState<number>(1);
  const [supportFormId, setSupportFormId] = useState<string>('form-support-v1');
  const [salesFormId, setSalesFormId] = useState<string>('form-sales-v1');

  const clearData = useCallback(() => {
    setAssessments([]);
    setAgents([]);
    setTeams([]);
    setFaults([]);
    setAuditLogs([]);
    setProblems([]);
    setControllers([]);
    setTeamLeads([]);
  }, []);

  const refreshAuditLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAuditLogs(json.data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    }
  }, []);

  const refreshData = useCallback(async (onUnauthorized?: () => void) => {
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
      ] = await Promise.all([
        fetch('/api/assessments?include_deleted=true'),
        fetch('/api/agents'),
        fetch('/api/teams'),
        fetch('/api/faults'),
        fetch('/api/forms'),
        fetch('/api/settings'),
        fetch('/api/problems'),
        fetch('/api/audit-logs'),
        fetch('/api/staff'),
      ]);

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

      if (assessmentsRes.ok) {
        const j = await assessmentsRes.json();
        if (j.success && Array.isArray(j.data)) setAssessments(j.data);
      }
      if (agentsRes.ok) {
        const j = await agentsRes.json();
        if (j.success && Array.isArray(j.data)) setAgents(j.data);
      }
      if (teamsRes.ok) {
        const j = await teamsRes.json();
        if (j.success && Array.isArray(j.data)) setTeams(j.data);
      }
      if (faultsRes.ok) {
        const j = await faultsRes.json();
        if (j.success && Array.isArray(j.data)) setFaults(j.data);
      }
      if (formsRes.ok) {
        const j = await formsRes.json();
        if (j.success) {
          if (j.supportRubric) setSupportRubric(j.supportRubric);
          if (j.salesRubric) setSalesRubric(j.salesRubric);
          if (j.supportFormVersion) setSupportFormVersion(j.supportFormVersion);
          if (j.salesFormVersion) setSalesFormVersion(j.salesFormVersion);
          if (j.supportFormId) setSupportFormId(j.supportFormId);
          if (j.salesFormId) setSalesFormId(j.salesFormId);
        }
      }
      if (settingsRes.ok) {
        const j = await settingsRes.json();
        if (j.success && j.data) setSettings(j.data);
      }
      if (problemsRes.ok) {
        const j = await problemsRes.json();
        if (j.success && Array.isArray(j.data)) setProblems(j.data);
      }
      if (auditLogsRes.ok) {
        const j = await auditLogsRes.json();
        if (j.success && Array.isArray(j.data)) setAuditLogs(j.data);
      }
      if (staffRes.ok) {
        const j = await staffRes.json();
        if (j.success) {
          if (Array.isArray(j.controllers)) {
            setControllers(
              j.controllers.map((c: any) => ({
                id: c.id,
                name: c.name,
                display_name: c.display_name || c.name,
                username: c.username,
                role: c.role,
                target: c.target || 200,
              }))
            );
          }
          if (Array.isArray(j.teamLeads)) setTeamLeads(j.teamLeads);
        }
      }
    } catch (err: any) {
      console.error('Error connecting to backend REST API:', err);
      setError('خطا در ارتباط با سرور پایگاه داده. لطفاً ارتباط را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  }, [clearData]);

  return {
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
