import { api as checkedApi } from "../utils/api.ts";
import React from "react";
import {
  Assessment,
  Agent,
  Fault,
  ProblemItem,
  PortalSettings,
  RubricSection,
  DepartmentType,
  User,
} from "../types/index.ts";
import { validateRubricDefinition } from "../utils/scoring.ts";

interface UseAppMutationsProps {
  currentUser: User;
  assessments: Assessment[];
  setAssessments: React.Dispatch<React.SetStateAction<Assessment[]>>;
  agents: Agent[];
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  faults: Fault[];
  setFaults: React.Dispatch<React.SetStateAction<Fault[]>>;
  problems: ProblemItem[];
  setProblems: React.Dispatch<React.SetStateAction<ProblemItem[]>>;
  settings: PortalSettings;
  setSettings: React.Dispatch<React.SetStateAction<PortalSettings>>;
  supportRubric: RubricSection[];
  setSupportRubric: React.Dispatch<React.SetStateAction<RubricSection[]>>;
  salesRubric: RubricSection[];
  setSalesRubric: React.Dispatch<React.SetStateAction<RubricSection[]>>;
  supportFormVersion: number;
  setSupportFormVersion: React.Dispatch<React.SetStateAction<number>>;
  salesFormVersion: number;
  setSalesFormVersion: React.Dispatch<React.SetStateAction<number>>;
  supportFormId: string;
  setSupportFormId: React.Dispatch<React.SetStateAction<string>>;
  salesFormId: string;
  setSalesFormId: React.Dispatch<React.SetStateAction<string>>;
  refreshAuditLogs: () => Promise<void>;
  refreshData: () => Promise<void>;
  setError: (err: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export function useAppMutations({
  currentUser,
  assessments,
  setAssessments,
  agents,
  setAgents,
  faults,
  setFaults,
  problems,
  setProblems,
  settings,
  setSettings,
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
  setError,
  setLoading,
}: UseAppMutationsProps) {
  const identity = React.useRef(currentUser.id);
  identity.current = currentUser.id;
  const api = async <T = any>(
    ...args: Parameters<typeof checkedApi>
  ): Promise<T> => {
    const user = currentUser.id;
    const response = await checkedApi<T>(...args);
    if (identity.current !== user)
      throw new Error("نشست کاربری تغییر کرده است");
    return response;
  };
  const run = async <T>(operation: () => Promise<T>): Promise<T> => {
    setError(null);
    try {
      return await operation();
    } catch (e: any) {
      if (identity.current === currentUser.id)
        setError(e.message || "عملیات انجام نشد");
      throw e;
    }
  };
  const applyAssessment = (record: Assessment) =>
    setAssessments((prev) =>
      prev.some((a) => a.id === record.id)
        ? prev.map((a) => (a.id === record.id ? record : a))
        : [record, ...prev],
    );
  const addAssessment = async (
    data: Omit<Assessment, "id" | "created_at">,
  ): Promise<Assessment> =>
    run(async () => {
      const key = crypto.randomUUID();
      const { total_score, ...payload } = data;
      let response;
      try {
        response = await api("/api/assessments", "POST", payload, {
          "Idempotency-Key": key,
        });
      } catch (e: any) {
        if (e.code !== "DUPLICATE_TICKET" || !window.confirm(e.message))
          throw e;
        response = await api(
          "/api/assessments",
          "POST",
          { ...payload, confirm_duplicate: true },
          { "Idempotency-Key": key },
        );
      }
      applyAssessment(response.data);
      await refreshAuditLogs();
      return response.data;
    });
  const updateAssessment = async (id: string, updates: Partial<Assessment>) =>
    run(async () => {
      const revision =
        updates.revision ?? assessments.find((a) => a.id === id)?.revision;
      const response = await api(`/api/assessments/${id}`, "PUT", {
        ...updates,
        revision,
      });
      applyAssessment(response.data);
      await refreshAuditLogs();
    });
  const deleteAssessment = async (id: string, revision?: number) =>
    run(async () => {
      await api(`/api/assessments/${id}`, "DELETE", {
        revision: revision ?? assessments.find((a) => a.id === id)?.revision,
      });
      await refreshData();
    });
  const restoreAssessment = async (id: string) =>
    run(async () => {
      const r = await api(`/api/assessments/${id}/restore`, "POST", {});
      applyAssessment(r.data);
      await refreshAuditLogs();
    });
  const markTeamLeadReviewed = async (id: string, note: string) =>
    run(async () => {
      const r = await api(`/api/assessments/${id}/review`, "POST", { note });
      applyAssessment(r.data);
      await refreshAuditLogs();
    });
  const submitDispute = async (
    id: string,
    criterion_id: string,
    criterion_title: string,
    agent_comment: string,
  ) =>
    run(async () => {
      await api(`/api/assessments/${id}/dispute`, "POST", {
        criterion_id,
        criterion_title,
        agent_comment,
      });
      const r = await api(`/api/assessments/${id}`);
      applyAssessment(r.data);
      await refreshAuditLogs();
    });
  const resolveDispute = async (
    id: string,
    status: "accepted" | "rejected" | "in_review",
    controller_comment: string,
    item_scores?: Record<string, number>,
    expected?: { revision?: number; disputeId?: string },
  ) =>
    run(async () => {
      const target =
        assessments.find((a) => a.id === id) ||
        (await api(`/api/assessments/${id}`)).data;
      if (!target?.dispute)
        throw new Error("اعتراض یافت نشد؛ صفحه را تازه کنید");
      const r = await api(
        `/api/disputes/${expected?.disputeId || target.dispute.id}/resolve`,
        "PUT",
        {
          status,
          controller_comment,
          item_scores,
          revision: expected?.revision ?? target.revision,
        },
      );
      applyAssessment(r.data);
      await refreshAuditLogs();
    });
  const resetToSeedData = async () =>
    run(async () => {
      await api("/api/system/reset-seed", "POST", {});
      await refreshData();
    });
  const exportDataToJson = () =>
    JSON.stringify(
      {
        assessments,
        agents,
        faults,
        settings,
        problems,
        notice: "This is a scoped UI snapshot, not a full database backup.",
      },
      null,
      2,
    );
  const importDataFromJson = (_json: string) => {
    setError(
      "بازیابی JSON در مرورگر مجاز نیست؛ از واردسازی معتبر CSV یا بازیابی دیتابیس استفاده کنید.",
    );
    return false;
  };
  const importAgentsFromCsv = async (csvText: string, dryRun: boolean) => {
    try {
      const r = await api("/api/agents/import-csv", "POST", {
        csvText,
        dryRun,
      });
      if (!dryRun) await refreshData();
      return r;
    } catch (e: any) {
      return { success: false, count: 0, errors: [e.message] };
    }
  };
  const updateFullRubric = async (
    formType: DepartmentType,
    sections: RubricSection[],
  ): Promise<{ success: boolean; error?: string }> => {
    const valid = validateRubricDefinition(formType, sections);
    if (!valid.isValid) return { success: false, error: valid.error };
    try {
      const r = await api(`/api/forms/${formType}`, "PUT", {
        sections,
        expected_version:
          formType === "sales" ? salesFormVersion : supportFormVersion,
      });
      if (formType === "sales") {
        setSalesRubric(r.canonicalRubric);
        setSalesFormVersion(r.version);
        setSalesFormId(r.formId);
      } else {
        setSupportRubric(r.canonicalRubric);
        setSupportFormVersion(r.version);
        setSupportFormId(r.formId);
      }
      await refreshAuditLogs();
      return { success: true };
    } catch (e: any) {
      setError(e.message);
      return { success: false, error: e.message };
    }
  };
  const updateRubricItemWeight = async (
    type: DepartmentType,
    id: string,
    weight: number,
  ) => {
    const sections = (type === "sales" ? salesRubric : supportRubric).map(
      (s) => {
        const criteria = s.criteria.map((c) => {
          const items = c.items.map((i) =>
            i.id === id ? { ...i, maxPoints: weight } : i,
          );
          return {
            ...c,
            items,
            maxPoints: items.reduce((n, i) => n + i.maxPoints, 0),
          };
        });
        return {
          ...s,
          criteria,
          maxPoints: criteria.reduce((n, c) => n + c.maxPoints, 0),
        };
      },
    );
    const result = await updateFullRubric(type, sections);
    if (!result.success) throw new Error(result.error);
  };
  const updateSettings = async (changes: Partial<PortalSettings>) =>
    run(async () => {
      const r = await api("/api/settings", "PUT", {
        settings: { ...settings, ...changes },
      });
      setSettings(r.data);
      await refreshAuditLogs();
    });
  const addAgent = async (b: Omit<Agent, "id">) =>
    run(async () => {
      const r = await api("/api/agents", "POST", b);
      setAgents((p) => [...p, r.data]);
      await refreshAuditLogs();
    });
  const updateAgent = async (id: string, b: Partial<Agent>) =>
    run(async () => {
      const fields = [
        "source_id",
        "name",
        "team",
        "department",
        "user_id",
        "team_lead_id",
        "controller_id",
        "team_lead",
        "controller",
        "operator_panel",
        "sample_name",
        "check_process",
        "min_monthly_reviews",
        "active",
        "avatar",
      ];
      const payload = Object.fromEntries(
        Object.entries(b).filter(([k]) => fields.includes(k)),
      );
      const r = await api(`/api/agents/${id}`, "PUT", payload);
      setAgents((p) => p.map((a) => (a.id === id ? r.data : a)));
      await refreshAuditLogs();
    });
  const addFault = async (b: Omit<Fault, "id">) =>
    run(async () => {
      const r = await api("/api/faults", "POST", b);
      setFaults((p) => [...p, r.data]);
      await refreshAuditLogs();
    });
  const updateFault = async (id: string, b: Partial<Fault>) =>
    run(async () => {
      const r = await api(`/api/faults/${id}`, "PUT", b);
      setFaults((p) => p.map((a) => (a.id === id ? r.data : a)));
      await refreshAuditLogs();
    });
  const deleteFault = async (id: string) =>
    run(async () => {
      await api(`/api/faults/${id}`, "DELETE", {});
      setFaults((p) => p.filter((a) => a.id !== id));
      await refreshAuditLogs();
    });
  const addProblem = async (b: Omit<ProblemItem, "id" | "created_at">) =>
    run(async () => {
      const r = await api("/api/problems", "POST", b);
      setProblems((p) => [r.data, ...p]);
      await refreshAuditLogs();
    });
  const updateProblem = async (id: string, b: Partial<ProblemItem>) =>
    run(async () => {
      const r = await api(`/api/problems/${id}`, "PUT", b);
      setProblems((p) => p.map((a) => (a.id === id ? r.data : a)));
      await refreshAuditLogs();
    });
  const deleteProblem = async (id: string) =>
    run(async () => {
      await api(`/api/problems/${id}`, "DELETE", {});
      setProblems((p) => p.filter((a) => a.id !== id));
      await refreshAuditLogs();
    });
  return {
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
  };
}
