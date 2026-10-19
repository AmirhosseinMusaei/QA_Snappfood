import React from 'react';
import {
  Assessment,
  Agent,
  Fault,
  ProblemItem,
  PortalSettings,
  RubricSection,
  DepartmentType,
  User,
} from '../types/index.ts';

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
  // 1. Assessments
  const addAssessment = (assessmentData: Omit<Assessment, 'id' | 'created_at'>): Assessment => {
    const newId = `qa-${Date.now().toString().slice(-6)}`;
    const newAssessment: Assessment = {
      ...assessmentData,
      id: newId,
      created_at: new Date().toISOString(),
    };

    // Optimistic update
    setAssessments((prev) => [newAssessment, ...prev]);

    // Send to backend Prisma API
    fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newAssessment, currentUser }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setAssessments((prev) => prev.map((a) => (a.id === newId ? res.data : a)));
        }
        refreshAuditLogs();
      })
      .catch((err) => {
        console.error('Failed to create assessment on backend:', err);
        setError('خطا در ذخیره ارزیابی در پایگاه‌داده');
      });

    return newAssessment;
  };

  const updateAssessment = async (id: string, updates: Partial<Assessment>) => {
    // Optimistic update
    setAssessments((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
      )
    );

    try {
      const res = await fetch(`/api/assessments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, currentUser }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAssessments((prev) => prev.map((item) => (item.id === id ? data.data : item)));
      }
      refreshAuditLogs();
    } catch (err) {
      console.error('Failed to update assessment on backend:', err);
      setError('خطا در ویرایش ارزیابی در سرور');
    }
  };

  const deleteAssessment = async (id: string) => {
    // Optimistic soft delete
    setAssessments((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, deleted_at: new Date().toISOString() } : item
      )
    );

    try {
      await fetch(`/api/assessments/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUser }),
      });
      refreshAuditLogs();
    } catch (err) {
      console.error('Failed to soft delete assessment:', err);
      setError('خطا در حذف ارزیابی در سرور');
    }
  };

  const restoreAssessment = async (id: string) => {
    setAssessments((prev) =>
      prev.map((item) => (item.id === id ? { ...item, deleted_at: null } : item))
    );

    try {
      const res = await fetch(`/api/assessments/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUser }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAssessments((prev) => prev.map((item) => (item.id === id ? data.data : item)));
      }
      refreshAuditLogs();
    } catch (err) {
      console.error('Failed to restore assessment:', err);
    }
  };

  const markTeamLeadReviewed = async (assessmentId: string, note: string) => {
    // Optimistic update
    setAssessments((prev) =>
      prev.map((item) =>
        item.id === assessmentId
          ? {
              ...item,
              result: 'بررسی شده',
              team_lead_reviewed: true,
              team_lead_note: note,
              team_lead_reviewed_at: new Date().toLocaleDateString('fa-IR'),
            }
          : item
      )
    );

    try {
      const res = await fetch(`/api/assessments/${assessmentId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, currentUser }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAssessments((prev) => prev.map((item) => (item.id === assessmentId ? data.data : item)));
      }
      refreshAuditLogs();
    } catch (err) {
      console.error('Failed to submit team lead review:', err);
    }
  };

  // 2. Disputes
  const submitDispute = async (
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

    setAssessments((prev) =>
      prev.map((a) => (a.id === assessmentId ? { ...a, dispute } : a))
    );

    try {
      await fetch(`/api/assessments/${assessmentId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criterion_id: criterionId,
          criterion_title: criterionTitle,
          agent_comment: agentComment,
          currentUser,
        }),
      });
      refreshAuditLogs();
    } catch (err) {
      console.error('Failed to submit dispute:', err);
    }
  };

  const resolveDispute = async (
    assessmentId: string,
    status: 'resolved' | 'rejected' | 'in_review',
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
      controller_comment: controllerComment || (status === 'in_review' ? 'در حال بازشنوایی و بررسی مجدد توسط کنترلر' : ''),
      resolved_at: status === 'in_review' ? undefined : new Date().toLocaleDateString('fa-IR'),
      revised_score: status === 'resolved' ? finalScore : target.total_score,
    };

    setAssessments((prev) =>
      prev.map((a) =>
        a.id === assessmentId
          ? {
              ...a,
              dispute: updatedDispute,
              total_score: finalScore,
            }
          : a
      )
    );

    try {
      const res = await fetch(`/api/disputes/${assessmentId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          controller_comment: controllerComment,
          revised_score: revisedScore,
          currentUser,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAssessments((prev) => prev.map((item) => (item.id === assessmentId ? data.data : item)));
      }
      refreshAuditLogs();
    } catch (err) {
      console.error('Failed to resolve dispute:', err);
    }
  };

  // 3. Reset & Backup
  const resetToSeedData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/system/reset-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUser }),
      });
      if (res.ok) {
        await refreshData();
      }
    } catch (e) {
      console.error('Failed to reset database:', e);
    } finally {
      setLoading(false);
    }
  };

  const exportDataToJson = () => {
    const data = {
      assessments,
      agents,
      faults,
      auditLogs: [],
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
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const importAgentsFromCsv = async (
    csvText: string,
    dryRun: boolean
  ): Promise<{ success: boolean; count: number; errors: string[] }> => {
    try {
      const res = await fetch('/api/agents/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, dryRun, currentUser }),
      });
      const data = await res.json();
      if (!dryRun && data.success) {
        const agRes = await fetch('/api/agents');
        const agData = await agRes.json();
        if (agData.success) setAgents(agData.data);
        refreshAuditLogs();
      }
      return data;
    } catch (err: any) {
      return { success: false, count: 0, errors: [err.message || 'خطا در برقراری ارتباط با سرور'] };
    }
  };

  // 4. Rubrics & Settings
  const updateRubricItemWeight = async (formType: DepartmentType, itemId: string, newWeight: number) => {
    const currentSections = formType === 'support' ? supportRubric : salesRubric;
    const updated = currentSections.map((sec) => ({
      ...sec,
      criteria: sec.criteria.map((crit) => ({
        ...crit,
        items: crit.items.map((it) => (it.id === itemId ? { ...it, maxPoints: newWeight } : it)),
      })),
    }));

    await updateFullRubric(formType, updated);
  };

  const updateFullRubric = async (
    formType: DepartmentType,
    sections: RubricSection[]
  ): Promise<{ success: boolean; error?: string }> => {
    const totalMax = sections.reduce((sum, s) => sum + s.maxPoints, 0);
    if (totalMax !== 100) {
      return {
        success: false,
        error: `مجموع سقف نمرات بخش‌ها برابر ${totalMax} است. مجموع کل نمرات باید دقیقاً ۱۰۰ باشد.`,
      };
    }

    try {
      const res = await fetch(`/api/forms/${formType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections, currentUser }),
      });
      const data = await res.json();
      if (data.success) {
        if (formType === 'support') {
          setSupportRubric(sections);
          setSupportFormVersion(data.version || supportFormVersion + 1);
          if (data.formId) setSupportFormId(data.formId);
        } else {
          setSalesRubric(sections);
          setSalesFormVersion(data.version || salesFormVersion + 1);
          if (data.formId) setSalesFormId(data.formId);
        }
        refreshAuditLogs();
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateSettings = async (newSettings: Partial<PortalSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);

    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: merged, currentUser }),
      });
      refreshAuditLogs();
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  // 5. Agents
  const addAgent = async (newAgent: Omit<Agent, 'id'>) => {
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAgent, currentUser }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAgents((prev) => [...prev, data.data]);
        refreshAuditLogs();
      }
    } catch (err) {
      console.error('Failed to add agent:', err);
    }
  };

  const updateAgent = async (id: string, updates: Partial<Agent>) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));

    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, currentUser }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAgents((prev) => prev.map((a) => (a.id === id ? data.data : a)));
        refreshAuditLogs();
      }
    } catch (err) {
      console.error('Failed to update agent:', err);
    }
  };

  // 6. Faults
  const addFault = async (newFault: Omit<Fault, 'id'>) => {
    try {
      const res = await fetch('/api/faults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newFault, currentUser }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setFaults((prev) => [...prev, data.data]);
        refreshAuditLogs();
      }
    } catch (err) {
      console.error('Failed to add fault:', err);
    }
  };

  const updateFault = async (id: string, updates: Partial<Fault>) => {
    setFaults((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));

    try {
      const res = await fetch(`/api/faults/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, currentUser }),
      });
      refreshAuditLogs();
    } catch (err) {
      console.error('Failed to update fault:', err);
    }
  };

  const deleteFault = async (id: string) => {
    setFaults((prev) => prev.filter((f) => f.id !== id));

    try {
      await fetch(`/api/faults/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUser }),
      });
      refreshAuditLogs();
    } catch (err) {
      console.error('Failed to delete fault:', err);
    }
  };

  // 7. Problems Tracker
  const addProblem = async (problemData: Omit<ProblemItem, 'id' | 'created_at'>) => {
    try {
      const res = await fetch('/api/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...problemData, currentUser }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setProblems((prev) => [data.data, ...prev]);
        refreshAuditLogs();
      }
    } catch (err) {
      console.error('Failed to add problem:', err);
    }
  };

  const updateProblem = async (id: string, updates: Partial<ProblemItem>) => {
    setProblems((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));

    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, currentUser }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setProblems((prev) => prev.map((p) => (p.id === id ? data.data : p)));
        refreshAuditLogs();
      }
    } catch (err) {
      console.error('Failed to update problem:', err);
    }
  };

  const deleteProblem = async (id: string) => {
    setProblems((prev) => prev.filter((p) => p.id !== id));

    try {
      await fetch(`/api/problems/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUser }),
      });
      refreshAuditLogs();
    } catch (err) {
      console.error('Failed to delete problem:', err);
    }
  };

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
