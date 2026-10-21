import type { AuthUser } from "./types.ts";
export function getAssessmentScope(user: AuthUser, base: any = {}): any {
  let scope: any;
  switch (user.role) {
    case "admin":
    case "qa_supervisor":
      scope = {};
      break;
    case "agent":
      scope = user.agent_id ? { agent_id: user.agent_id } : { id: "__NONE__" };
      break;
    case "manager":
      scope = user.department
        ? { form_type: user.department }
        : { id: "__NONE__" };
      break;
    case "team_lead":
      scope = {
        agent: {
          OR: [{ team_lead_id: user.id }, { team: { lead_id: user.id } }],
        },
      };
      break;
    case "qa_controller":
      scope = {
        OR: [{ controller_id: user.id }, { agent: { controller_id: user.id } }],
      };
      break;
    default:
      scope = { id: "__NONE__" };
  }
  return { AND: [base, scope] };
}
export function getAgentScope(user: AuthUser, base: any = {}): any {
  let scope: any;
  switch (user.role) {
    case "admin":
    case "qa_supervisor":
      scope = {};
      break;
    case "agent":
      scope = user.agent_id ? { id: user.agent_id } : { user_id: user.id };
      break;
    case "manager":
      scope = user.department
        ? { department: user.department }
        : { id: "__NONE__" };
      break;
    case "team_lead":
      scope = {
        OR: [{ team_lead_id: user.id }, { team: { lead_id: user.id } }],
      };
      break;
    case "qa_controller":
      scope = { controller_id: user.id };
      break;
    default:
      scope = { id: "__NONE__" };
  }
  return { AND: [base, scope] };
}
export function canUserAccessAssessment(user: AuthUser, a: any) {
  if (!user || !a) return false;
  switch (user.role) {
    case "admin":
    case "qa_supervisor":
      return true;
    case "agent":
      return Boolean(user.agent_id && a.agent_id === user.agent_id);
    case "manager":
      return Boolean(user.department && a.form_type === user.department);
    case "team_lead":
      return (
        a.agent?.team_lead_id === user.id || a.agent?.team?.lead_id === user.id
      );
    case "qa_controller":
      return a.controller_id === user.id || a.agent?.controller_id === user.id;
    default:
      return false;
  }
}
export const canUserEditAssessment = (u: AuthUser, a: any) =>
  u.role === "qa_supervisor" ||
  (u.role === "qa_controller" && a.controller_id === u.id);
export const canUserDeleteAssessment = canUserEditAssessment;
