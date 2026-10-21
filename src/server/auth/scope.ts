import type { AuthUser } from './types.ts';
import { PrismaClient } from '@prisma/client';

export interface AssessmentAccessScope {
  where: any;
}

/**
 * Builds Prisma where filter for assessments based on the immutable role-permission matrix.
 */
export function getAssessmentScope(user: AuthUser, baseWhere: any = {}): any {
  const where: any = { ...baseWhere };

  switch (user.role) {
    case 'agent': {
      // Agents see ONLY their own assessments based on their agent_id
      if (!user.agent_id) {
        where.id = '__NONE__';
      } else {
        where.agent_id = user.agent_id;
      }
      break;
    }

    case 'team_lead': {
      // Team Leads see ONLY assessments for their own team / supervised agents
      const conditions: any[] = [];
      if (user.team_id) {
        conditions.push({ team_id: user.team_id });
        conditions.push({ agent: { team_id: user.team_id } });
      }
      if (user.team) {
        conditions.push({ agent: { team_name: user.team } });
      }
      conditions.push({ agent: { team_lead_id: user.id } });

      if (conditions.length === 0) {
        where.id = '__NONE__';
      } else {
        where.OR = conditions;
      }
      break;
    }

    case 'manager': {
      // Managers see ONLY assessments for their department. If no department, fail closed!
      if (!user.department) {
        where.id = '__NONE__';
      } else {
        where.form_type = user.department;
      }
      break;
    }

    case 'qa_controller': {
      // QA Controllers see assessments they created or where they are the assigned controller
      where.OR = [
        { controller_id: user.id },
        { controller_id: user.username },
        { agent: { controller_id: user.id } },
        { agent: { controller: user.username } },
      ];
      break;
    }

    case 'qa_supervisor': {
      // Full QA oversight across all assessments
      break;
    }

    case 'admin': {
      // Under PRD, Admins manage users, rosters, and settings only.
      // Admins have no assessment auditing access.
      where.id = '__NONE__';
      break;
    }

    default:
      where.id = '__NONE__';
  }

  return where;
}

/**
 * Check whether a user has read access to a specific assessment record.
 */
export function canUserAccessAssessment(user: AuthUser, assessment: any): boolean {
  if (!user || !assessment) return false;

  switch (user.role) {
    case 'agent':
      return Boolean(
        (user.agent_id && assessment.agent_id === user.agent_id) ||
        (assessment.agent && assessment.agent.user_id === user.id)
      );

    case 'team_lead':
      return Boolean(
        (user.team_id && assessment.team_id === user.team_id) ||
        (user.team && assessment.agent?.team_name === user.team) ||
        (assessment.agent?.team_lead_id === user.id)
      );

    case 'manager':
      if (!user.department) return false;
      return assessment.form_type === user.department || assessment.agent?.department === user.department;

    case 'qa_controller':
      return Boolean(
        assessment.controller_id === user.id ||
        assessment.controller_id === user.username ||
        assessment.agent?.controller_id === user.id ||
        assessment.agent?.controller === user.username
      );

    case 'qa_supervisor':
      return true;

    case 'admin':
      return false;

    default:
      return false;
  }
}

/**
 * Check whether a user can mutate (edit) a specific assessment record.
 */
export function canUserEditAssessment(user: AuthUser, assessment: any): boolean {
  if (!user || !assessment) return false;

  if (user.role === 'qa_supervisor') return true;

  if (user.role === 'qa_controller') {
    // Controller can only edit assessments created by themselves
    return assessment.controller_id === user.id || assessment.controller_id === user.username;
  }

  return false;
}

/**
 * Check whether a user can delete a specific assessment record.
 */
export function canUserDeleteAssessment(user: AuthUser, assessment: any): boolean {
  if (!user || !assessment) return false;

  if (user.role === 'qa_supervisor') return true;

  if (user.role === 'qa_controller') {
    // Controller can only delete assessments created by themselves
    return assessment.controller_id === user.id || assessment.controller_id === user.username;
  }

  return false;
}

/**
 * Builds Prisma where filter for agents based on user scope.
 */
export function getAgentScope(user: AuthUser, baseWhere: any = {}): any {
  const where: any = { ...baseWhere };

  switch (user.role) {
    case 'agent':
      if (!user.agent_id) {
        where.user_id = user.id;
      } else {
        where.OR = [{ id: user.agent_id }, { user_id: user.id }];
      }
      break;

    case 'team_lead': {
      const conditions: any[] = [];
      if (user.team_id) conditions.push({ team_id: user.team_id });
      if (user.team) conditions.push({ team_name: user.team });
      conditions.push({ team_lead_id: user.id });
      where.OR = conditions;
      break;
    }

    case 'manager':
      if (!user.department) {
        where.id = '__NONE__';
      } else {
        where.department = user.department;
      }
      break;

    case 'qa_controller':
      where.OR = [
        { controller_id: user.id },
        { controller: user.username },
      ];
      break;

    case 'qa_supervisor':
    case 'admin':
      // Unrestricted
      break;

    default:
      where.id = '__NONE__';
  }

  return where;
}
