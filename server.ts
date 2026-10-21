import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import {
  SUPPORT_RUBRIC,
  SALES_RUBRIC,
  calculateSupportTotal,
  calculateSalesTotal,
  validateScores,
  getAllRubricItems,
} from './src/utils/scoring.ts';
import {
  dateToJalali,
  parseJalaliOrGregorianDate,
  formatJalaliDate,
  getCurrentJalaliYear,
  toEnglishDigits,
  jalaliToGregorianUTC,
} from './src/utils/persian.ts';
import * as XLSX from 'xlsx';
import {
  DEFAULT_SETTINGS,
  SEED_USERS,
  SEED_TEAMS,
  SEED_CONTROLLERS,
  SEED_TEAM_LEADS,
  SEED_AGENTS,
  SEED_FAULTS,
  SEED_ASSESSMENTS,
  SEED_PROBLEMS,
} from './src/data/seedData.ts';
import { LocalDatabaseAuthAdapter, CorporateSSOAdapter, validateProductionSecrets } from './src/server/auth/adapter.ts';
import { createAuthMiddleware } from './src/server/auth/middleware.ts';
import {
  getAssessmentScope,
  canUserAccessAssessment,
  canUserEditAssessment,
  canUserDeleteAssessment,
  getAgentScope,
} from './src/server/auth/scope.ts';
import type { AuthUser } from './src/server/auth/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbUrl = process.env.NODE_ENV === 'test'
  ? (process.env.TEST_DATABASE_URL || 'file:./test.db')
  : (process.env.DATABASE_URL || 'file:./dev.db');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const COOKIE_SECRET =
  process.env.COOKIE_SECRET && process.env.COOKIE_SECRET !== 'snappfood-qa-session-cookie-secret-2024'
    ? process.env.COOKIE_SECRET
    : process.env.NODE_ENV === 'production'
    ? crypto.randomBytes(32).toString('hex')
    : 'snappfood-qa-session-cookie-secret-2024';

// Validate production secrets configuration
validateProductionSecrets(COOKIE_SECRET);

// Pluggable Auth Adapter: Local Database (bcrypt) or Corporate SSO (LDAP / SAML)
const authAdapter = process.env.AUTH_PROVIDER === 'sso'
  ? new CorporateSSOAdapter(prisma)
  : new LocalDatabaseAuthAdapter(prisma);

const {
  authenticate,
  optionalAuth,
  requireRole,
  loginRateLimiter,
  validateCsrfOrigin,
} = createAuthMiddleware(authAdapter);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser(COOKIE_SECRET));
app.use('/api', validateCsrfOrigin);

// ==========================================
// AUDIT LOG HELPER (Immutable, Server-Written)
// ==========================================
async function recordServerAuditLog(params: {
  user_id?: string;
  user_name?: string;
  user_role?: string;
  entity: string;
  entity_id: string;
  action: string;
  field?: string;
  old_value?: string;
  new_value?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: params.user_id || 'system',
        user_name: params.user_name || 'کاربر سیستم',
        user_role: params.user_role || 'system',
        entity: params.entity,
        entity_id: params.entity_id,
        action: params.action,
        field: params.field,
        old_value: params.old_value,
        new_value: params.new_value,
      },
    });
  } catch (err) {
    console.error('Failed to create server audit log:', err);
  }
}

// Convert Assessment DB Model to Frontend Schema
function formatAssessmentResponse(a: any) {
  let faultCategories: string[] = [];
  if (a.fault_categories) {
    try {
      faultCategories = JSON.parse(a.fault_categories);
    } catch {}
  }

  let supportScores: Record<string, number> = {};
  if (a.support_scores_json) {
    try {
      supportScores = JSON.parse(a.support_scores_json);
    } catch {}
  } else if (a.scores && a.scores.length > 0 && a.form_type === 'support') {
    a.scores.forEach((s: any) => {
      supportScores[s.item_id] = s.awarded_score;
    });
  }

  let salesScores: Record<string, number> = {};
  if (a.sales_scores_json) {
    try {
      salesScores = JSON.parse(a.sales_scores_json);
    } catch {}
  } else if (a.scores && a.scores.length > 0 && a.form_type === 'sales') {
    a.scores.forEach((s: any) => {
      salesScores[s.item_id] = s.awarded_score;
    });
  }

  const dispute = a.disputes && a.disputes.length > 0 ? a.disputes[0] : undefined;
  const jalali = dateToJalali(a.check_date);
  const checkDateIso =
    a.check_date instanceof Date
      ? a.check_date.toISOString()
      : typeof a.check_date === 'string'
      ? a.check_date
      : new Date().toISOString();

  return {
    ...a,
    check_date: checkDateIso,
    check_date_jalali: jalali.persianJalaliStr,
    check_date_jalali_plain: jalali.jalaliStr,
    check_date_month: jalali.monthName,
    check_date_month_num: jalali.month,
    check_date_year: jalali.year,
    fault_categories: faultCategories,
    support_scores: supportScores,
    sales_scores: salesScores,
    dispute: dispute
      ? {
          id: dispute.id,
          agent_id: dispute.agent_id,
          agent_name: dispute.agent_name,
          criterion_id: dispute.criterion_id,
          criterion_title: dispute.criterion_title,
          agent_comment: dispute.agent_comment,
          status: dispute.status,
          controller_id: dispute.controller_id,
          controller_comment: dispute.controller_comment,
          original_score: dispute.original_score,
          revised_score: dispute.revised_score,
          created_at: dispute.created_at ? new Date(dispute.created_at).toLocaleDateString('fa-IR') : '',
          resolved_at: dispute.resolved_at ? new Date(dispute.resolved_at).toLocaleDateString('fa-IR') : undefined,
        }
      : undefined,
  };
}

// ==========================================
// 1. HEALTH & SYSTEM INFO
// ==========================================
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const isSqlServer = process.env.DATABASE_URL?.includes('sqlserver');
    const [assessmentCount, agentCount, userCount, problemCount, auditLogCount] = await Promise.all([
      prisma.assessment.count(),
      prisma.agent.count(),
      prisma.user.count(),
      prisma.problem.count(),
      prisma.auditLog.count(),
    ]);

    res.json({
      status: 'ok',
      app: 'SnappFood Commercial QA Portal',
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      database: isSqlServer ? 'Microsoft SQL Server (Production)' : 'SQLite (Local Dev)',
      authAdapter: authAdapter.name,
      devRoleSwitch: process.env.DEV_ROLE_SWITCH === 'true',
      counts: {
        assessments: assessmentCount,
        agents: agentCount,
        users: userCount,
        problems: problemCount,
        auditLogs: auditLogCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ==========================================
// 2. AUTHENTICATION & SESSION API
// ==========================================
app.post('/api/auth/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password, ssoToken, provider = 'local' } = req.body;

    if (provider === 'sso' || ssoToken) {
      return res.status(503).json({
        success: false,
        message: 'سرویس احراز هویت یکپارچه سازمانی (SSO) پیکربندی نشده و در دسترس نیست',
      });
    }

    if (!username) {
      return res.status(400).json({ success: false, message: 'نام کاربری الزامی است' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'کلمه عبور الزامی است' });
    }

    const authUser = await authAdapter.authenticate({
      username,
      password,
      provider,
    });

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'نام کاربری یا رمز عبور اشتباه است.',
      });
    }

    // Create session token
    const sessionToken = await authAdapter.createSession(authUser);

    // Set HttpOnly signed cookie
    res.cookie('snappfood_session', sessionToken, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    await recordServerAuditLog({
      user_id: authUser.id,
      user_name: authUser.name,
      user_role: authUser.role,
      entity: 'settings',
      entity_id: authUser.id,
      action: 'create',
      field: 'user_session',
      new_value: `ورود موفق: ${authUser.name} (${authUser.role})`,
    });

    // Do not return raw session token in JSON body
    res.json({
      success: true,
      user: authUser,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  try {
    const token =
      req.signedCookies?.snappfood_session ||
      req.cookies?.snappfood_session ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (token) {
      await authAdapter.destroySession(token);
    }
    res.clearCookie('snappfood_session', { path: '/' });
    res.json({ success: true, message: 'خروج موفقیت‌آمیز' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/auth/me', optionalAuth, (req: Request, res: Response) => {
  if (req.user) {
    return res.json({
      success: true,
      authenticated: true,
      user: req.user,
    });
  }
  res.json({
    success: true,
    authenticated: false,
    user: null,
  });
});

// Legacy login route compatible with frontend (strictly requiring username and password)
app.post('/api/users/login', loginRateLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'نام کاربری و کلمه عبور الزامی است' });
  }

  const authUser = await authAdapter.authenticate({
    username,
    password,
  });

  if (!authUser) {
    return res.status(401).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است' });
  }

  const sessionToken = await authAdapter.createSession(authUser);
  res.cookie('snappfood_session', sessionToken, {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ success: true, data: authUser });
});

// Authorized Staff Directory (Controllers & Team Leads from backend DB)
app.get('/api/staff', authenticate, async (_req: Request, res: Response) => {
  try {
    const [controllers, teamLeads] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: { in: ['qa_controller', 'qa_supervisor'] },
          active: true,
        },
        select: { id: true, username: true, name: true, role: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          role: 'team_lead',
          active: true,
        },
        select: { id: true, username: true, name: true, team: true, department: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const targetSetting = await prisma.setting.findUnique({
      where: { key: 'controller_monthly_target' },
    });
    let targetMonthly = 160;
    if (targetSetting) {
      try {
        targetMonthly = JSON.parse(targetSetting.value);
      } catch {
        targetMonthly = parseInt(targetSetting.value, 10) || 160;
      }
    }

    res.json({
      success: true,
      controllers: controllers.map((c) => ({
        id: c.id,
        username: c.username,
        name: c.name,
        display_name: c.name,
        role: c.role,
        target: targetMonthly,
      })),
      teamLeads: teamLeads.map((tl) => ({ id: tl.id, username: tl.username, name: tl.name, team: tl.team, department: tl.department })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. USERS MANAGEMENT (Admin & Supervisor Only)
// ==========================================
app.get('/api/users', authenticate, requireRole(['admin', 'qa_supervisor']), async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, count: users.length, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/users', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { username, password, name, role, department, team } = req.body;
    if (!username || !password || !name || !role) {
      return res.status(400).json({ success: false, message: 'اطلاعات کاربر ناقص است' });
    }
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'نام کاربری قبلاً استفاده شده است' });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role,
        department,
        team,
        active: true,
      },
    });
    await recordServerAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.name,
      user_role: req.user!.role,
      entity: 'settings',
      entity_id: newUser.id,
      action: 'create_user',
      field: 'username',
      new_value: `${newUser.name} (${newUser.username}) [${newUser.role}]`,
    });
    res.status(201).json({ success: true, data: newUser });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/users/:id', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, department, team, active, password } = req.body;
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد' });
    }
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (team !== undefined) updateData.team = team;
    if (active !== undefined) updateData.active = Boolean(active);
    if (password) updateData.password = bcrypt.hashSync(password, 10);

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });
    await recordServerAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.name,
      user_role: req.user!.role,
      entity: 'settings',
      entity_id: id,
      action: 'update_user',
      field: Object.keys(updateData).join(', '),
      new_value: updated.name,
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/users/:id', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user!.id === id) {
      return res.status(400).json({ success: false, message: 'امکان غیرفعال‌سازی کاربر جاری وجود ندارد' });
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ success: false, message: 'کاربر یافت نشد' });
    }
    await prisma.user.update({
      where: { id },
      data: { active: false },
    });
    await recordServerAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.name,
      user_role: req.user!.role,
      entity: 'settings',
      entity_id: id,
      action: 'deactivate_user',
      field: 'active',
      old_value: 'true',
      new_value: 'false',
    });
    res.json({ success: true, message: 'کاربر با موفقیت غیرفعال شد' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. TEAMS API
// ==========================================
app.get('/api/teams', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const where: any = {};

    if (user.role === 'team_lead') {
      where.OR = [
        { lead_id: user.id },
        { name: user.team || '' },
      ];
    } else if (user.role === 'manager') {
      if (user.department) {
        where.department = user.department;
      } else {
        where.id = '__NONE__';
      }
    }

    const teams = await prisma.team.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, count: teams.length, data: teams });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/teams', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { name, department, lead_name, lead_id } = req.body;
    const team = await prisma.team.create({
      data: { name, department, lead_name, lead_id },
    });
    await recordServerAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.name,
      user_role: req.user!.role,
      entity: 'settings',
      entity_id: team.id,
      action: 'create',
      field: 'team',
      new_value: `${team.name} (${team.department})`,
    });
    res.status(201).json({ success: true, data: team });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/teams/:id', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, department, lead_name, lead_id } = req.body;
    const currentTeam = await prisma.team.findUnique({ where: { id } });
    if (!currentTeam) {
      return res.status(404).json({ success: false, message: 'تیم یافت نشد' });
    }
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (department !== undefined) updateData.department = department;
    if (lead_name !== undefined) updateData.lead_name = lead_name;
    if (lead_id !== undefined) updateData.lead_id = lead_id;

    const updated = await prisma.team.update({
      where: { id },
      data: updateData,
    });

    if (name && name !== currentTeam.name) {
      await prisma.agent.updateMany({
        where: { team_id: id },
        data: { team_name: name },
      });
    }

    await recordServerAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.name,
      user_role: req.user!.role,
      entity: 'settings',
      entity_id: id,
      action: 'update',
      field: Object.keys(updateData).join(', '),
      old_value: currentTeam.name,
      new_value: updated.name,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/teams/:id', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentTeam = await prisma.team.findUnique({ where: { id } });
    if (!currentTeam) {
      return res.status(404).json({ success: false, message: 'تیم یافت نشد' });
    }
    const agentCount = await prisma.agent.count({ where: { team_id: id, active: true } });
    if (agentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `امکان حذف تیم وجود ندارد؛ ${agentCount} کارشناس فعال در این تیم حضور دارند`,
      });
    }

    await prisma.team.delete({ where: { id } });

    await recordServerAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.name,
      user_role: req.user!.role,
      entity: 'settings',
      entity_id: id,
      action: 'delete',
      field: 'team',
      old_value: currentTeam.name,
      new_value: 'deleted',
    });

    res.json({ success: true, message: 'تیم با موفقیت حذف شد' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 5. AGENTS API (All Source Tab with RBAC Filtering)
// ==========================================
app.get('/api/agents', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { team, department, source_id, active } = req.query;
    const baseWhere: any = {};

    if (active !== undefined) {
      baseWhere.active = active === 'true';
    }
    if (source_id && typeof source_id === 'string') {
      baseWhere.source_id = source_id;
    }

    // Role-based data scoping via immutable relations
    const where = getAgentScope(user, baseWhere);

    if (team && typeof team === 'string' && team !== 'all') {
      where.team_name = team;
    }
    if (department && typeof department === 'string') {
      if (user.role === 'manager' && user.department && user.department !== department) {
        where.id = '__NONE__';
      } else if (user.role === 'manager' && !user.department) {
        where.id = '__NONE__';
      } else if (user.role === 'admin' || user.role === 'qa_supervisor') {
        where.department = department;
      }
    }

    const agents = await prisma.agent.findMany({
      where,
      include: {
        team_lead_user: true,
        controller_user: true,
      },
      orderBy: { name: 'asc' },
    });

    const mapped = agents.map((ag) => ({
      ...ag,
      team: ag.team_name,
    }));

    res.json({ success: true, count: mapped.length, data: mapped });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/agents', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const {
      name,
      source_id,
      team,
      department,
      team_lead,
      team_lead_id,
      controller,
      controller_id,
      operator_panel,
      sample_name,
      check_process,
      min_monthly_reviews,
    } = req.body;

    const user = req.user!;
    const teamRecord = await prisma.team.findFirst({ where: { name: team } });

    const newAgent = await prisma.agent.create({
      data: {
        id: `agent-${source_id || Date.now().toString().slice(-4)}`,
        source_id: String(source_id),
        name,
        department: department || 'support',
        team_id: teamRecord?.id || 'team-technical',
        team_name: team || 'Technical',
        team_lead: team_lead || 'حسین جدیری',
        team_lead_id: team_lead_id || null,
        controller: controller || 'meysam',
        controller_id: controller_id || null,
        operator_panel: operator_panel || 'Ring',
        sample_name: sample_name || 'Random Sampling',
        check_process: check_process || 'if needed',
        min_monthly_reviews: Number(min_monthly_reviews) || 40,
        active: true,
      },
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'agent',
      entity_id: newAgent.id,
      action: 'create',
      field: 'agent_roster',
      new_value: `${newAgent.name} (کد: ${newAgent.source_id} | تیم: ${newAgent.team_name})`,
    });

    res.status(201).json({ success: true, data: { ...newAgent, team: newAgent.team_name } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/agents/:id', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { team, ...updates } = req.body;
    const user = req.user!;

    const currentAgent = await prisma.agent.findUnique({ where: { id } });
    if (!currentAgent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const dataToUpdate: any = { ...updates };
    if (team) {
      dataToUpdate.team_name = team;
      const tRecord = await prisma.team.findFirst({ where: { name: team } });
      if (tRecord) dataToUpdate.team_id = tRecord.id;
    }

    const updated = await prisma.agent.update({
      where: { id },
      data: dataToUpdate,
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'agent',
      entity_id: id,
      action: 'update',
      field: Object.keys(updates).join(', '),
      old_value: currentAgent.name,
      new_value: updated.name,
    });

    res.json({ success: true, data: { ...updated, team: updated.team_name } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/agents/:id', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentAgent = await prisma.agent.findUnique({ where: { id } });
    if (!currentAgent) {
      return res.status(404).json({ success: false, message: 'کارشناس یافت نشد' });
    }

    const assessmentCount = await prisma.assessment.count({
      where: { agent_id: id, deleted_at: null },
    });

    if (assessmentCount > 0) {
      await prisma.agent.update({
        where: { id },
        data: { active: false },
      });
      await recordServerAuditLog({
        user_id: req.user!.id,
        user_name: req.user!.name,
        user_role: req.user!.role,
        entity: 'agent',
        entity_id: id,
        action: 'update',
        field: 'active',
        old_value: 'true',
        new_value: 'false',
      });
      return res.json({
        success: true,
        message: 'کارشناس به دلیل داشتن سابقه ارزیابی غیرفعال شد (حفظ یکپارچگی داده‌ها)',
        deactivated: true,
      });
    }

    await prisma.agent.delete({ where: { id } });
    await recordServerAuditLog({
      user_id: req.user!.id,
      user_name: req.user!.name,
      user_role: req.user!.role,
      entity: 'agent',
      entity_id: id,
      action: 'delete',
      field: 'agent',
      old_value: currentAgent.name,
      new_value: 'deleted',
    });

    res.json({ success: true, message: 'کارشناس با موفقیت حذف شد' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/agents/import-csv', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { csvText, dryRun } = req.body;
    const user = req.user!;

    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ success: false, count: 0, errors: ['فایل فاقد متن است'] });
    }

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return { success: false, count: 0, errors: ['فایل فاقد ردیف‌های داده است'] };
    }

    const errors: string[] = [];
    const validAgents: any[] = [];

    for (let index = 1; index < lines.length; index++) {
      const line = lines[index];
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 3) {
        errors.push(`ردیف ${index + 1}: تعداد ستون‌ها ناکافی است`);
        continue;
      }

      const [name, source_id, team, dept, lead, controller, panel, sample, process, minReviews] = parts;
      if (!name || !source_id) {
        errors.push(`ردیف ${index + 1}: نام کارشناس یا کد سورس خالی است`);
        continue;
      }

      validAgents.push({
        name,
        source_id: String(source_id),
        team: team || 'General',
        department: dept === 'support' || dept === 'پشتیبانی' ? 'support' : 'sales',
        team_lead: lead || 'نگین رضایی',
        controller: controller || 'meysam',
        operator_panel: panel || 'Ring',
        sample_name: sample || 'Random Sampling',
        check_process: process || 'if needed',
        min_monthly_reviews: Number(minReviews) || 40,
      });
    }

    if (!dryRun && validAgents.length > 0) {
      for (const ag of validAgents) {
        const teamRec = await prisma.team.findFirst({ where: { name: ag.team } });
        await prisma.agent.upsert({
          where: { source_id: ag.source_id },
          update: {
            name: ag.name,
            team_name: ag.team,
            team_id: teamRec?.id || 'team-general',
            department: ag.department,
            team_lead: ag.team_lead,
            controller: ag.controller,
            operator_panel: ag.operator_panel,
            sample_name: ag.sample_name,
            check_process: ag.check_process,
            min_monthly_reviews: ag.min_monthly_reviews,
          },
          create: {
            id: `agent-${ag.source_id}`,
            source_id: ag.source_id,
            name: ag.name,
            team_name: ag.team,
            team_id: teamRec?.id || 'team-general',
            department: ag.department,
            team_lead: ag.team_lead,
            controller: ag.controller,
            operator_panel: ag.operator_panel,
            sample_name: ag.sample_name,
            check_process: ag.check_process,
            min_monthly_reviews: ag.min_monthly_reviews,
            active: true,
          },
        });
      }

      await recordServerAuditLog({
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        entity: 'agent',
        entity_id: 'roster_import',
        action: 'create',
        field: 'csv_import',
        new_value: `ایمپورت ${validAgents.length} کارشناس از فایل CSV`,
      });
    }

    res.json({ success: true, count: validAgents.length, errors });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper to convert DB AssessmentForm criteria into RubricSection[]
function convertFormToRubric(form: any, defaultRubric: any[]) {
  if (!form || !form.criteria || form.criteria.length === 0) {
    return defaultRubric;
  }
  const sectionMap = new Map<string, any>();
  for (const crit of form.criteria) {
    const secId = crit.section || 'default';
    if (!sectionMap.has(secId)) {
      const defaultSec = defaultRubric.find((s) => s.id === secId);
      sectionMap.set(secId, {
        id: secId,
        title: defaultSec?.title || crit.title,
        maxPoints: defaultSec?.maxPoints || 0,
        criteria: [],
      });
    }
    const sec = sectionMap.get(secId);
    sec.criteria.push({
      id: crit.id.replace(/^crit-/, '').replace(/-v\d+$/, ''),
      title: crit.title,
      maxPoints: crit.max_points,
      items: crit.items.map((it: any) => ({
        id: it.id.replace(/^item-/, '').replace(/-v\d+$/, ''),
        title: it.title,
        maxPoints: it.max_points,
      })),
    });
  }
  return Array.from(sectionMap.values()).map((s: any) => ({
    ...s,
    maxPoints: s.criteria.reduce((sum: number, c: any) => sum + c.maxPoints, 0),
  }));
}

// Retrieve rubric for a specific form_id or form_version, or active form
async function getRubricForForm(params: {
  formId?: string;
  formType: string;
  formVersion?: number;
}): Promise<{ rubric: any[]; formId: string; formVersion: number }> {
  let form: any = null;

  if (params.formId) {
    form = await prisma.assessmentForm.findUnique({
      where: { id: params.formId },
      include: { criteria: { include: { items: true }, orderBy: { order_index: 'asc' } } },
    });
  }

  if (!form && params.formVersion !== undefined && params.formVersion !== null) {
    form = await prisma.assessmentForm.findFirst({
      where: { form_type: params.formType, version: Number(params.formVersion) },
      include: { criteria: { include: { items: true }, orderBy: { order_index: 'asc' } } },
    });
  }

  if (!form) {
    form = await prisma.assessmentForm.findFirst({
      where: { form_type: params.formType, is_active: true },
      orderBy: { version: 'desc' },
      include: { criteria: { include: { items: true }, orderBy: { order_index: 'asc' } } },
    });
  }

  const defaultRubric = params.formType === 'support' ? SUPPORT_RUBRIC : SALES_RUBRIC;
  const formId = form?.id || `form-${params.formType}-v${params.formVersion || 1}`;
  const formVersion = form?.version || params.formVersion || 1;

  const rubric = convertFormToRubric(form, defaultRubric);
  return { rubric, formId, formVersion };
}

// ==========================================
// 6. RUBRIC FORMS & CRITERIA API
// ==========================================
app.get('/api/forms', authenticate, async (_req: Request, res: Response) => {
  try {
    const [supportForm, salesForm] = await Promise.all([
      prisma.assessmentForm.findFirst({
        where: { form_type: 'support', is_active: true },
        include: { criteria: { include: { items: true }, orderBy: { order_index: 'asc' } } },
      }),
      prisma.assessmentForm.findFirst({
        where: { form_type: 'sales', is_active: true },
        include: { criteria: { include: { items: true }, orderBy: { order_index: 'asc' } } },
      }),
    ]);

    res.json({
      success: true,
      supportRubric: convertFormToRubric(supportForm, SUPPORT_RUBRIC),
      salesRubric: convertFormToRubric(salesForm, SALES_RUBRIC),
      supportFormId: supportForm?.id || 'form-support-v1',
      salesFormId: salesForm?.id || 'form-sales-v1',
      supportFormVersion: supportForm?.version || 1,
      salesFormVersion: salesForm?.version || 1,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint to fetch historical rubric for a specific version
app.get('/api/forms/:formType/version/:version', authenticate, async (req: Request, res: Response) => {
  try {
    const { formType, version } = req.params;
    const v = parseInt(version, 10);
    const result = await getRubricForForm({
      formType,
      formVersion: isNaN(v) ? 1 : v,
    });
    res.json({
      success: true,
      formType,
      formId: result.formId,
      version: result.formVersion,
      rubric: result.rubric,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/forms/:formType', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { formType } = req.params;
    const { sections } = req.body;
    const user = req.user!;

    if (!Array.isArray(sections)) {
      return res.status(400).json({ success: false, error: 'بخش‌های رابریک نامعتبر است' });
    }

    const totalMax = sections.reduce((sum: number, s: any) => sum + (Number(s.maxPoints) || 0), 0);
    if (totalMax !== 100) {
      return res.status(400).json({
        success: false,
        error: `مجموع سقف نمرات بخش‌ها برابر ${totalMax} است. مجموع کل نمرات باید دقیقاً ۱۰۰ باشد.`,
      });
    }

    const currentForm = await prisma.assessmentForm.findFirst({
      where: { form_type: formType, is_active: true },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (currentForm?.version || 1) + 1;

    const newForm = await prisma.assessmentForm.create({
      data: {
        id: `form-${formType}-v${nextVersion}`,
        form_type: formType,
        title: formType === 'support' ? 'روبریک ارزیابی پشتیبانی (Support Rubric)' : 'روبریک ارزیابی فروش (Sales Rubric)',
        version: nextVersion,
        is_active: true,
      },
    });

    if (currentForm) {
      await prisma.assessmentForm.update({
        where: { id: currentForm.id },
        data: { is_active: false },
      });
    }

    for (const [secIdx, section] of sections.entries()) {
      for (const [critIdx, crit] of (section.criteria || []).entries()) {
        const cleanCritId = crit.id.replace(/^crit-/, '').replace(/-v\d+$/, '');
        const critRec = await prisma.rubricCriteria.create({
          data: {
            id: `crit-${cleanCritId}-v${nextVersion}`,
            form_id: newForm.id,
            section: section.id,
            title: crit.title,
            max_points: Number(crit.maxPoints) || 0,
            order_index: secIdx * 10 + critIdx,
          },
        });

        for (const [itemIdx, it] of (crit.items || []).entries()) {
          const cleanItemId = it.id.replace(/^item-/, '').replace(/-v\d+$/, '');
          await prisma.rubricCriteriaItem.create({
            data: {
              id: `item-${cleanItemId}-v${nextVersion}`,
              criteria_id: critRec.id,
              title: it.title,
              max_points: Number(it.maxPoints) || 0,
              order_index: itemIdx,
            },
          });
        }
      }
    }

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'rubric',
      entity_id: formType,
      action: 'rubric_updated',
      field: 'sections',
      new_value: `بروزرسانی رابریک ${formType === 'support' ? 'پشتیبانی' : 'فروش'} به نسخه v${nextVersion}`,
    });

    res.json({ success: true, version: nextVersion });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. FAULTS API
// ==========================================
app.get('/api/faults', authenticate, async (_req: Request, res: Response) => {
  try {
    const faults = await prisma.fault.findMany({
      orderBy: { title: 'asc' },
    });
    res.json({ success: true, count: faults.length, data: faults });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/faults', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { title, department, category, is_critical, description } = req.body;
    const user = req.user!;
    const newFault = await prisma.fault.create({
      data: {
        id: `fault-${Date.now().toString().slice(-4)}`,
        title,
        department: department || 'both',
        category: category || 'General',
        is_critical: Boolean(is_critical),
        description,
      },
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'fault',
      entity_id: newFault.id,
      action: 'create',
      field: 'title',
      new_value: newFault.title,
    });

    res.status(201).json({ success: true, data: newFault });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/faults/:id', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user!;

    const updated = await prisma.fault.update({
      where: { id },
      data: updates,
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'fault',
      entity_id: id,
      action: 'update',
      field: Object.keys(updates).join(', '),
      new_value: updated.title,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/faults/:id', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const fault = await prisma.fault.findUnique({ where: { id } });
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Fault not found' });
    }

    await prisma.fault.delete({ where: { id } });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'fault',
      entity_id: id,
      action: 'delete',
      field: 'title',
      old_value: fault.title,
      new_value: 'حذف خطا از ماتریس',
    });

    res.json({ success: true, message: 'Fault deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper to build robust database filters for assessments within authorized boundary
function buildAssessmentFilterWhere(user: AuthUser, query: Record<string, any>) {
  const {
    agent_id,
    form_type,
    result,
    controller_id,
    search,
    include_deleted,
    team_id,
    team,
    min_score,
    max_score,
    fault_id,
    has_fault,
    is_fraud,
    year,
    month,
    jalali_year,
    jalali_month,
  } = query;

  const baseWhere: any = {};
  if (include_deleted !== 'true') {
    baseWhere.deleted_at = null;
  }

  // 1. Role-based scoping per PRD
  const where = getAssessmentScope(user, baseWhere);

  // 2. User-supplied filters within authorized boundary
  if (agent_id && typeof agent_id === 'string' && agent_id !== 'all') {
    if (user.role === 'agent' && user.agent_id && user.agent_id !== agent_id) {
      where.id = '__NONE__';
    } else {
      where.agent_id = agent_id;
    }
  }

  if (form_type && typeof form_type === 'string' && form_type !== 'all') {
    if (user.role === 'manager' && user.department && user.department !== form_type) {
      where.id = '__NONE__';
    } else if (user.role === 'manager' && !user.department) {
      where.id = '__NONE__';
    } else if (user.role === 'admin' || user.role === 'qa_supervisor' || user.role === 'qa_controller' || user.role === 'team_lead') {
      where.form_type = form_type;
    }
  }

  if (result && typeof result === 'string' && result !== 'all') {
    where.result = result;
  }

  if (controller_id && typeof controller_id === 'string' && controller_id !== 'all') {
    where.controller_id = controller_id;
  }

  const teamFilter = team_id || team;
  if (teamFilter && typeof teamFilter === 'string' && teamFilter !== 'all') {
    const teamConditions = [
      { team_id: teamFilter },
      { agent: { team_id: teamFilter } },
      { agent: { team_name: teamFilter } },
    ];
    if (where.OR) {
      where.AND = [...(where.AND || []), { OR: teamConditions }];
    } else {
      where.OR = teamConditions;
    }
  }

  // Score range
  const minScoreNum = min_score !== undefined && min_score !== '' ? parseInt(String(min_score), 10) : NaN;
  const maxScoreNum = max_score !== undefined && max_score !== '' ? parseInt(String(max_score), 10) : NaN;
  if (!isNaN(minScoreNum) || !isNaN(maxScoreNum)) {
    where.total_score = {};
    if (!isNaN(minScoreNum)) where.total_score.gte = minScoreNum;
    if (!isNaN(maxScoreNum)) where.total_score.lte = maxScoreNum;
  }

  // Fault filter
  if (fault_id && typeof fault_id === 'string' && fault_id !== 'all') {
    where.fault_id = fault_id;
  } else if (has_fault === 'true') {
    where.fault_id = { not: null };
  } else if (has_fault === 'false') {
    where.fault_id = null;
  }

  // Fraud filter
  if (is_fraud === 'true') {
    where.is_fraud = true;
  } else if (is_fraud === 'false') {
    where.is_fraud = false;
  }

  // Jalali year / month filter
  const targetYear = parseInt(String(jalali_year || year), 10);
  const targetMonth = parseInt(String(jalali_month || month), 10);
  if (!isNaN(targetYear) && !isNaN(targetMonth) && targetMonth >= 1 && targetMonth <= 12) {
    const startDate = jalaliToGregorianUTC(targetYear, targetMonth, 1);
    const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear;
    const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1;
    const endDate = jalaliToGregorianUTC(nextYear, nextMonth, 1);
    where.check_date = {
      gte: startDate,
      lt: endDate,
    };
  }

  // Search filter
  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim();
    const searchConditions = [
      { id: { contains: q } },
      { vendor_title: { contains: q } },
      { vendor_id: { contains: q } },
      { ticket_number: { contains: q } },
      { phone_number: { contains: q } },
      { result_comment: { contains: q } },
      { agent: { name: { contains: q } } },
      { agent: { source_id: { contains: q } } },
    ];
    if (where.OR) {
      where.AND = [...(where.AND || []), { OR: searchConditions }];
    } else {
      where.OR = searchConditions;
    }
  }

  return where;
}

// ==========================================
// 8. ASSESSMENTS API (Strict RBAC Scoping & Enforcement)
// ==========================================
app.get('/api/assessments', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const where = buildAssessmentFilterWhere(user, req.query);
    const { page, limit, sort_by, sort_dir } = req.query;

    const allowedSortFields = ['created_at', 'check_date', 'total_score', 'result'];
    const sortField = typeof sort_by === 'string' && allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_dir === 'asc' ? 'asc' : 'desc';
    const orderBy = { [sortField]: sortDirection };

    const total = await prisma.assessment.count({ where });

    if (page !== undefined) {
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, parseInt(String(limit), 10) || 20);
      const skip = (pageNum - 1) * limitNum;
      const assessments = await prisma.assessment.findMany({
        where,
        include: {
          agent: true,
          disputes: true,
          scores: true,
        },
        orderBy,
        skip,
        take: limitNum,
      });

      const formatted = assessments.map(formatAssessmentResponse);
      return res.json({
        success: true,
        count: formatted.length,
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum) || 1,
        data: formatted,
      });
    }

    const assessments = await prisma.assessment.findMany({
      where,
      include: {
        agent: true,
        disputes: true,
        scores: true,
      },
      orderBy,
      ...(limit ? { take: parseInt(String(limit), 10) } : {}),
    });

    const formatted = assessments.map(formatAssessmentResponse);
    res.json({ success: true, count: formatted.length, total, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/assessments/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        agent: true,
        disputes: true,
        scores: true,
      },
    });
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }
    if (!canUserAccessAssessment(req.user!, assessment)) {
      return res.status(403).json({
        success: false,
        message: 'شما دسترسی مجاز به مشاهده این ارزیابی را ندارید (Forbidden)',
      });
    }
    if (assessment.deleted_at && req.user!.role !== 'qa_supervisor') {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }
    res.json({ success: true, data: formatAssessmentResponse(assessment) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/assessments', authenticate, requireRole(['qa_controller', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const body = req.body;

    const targetAgent = await prisma.agent.findUnique({
      where: { id: body.agent_id },
      include: { controller_user: true },
    });

    if (!targetAgent) {
      return res.status(404).json({ success: false, message: 'کارشناس انتخاب‌شده یافت نشد' });
    }

    // QA Controller can only create assessments for assigned agents (immutable IDs)
    if (user.role === 'qa_controller') {
      const isAssigned =
        targetAgent.controller_id === user.id ||
        targetAgent.controller_user?.id === user.id ||
        targetAgent.controller.toLowerCase() === user.username.toLowerCase();

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'کنترلر کیفیت فقط مجاز به ثبت ارزیابی برای کارشناسان تخصیص‌یافته به خود است (Forbidden)',
        });
      }
    }

    const formType = body.form_type || targetAgent.department || 'support';

    // 3. Store the form version used (form_id + version) on each assessment
    const { rubric, formId, formVersion } = await getRubricForForm({
      formId: body.form_id,
      formType,
      formVersion: body.form_version,
    });

    const scoresMap = formType === 'support' ? body.support_scores : body.sales_scores;

    // 2. An item without a recorded score must be a validation error, not default to full points.
    // 1. Never accept out-of-range values, validate on both client and server.
    const validation = validateScores(rubric, scoresMap);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error || 'خطای اعتبارسنجی نمرات ارزیابی (Validation Error)',
        missing_items: validation.missingItems,
        out_of_range_items: validation.outOfRangeItems,
      });
    }

    // Check critical fault & fraud
    let isCriticalFault = false;
    if (body.fault_id) {
      const fault = await prisma.fault.findUnique({ where: { id: body.fault_id } });
      if (fault?.is_critical) isCriticalFault = true;
    }
    const isFraud = Boolean(body.is_fraud);

    // 4. Server must recompute total_score itself from the submitted item scores using the shared scoring module
    let computedTotal = 0;
    if (formType === 'support') {
      const calc = calculateSupportTotal(scoresMap, isFraud, isCriticalFault, rubric);
      computedTotal = calc.total;
    } else {
      const mistakes = Number(body.mistake_count) || 0;
      const calc = calculateSalesTotal(scoresMap, mistakes, isFraud, isCriticalFault, rubric);
      computedTotal = calc.total;
    }

    // 4. Reject mismatching client totals
    if (body.total_score !== undefined && body.total_score !== null && Number(body.total_score) !== computedTotal) {
      return res.status(400).json({
        success: false,
        message: `مجموع نمره ارسالی (${body.total_score}) با نمره محاسبه‌شده در سرور (${computedTotal}) همخوانی ندارد (Total Score Mismatch)`,
        submitted_total: body.total_score,
        computed_total: computedTotal,
      });
    }

    const parsedCheckDate = parseJalaliOrGregorianDate(body.check_date);
    if (!parsedCheckDate) {
      return res.status(400).json({
        success: false,
        message: 'تاریخ بررسی الزامی یا نامعتبر است (Invalid check_date)',
      });
    }

    const newId = body.id || `qa-${Date.now().toString().slice(-6)}`;

    const created = await prisma.assessment.create({
      data: {
        id: newId,
        agent_id: body.agent_id,
        controller_id: user.role === 'qa_controller' ? user.username : (body.controller_id || user.username),
        form_id: formId,
        form_type: formType,
        form_version: formVersion,
        sample_name: body.sample_name || 'Random Sampling',
        vendor_id: body.vendor_id,
        vendor_title: body.vendor_title,
        check_date: parsedCheckDate,
        fault_id: body.fault_id,
        backend_general: Boolean(body.backend_general),
        is_fraud: isFraud,
        result: body.result,
        result_comment: body.result_comment,
        team_lead_reviewed: Boolean(body.team_lead_reviewed),
        team_lead_note: body.team_lead_note,
        team_lead_reviewed_at: body.team_lead_reviewed_at,
        action_taken: body.action_taken,
        ticket_number: body.ticket_number,
        voice_link: body.voice_link,
        fault_categories: body.fault_categories ? JSON.stringify(body.fault_categories) : null,
        support_scores_json: formType === 'support' ? JSON.stringify(scoresMap) : null,
        sales_scores_json: formType === 'sales' ? JSON.stringify(scoresMap) : null,
        phone_number: body.phone_number,
        project: body.project,
        discount_or_coupon: body.discount_or_coupon,
        registration_date: body.registration_date,
        execution_date: body.execution_date,
        mistake_count: body.mistake_count,
        total_score: computedTotal,
      },
    });

    const allItems = getAllRubricItems(rubric);
    const scoreEntries = Object.entries(scoresMap || {});
    if (scoreEntries.length > 0) {
      await prisma.assessmentScore.createMany({
        data: scoreEntries.map(([itemId, val]) => {
          const itemMeta = allItems.find((it) => it.id === itemId);
          return {
            assessment_id: newId,
            item_id: itemId,
            awarded_score: Number(val),
            max_score: itemMeta?.maxPoints || 5,
          };
        }),
      });
    }

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'assessment',
      entity_id: newId,
      action: 'create',
      field: 'total_score',
      new_value: `نمره: ${computedTotal} | کارشناس: ${targetAgent.name} (${targetAgent.source_id}) | فرم: ${formId} (v${formVersion})`,
    });

    const fullAssessment = await prisma.assessment.findUnique({
      where: { id: newId },
      include: { agent: true, disputes: true, scores: true },
    });

    res.status(201).json({ success: true, data: formatAssessmentResponse(fullAssessment) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/assessments/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const body = req.body;

    const existing = await prisma.assessment.findUnique({
      where: { id },
      include: { agent: true, scores: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    // Role verification for editing assessments
    if (user.role === 'qa_controller') {
      const isOwner =
        existing.controller_id === user.username ||
        existing.controller_id === user.id;

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'کنترلر کیفیت فقط مجاز به ویرایش ارزیابی‌های ثبت‌شده توسط خود است (Forbidden)',
        });
      }
    } else if (user.role !== 'qa_supervisor') {
      // Agents, Team Leads, Managers, and Admins cannot edit assessments
      return res.status(403).json({
        success: false,
        message: 'شما دسترسی ویرایش این ارزیابی را ندارید (Forbidden)',
      });
    }

    // 3. Keep old assessments scoring against their original version
    const { rubric } = await getRubricForForm({
      formId: existing.form_id || undefined,
      formType: existing.form_type,
      formVersion: existing.form_version || 1,
    });

    const updateData: any = {};
    if (body.result !== undefined) updateData.result = body.result;
    if (body.result_comment !== undefined) updateData.result_comment = body.result_comment;
    if (body.team_lead_reviewed !== undefined) updateData.team_lead_reviewed = body.team_lead_reviewed;
    if (body.team_lead_note !== undefined) updateData.team_lead_note = body.team_lead_note;
    if (body.team_lead_reviewed_at !== undefined) updateData.team_lead_reviewed_at = body.team_lead_reviewed_at;
    if (body.action_taken !== undefined) updateData.action_taken = body.action_taken;
    // deleted_at is protected from being written/bypassed via PUT
    if (body.fault_id !== undefined) updateData.fault_id = body.fault_id;
    if (body.is_fraud !== undefined) updateData.is_fraud = Boolean(body.is_fraud);
    if (body.backend_general !== undefined) updateData.backend_general = Boolean(body.backend_general);
    if (body.check_date !== undefined) updateData.check_date = parseJalaliOrGregorianDate(body.check_date);

    // If new scores are provided, recompute total_score and validate
    const incomingScores = existing.form_type === 'support' ? body.support_scores : body.sales_scores;
    if (incomingScores) {
      const validation = validateScores(rubric, incomingScores);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.error || 'خطای اعتبارسنجی نمرات ارزیابی (Validation Error)',
          missing_items: validation.missingItems,
          out_of_range_items: validation.outOfRangeItems,
        });
      }

      const isFraud = body.is_fraud !== undefined ? Boolean(body.is_fraud) : existing.is_fraud;
      let isCriticalFault = false;
      const faultIdToCheck = body.fault_id !== undefined ? body.fault_id : existing.fault_id;
      if (faultIdToCheck) {
        const fault = await prisma.fault.findUnique({ where: { id: faultIdToCheck } });
        if (fault?.is_critical) isCriticalFault = true;
      }

      let computedTotal = 0;
      if (existing.form_type === 'support') {
        computedTotal = calculateSupportTotal(incomingScores, isFraud, isCriticalFault, rubric).total;
        updateData.support_scores_json = JSON.stringify(incomingScores);
      } else {
        const mistakes = body.mistake_count !== undefined ? Number(body.mistake_count) : (existing.mistake_count || 0);
        computedTotal = calculateSalesTotal(incomingScores, mistakes, isFraud, isCriticalFault, rubric).total;
        updateData.sales_scores_json = JSON.stringify(incomingScores);
        if (body.mistake_count !== undefined) updateData.mistake_count = mistakes;
      }

      if (body.total_score !== undefined && body.total_score !== null && Number(body.total_score) !== computedTotal) {
        return res.status(400).json({
          success: false,
          message: `مجموع نمره ارسالی (${body.total_score}) با نمره محاسبه‌شده در سرور (${computedTotal}) همخوانی ندارد (Total Score Mismatch)`,
          submitted_total: body.total_score,
          computed_total: computedTotal,
        });
      }

      updateData.total_score = computedTotal;

      // Sync AssessmentScore rows
      await prisma.assessmentScore.deleteMany({ where: { assessment_id: id } });
      const allItems = getAllRubricItems(rubric);
      await prisma.assessmentScore.createMany({
        data: Object.entries(incomingScores).map(([itemId, val]) => {
          const itemMeta = allItems.find((it) => it.id === itemId);
          return {
            assessment_id: id,
            item_id: itemId,
            awarded_score: Number(val),
            max_score: itemMeta?.maxPoints || 5,
          };
        }),
      });
    } else if (body.total_score !== undefined) {
      updateData.total_score = Number(body.total_score);
    }

    const updated = await prisma.assessment.update({
      where: { id },
      data: updateData,
      include: { agent: true, disputes: true, scores: true },
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'assessment',
      entity_id: id,
      action: 'update',
      field: Object.keys(updateData).join(', '),
      old_value: `نمره قبلی: ${existing.total_score}`,
      new_value: updateData.total_score !== undefined ? `نمره جدید: ${updateData.total_score}` : updateData.result,
    });

    res.json({ success: true, data: formatAssessmentResponse(updated) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Team Lead Review Endpoint (Team Lead only for own team)
app.post('/api/assessments/:id/review', authenticate, requireRole(['team_lead', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const user = req.user!;

    const target = await prisma.assessment.findUnique({
      where: { id },
      include: { agent: true },
    });

    if (!target) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    if (user.role === 'team_lead') {
      const teams = (user.team || '').split('/').map((s) => s.trim()).filter(Boolean);
      const isOwnTeam =
        (user.team_id && target.agent.team_id === user.team_id) ||
        teams.includes(target.agent.team_name) ||
        target.agent.team_name === user.team ||
        target.agent.team_lead_id === user.id;

      if (!isOwnTeam) {
        return res.status(403).json({
          success: false,
          message: 'سرپرست تیم فقط مجاز به ثبت بازخورد برای اعضای تیم خود است (Forbidden)',
        });
      }
    }

    const updated = await prisma.assessment.update({
      where: { id },
      data: {
        result: 'بررسی شده',
        team_lead_reviewed: true,
        team_lead_note: note,
        team_lead_reviewed_at: new Date().toLocaleDateString('fa-IR'),
      },
      include: { agent: true, disputes: true, scores: true },
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'assessment',
      entity_id: id,
      action: 'team_lead_reviewed',
      field: 'team_lead_note',
      new_value: `بررسی شده توسط ${user.name}: ${note}`,
    });

    res.json({ success: true, data: formatAssessmentResponse(updated) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Soft Delete Assessment (Supervisor, or QA Controller for own created assessment)
app.delete('/api/assessments/:id', authenticate, requireRole(['qa_controller', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const target = await prisma.assessment.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    if (!canUserDeleteAssessment(user, target)) {
      return res.status(403).json({
        success: false,
        message: 'شما مجاز به حذف این ارزیابی نیستید (Forbidden)',
      });
    }

    await prisma.assessment.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'assessment',
      entity_id: id,
      action: 'delete',
      field: 'deleted_at',
      old_value: `نمره: ${target.total_score}`,
      new_value: 'حذف ارزیابی (Soft Delete)',
    });

    res.json({ success: true, message: 'Assessment soft-deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Restore Assessment (Supervisor Only)
app.post('/api/assessments/:id/restore', authenticate, requireRole(['qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const restored = await prisma.assessment.update({
      where: { id },
      data: { deleted_at: null },
      include: { agent: true, disputes: true, scores: true },
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'assessment',
      entity_id: id,
      action: 'update',
      field: 'deleted_at',
      old_value: 'deleted',
      new_value: 'بازیابی ارزیابی حذف‌شده',
    });

    res.json({ success: true, data: formatAssessmentResponse(restored) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 9. DISPUTES API
// ==========================================
app.get('/api/disputes', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { status } = req.query;
    const where: any = {};

    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }

    // Role scoping for disputes using immutable relationships
    if (user.role === 'agent') {
      const orConds: any[] = [];
      if (user.agent_id) orConds.push({ id: user.agent_id });
      if (user.id) orConds.push({ user_id: user.id });
      where.assessment = {
        agent: orConds.length > 0 ? { OR: orConds } : { id: '__NONE__' },
      };
    } else if (user.role === 'team_lead') {
      const orConds: any[] = [];
      if (user.team_id) orConds.push({ team_id: user.team_id });
      if (user.team) orConds.push({ team_name: user.team });
      if (user.id) orConds.push({ team_lead_id: user.id });
      where.assessment = {
        agent: orConds.length > 0 ? { OR: orConds } : { id: '__NONE__' },
      };
    } else if (user.role === 'manager') {
      if (!user.department) {
        where.id = '__NONE__';
      } else {
        where.assessment = { form_type: user.department };
      }
    } else if (user.role === 'qa_controller') {
      where.assessment = {
        OR: [
          { controller_id: user.id },
          { controller_id: user.username },
          { agent: { controller_id: user.id } },
          { agent: { controller: user.username } },
        ],
      };
    } else if (user.role === 'admin') {
      where.id = '__NONE__';
    }

    const disputes = await prisma.dispute.findMany({
      where,
      include: { assessment: { include: { agent: true } } },
      orderBy: { created_at: 'desc' },
    });

    const mapped = disputes.map((d) => ({
      assessment_id: d.assessment_id,
      agent_id: d.agent_id,
      agent_name: d.agent_name,
      check_date: d.assessment.check_date,
      controller_id: d.assessment.controller_id,
      vendor_title: d.assessment.vendor_title,
      total_score: d.assessment.total_score,
      dispute: {
        id: d.id,
        agent_id: d.agent_id,
        agent_name: d.agent_name,
        criterion_id: d.criterion_id,
        criterion_title: d.criterion_title,
        agent_comment: d.agent_comment,
        status: d.status,
        controller_id: d.controller_id,
        controller_comment: d.controller_comment,
        original_score: d.original_score,
        revised_score: d.revised_score,
        created_at: new Date(d.created_at).toLocaleDateString('fa-IR'),
        resolved_at: d.resolved_at ? new Date(d.resolved_at).toLocaleDateString('fa-IR') : undefined,
      },
    }));

    res.json({ success: true, count: mapped.length, data: mapped });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/assessments/:id/dispute', authenticate, requireRole(['agent', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { criterion_id, criterion_title, agent_comment } = req.body;
    const user = req.user!;

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: { agent: true },
    });

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    // If agent, must be their own assessment (immutable IDs)
    if (user.role === 'agent') {
      const isOwn =
        Boolean((user.agent_id && assessment.agent_id === user.agent_id) ||
        (assessment.agent && assessment.agent.user_id === user.id));

      if (!isOwn) {
        return res.status(403).json({
          success: false,
          message: 'کارشناس فقط می‌تواند برای ارزیابی‌های خود اعتراض ثبت کند (Forbidden)',
        });
      }
    }

    const newDispute = await prisma.dispute.create({
      data: {
        id: `disp-${Date.now().toString().slice(-4)}`,
        assessment_id: id,
        agent_id: assessment.agent_id,
        agent_name: assessment.agent?.name || user.name,
        criterion_id,
        criterion_title,
        agent_comment,
        status: 'pending',
        original_score: assessment.total_score,
      },
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'dispute',
      entity_id: id,
      action: 'dispute_filed',
      field: 'criterion',
      new_value: `${criterion_title}: ${agent_comment}`,
    });

    res.status(201).json({ success: true, data: newDispute });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/disputes/:assessmentId/resolve', authenticate, requireRole(['qa_controller', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const { status, controller_comment, revised_score } = req.body;
    const user = req.user!;

    if (!['pending', 'in_review', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'وضعیت اعتراض نامعتبر است' });
    }

    const dispute = await prisma.dispute.findFirst({
      where: { assessment_id: assessmentId },
      include: { assessment: true },
    });

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    // Role check: Only the assessment's controller or a qa_supervisor can resolve/update dispute
    if (user.role === 'qa_controller') {
      const isOwnerController =
        dispute.assessment.controller_id === user.username ||
        dispute.assessment.controller_id === user.id;

      if (!isOwnerController) {
        return res.status(403).json({
          success: false,
          message: 'فقط کنترلر ثبت‌کننده همین ارزیابی یا سوپروایزر کیفیت مجاز به رسیدگی به اعتراض هستند (Forbidden)',
        });
      }
    }

    if (status === 'in_review') {
      await prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          status: 'in_review',
          controller_id: user.username,
          controller_comment: controller_comment || 'در حال بازشنوایی و بررسی مجدد توسط کنترلر',
        },
      });

      await recordServerAuditLog({
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        entity: 'dispute',
        entity_id: assessmentId,
        action: 'dispute_in_review',
        field: 'status',
        old_value: dispute.status,
        new_value: `در حال بررسی | نظر: ${controller_comment || 'در حال بررسی'}`,
      });

      const updated = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        include: { agent: true, disputes: true, scores: true },
      });

      return res.json({ success: true, data: formatAssessmentResponse(updated) });
    }

    // Otherwise status is 'resolved' or 'rejected'
    const finalScore = status === 'resolved' && revised_score !== undefined ? Number(revised_score) : dispute.original_score;

    await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        status,
        controller_id: user.username,
        controller_comment: controller_comment || (status === 'resolved' ? 'اعتراض پذیرفته شد' : 'اعتراض رد شد'),
        resolved_at: new Date(),
        revised_score: finalScore,
      },
    });

    const updatePayload: any = {};
    if (status === 'resolved' && revised_score !== undefined) {
      updatePayload.total_score = finalScore;

      if (dispute.criterion_id && dispute.criterion_id !== 'general') {
        if (dispute.assessment.form_type === 'support' && dispute.assessment.support_scores_json) {
          try {
            const sc = JSON.parse(dispute.assessment.support_scores_json);
            sc[dispute.criterion_id] = 5;
            updatePayload.support_scores_json = JSON.stringify(sc);
          } catch {}
        } else if (dispute.assessment.form_type === 'sales' && dispute.assessment.sales_scores_json) {
          try {
            const sc = JSON.parse(dispute.assessment.sales_scores_json);
            sc[dispute.criterion_id] = 5;
            updatePayload.sales_scores_json = JSON.stringify(sc);
          } catch {}
        }
      }
    }

    const updatedAssessment = await prisma.assessment.update({
      where: { id: assessmentId },
      data: updatePayload,
      include: { agent: true, disputes: true, scores: true },
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'dispute',
      entity_id: assessmentId,
      action: status === 'resolved' ? 'dispute_resolved' : 'dispute_rejected',
      field: 'revised_score',
      old_value: `${dispute.original_score}`,
      new_value: `نمره اصلاح‌شده: ${finalScore} | نظر کنترلر: ${controller_comment || ''}`,
    });

    res.json({ success: true, data: formatAssessmentResponse(updatedAssessment) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 10. AUDIT LOGS API (Server-Written, Role-Restricted View)
// ==========================================
app.get('/api/audit-logs', authenticate, requireRole(['qa_controller', 'qa_supervisor', 'admin']), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { entity, action, user_id, search, page, limit, sort_by, sort_dir } = req.query;
    const where: any = {};

    // QA Controllers see only logs associated with their own assessments or actions
    if (user.role === 'qa_controller') {
      const myAssessments = await prisma.assessment.findMany({
        where: {
          OR: [
            { controller_id: user.id },
            { controller_id: user.username },
            { agent: { controller_id: user.id } },
            { agent: { controller: user.username } },
          ],
        },
        select: { id: true },
      });
      const myAssessmentIds = myAssessments.map((a) => a.id);

      where.OR = [
        { user_id: user.id },
        ...(myAssessmentIds.length > 0 ? [{ entity: 'assessment', entity_id: { in: myAssessmentIds } }] : []),
        ...(myAssessmentIds.length > 0 ? [{ entity: 'dispute', entity_id: { in: myAssessmentIds } }] : []),
      ];
    }
    if (entity && typeof entity === 'string' && entity !== 'all') {
      where.entity = entity;
    }
    if (action && typeof action === 'string' && action !== 'all') {
      where.action = action;
    }
    if (user_id && typeof user_id === 'string' && user_id !== 'all') {
      where.user_id = user_id;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      const searchOR = [
        { user_name: { contains: q } },
        { entity_id: { contains: q } },
        { field: { contains: q } },
        { old_value: { contains: q } },
        { new_value: { contains: q } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOR }];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }

    const allowedSortFields = ['created_at', 'action', 'entity'];
    const sortField = typeof sort_by === 'string' && allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_dir === 'asc' ? 'asc' : 'desc';
    const orderBy = { [sortField]: sortDirection };

    const total = await prisma.auditLog.count({ where });

    if (page !== undefined) {
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.max(1, parseInt(String(limit), 10) || 50);
      const skip = (pageNum - 1) * limitNum;
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
      });

      const formatted = logs.map((log) => ({
        ...log,
        created_at:
          new Date(log.created_at).toLocaleDateString('fa-IR') +
          ' ' +
          new Date(log.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      }));

      return res.json({
        success: true,
        count: formatted.length,
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum) || 1,
        data: formatted,
      });
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy,
      take: limit ? parseInt(String(limit), 10) : 200,
    });

    const formatted = logs.map((log) => ({
      ...log,
      created_at:
        new Date(log.created_at).toLocaleDateString('fa-IR') +
        ' ' +
        new Date(log.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    }));

    res.json({ success: true, count: formatted.length, total, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 11. SETTINGS API (Admin Only for Updates)
// ==========================================
app.get('/api/settings', authenticate, async (_req: Request, res: Response) => {
  try {
    const settingsRows = await prisma.setting.findMany();
    const result: any = { ...DEFAULT_SETTINGS };

    for (const row of settingsRows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/settings', authenticate, requireRole(['admin', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    const user = req.user!;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid settings object' });
    }

    for (const [key, val] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: JSON.stringify(val) },
        create: { key, value: JSON.stringify(val) },
      });
    }

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'settings',
      entity_id: 'portal_config',
      action: 'settings_updated',
      field: Object.keys(settings).join(', '),
      new_value: JSON.stringify(settings),
    });

    res.json({ success: true, data: settings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 12. PROBLEMS TRACKER API
// ==========================================
app.get('/api/problems', authenticate, async (_req: Request, res: Response) => {
  try {
    const problems = await prisma.problem.findMany({
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, count: problems.length, data: problems });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/problems', authenticate, requireRole(['team_lead', 'manager', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { priority, issue_date, team, category, title, description, status, owner } = req.body;
    const user = req.user!;

    const newProb = await prisma.problem.create({
      data: {
        id: `prob-${Date.now().toString().slice(-4)}`,
        priority: priority || 'Medium',
        issue_date: issue_date || new Date().toLocaleDateString('fa-IR'),
        team: team || user.team || 'General',
        category: category || 'General problem',
        title,
        description,
        status: status || 'Pending',
        owner: owner || user.name,
      },
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'problem',
      entity_id: newProb.id,
      action: 'create',
      field: 'problem_tracker',
      new_value: newProb.title,
    });

    res.status(201).json({ success: true, data: newProb });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/problems/:id', authenticate, requireRole(['team_lead', 'manager', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user!;

    const updated = await prisma.problem.update({
      where: { id },
      data: updates,
    });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'problem',
      entity_id: id,
      action: 'update',
      field: Object.keys(updates).join(', '),
      new_value: updates.status || updated.title,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/problems/:id', authenticate, requireRole(['manager', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const target = await prisma.problem.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    await prisma.problem.delete({ where: { id } });

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'problem',
      entity_id: id,
      action: 'delete',
      field: 'title',
      old_value: target.title,
      new_value: 'حذف مشکل از سامانه',
    });

    res.json({ success: true, message: 'Problem deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 13. EXECUTIVE ANALYTICS API (Direct DB Aggregate with Scoping)
// ==========================================
app.get('/api/analytics', authenticate, requireRole(['manager', 'qa_supervisor']), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { period = 'current_month', department = 'all' } = req.query;

    const where: any = { deleted_at: null };

    if (user.role === 'manager') {
      if (!user.department) {
        return res.status(403).json({
          success: false,
          message: 'مدیر بدون انتساب به دپارتمان مجاز به مشاهده تحلیل‌ها نمی‌باشد (Forbidden)',
        });
      }
      where.form_type = user.department;
    } else if (department !== 'all') {
      where.form_type = department;
    }

    const agentWhere = getAgentScope(user, { active: true });

    const [allAudits, allAgents, settingsRows] = await Promise.all([
      prisma.assessment.findMany({ where }),
      prisma.agent.findMany({ where: agentWhere }),
      prisma.setting.findMany(),
    ]);

    const portalSettings: any = { ...DEFAULT_SETTINGS };
    for (const row of settingsRows) {
      try {
        portalSettings[row.key] = JSON.parse(row.value);
      } catch {
        portalSettings[row.key] = row.value;
      }
    }

    const highThreshold = Number(portalSettings.high_quality_threshold) || 95;
    const lowThreshold = Number(portalSettings.low_quality_threshold) || 80;
    const controllerMonthlyTarget = Number(portalSettings.controller_monthly_target) || 160;

    let activeAudits = allAudits;
    if (period === 'current_month') {
      const nowJalali = dateToJalali(new Date());
      let targetYear = nowJalali.year;
      let targetMonth = nowJalali.month;
      if (allAudits.length > 0) {
        const sortedJalali = allAudits.map((a) => dateToJalali(a.check_date));
        sortedJalali.sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month));
        targetYear = sortedJalali[0].year;
        targetMonth = sortedJalali[0].month;
      }
      activeAudits = activeAudits.filter((a) => {
        const j = dateToJalali(a.check_date);
        return j.year === targetYear && j.month === targetMonth;
      });
    }

    const highQuality: Array<{ agent_id: string; name: string; team: string; avg: number }> = [];
    const lowQuality: Array<{ agent_id: string; name: string; team: string; avg: number }> = [];

    allAgents.forEach((ag) => {
      const audits = activeAudits.filter((a) => a.agent_id === ag.id);
      if (audits.length === 0) return;
      const scores = audits.map((a) => a.total_score);
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;

      if (avg >= highThreshold) {
        highQuality.push({ agent_id: ag.id, name: ag.name, team: ag.team_name, avg });
      } else if (avg < lowThreshold) {
        lowQuality.push({ agent_id: ag.id, name: ag.name, team: ag.team_name, avg });
      }
    });

    const controllerStats = SEED_CONTROLLERS.map((c) => {
      const checked = activeAudits.filter((a) => a.controller_id === c.name).length;
      const target = Number(c.target) || controllerMonthlyTarget;
      return {
        name: c.name,
        display_name: c.display_name,
        checked,
        target,
        percent: Math.min(100, Math.round((checked / target) * 100)),
      };
    });

    res.json({
      success: true,
      totalAudits: activeAudits.length,
      highQuality,
      lowQuality,
      controllerStats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 14. CSV EXPORT & BACKUP API (UTF-8 BOM)
// ==========================================
app.get('/api/export/assessments.csv', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    // Agents & Admins have NO reports permission under PRD
    if (user.role === 'agent' || user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'دسترسی دریافت گزارش و خروجی برای نقش شما مجاز نمی‌باشد (Forbidden)',
      });
    }
    // Managers without department must fail closed
    if (user.role === 'manager' && !user.department) {
      return res.status(403).json({
        success: false,
        message: 'مدیر بدون انتساب به دپارتمان مجاز به دریافت گزارش نمی‌باشد (Forbidden)',
      });
    }

    const where: any = buildAssessmentFilterWhere(user, req.query);

    const assessments = await prisma.assessment.findMany({
      where,
      include: { agent: true },
      orderBy: { check_date: 'desc' },
    });

    const sanitizeCell = (val: any) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      'شناسه',
      'کارشناس',
      'کد سورس',
      'تیم',
      'واحد',
      'تاریخ بررسی',
      'شناسه وندور',
      'نام وندور',
      'نمره کل',
      'نتیجه',
      'کنترلر',
      'شماره تیکت/تماس',
    ];

    const rows = assessments.map((a) => [
      sanitizeCell(a.id),
      sanitizeCell(a.agent?.name || ''),
      sanitizeCell(a.agent?.source_id || ''),
      sanitizeCell(a.agent?.team_name || ''),
      sanitizeCell(a.form_type === 'support' ? 'پشتیبانی' : 'فروش'),
      sanitizeCell(formatJalaliDate(a.check_date)),
      sanitizeCell(a.vendor_id || ''),
      sanitizeCell(a.vendor_title || ''),
      a.total_score,
      sanitizeCell(a.result),
      sanitizeCell(a.controller_id),
      sanitizeCell(a.ticket_number || a.phone_number || ''),
    ]);

    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=snappfood_assessments.csv');
    res.send(csv);
  } catch (err: any) {
    res.status(500).send('Export error: ' + err.message);
  }
});

// Excel (.xlsx) Export for Assessments
app.get('/api/export/assessments.xlsx', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    // Agents & Admins have NO reports permission under PRD
    if (user.role === 'agent' || user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'دسترسی دریافت گزارش و خروجی برای نقش شما مجاز نمی‌باشد (Forbidden)',
      });
    }
    // Managers without department must fail closed
    if (user.role === 'manager' && !user.department) {
      return res.status(403).json({
        success: false,
        message: 'مدیر بدون انتساب به دپارتمان مجاز به دریافت گزارش نمی‌باشد (Forbidden)',
      });
    }

    const where: any = buildAssessmentFilterWhere(user, req.query);

    const assessments = await prisma.assessment.findMany({
      where,
      include: { agent: true, disputes: true },
      orderBy: { check_date: 'desc' },
    });

    const sanitizeVal = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (/^[=+\-@\t\r]/.test(str)) {
        return "'" + str;
      }
      return val;
    };

    const headers = [
      'شناسه ارزیابی',
      'نام کارشناس',
      'کد سورس',
      'تیم',
      'واحد',
      'تاریخ بررسی (شمسی)',
      'تاریخ بررسی (UTC)',
      'شناسه وندور',
      'عنوان وندور',
      'نمره کل',
      'نتیجه',
      'کنترلر',
      'شماره تیکت/تماس',
      'وضعیت خطا/تقلب',
      'وضعیت اعتراض',
    ];

    const data = assessments.map((a) => {
      const j = dateToJalali(a.check_date);
      const disputeStatus = a.disputes?.[0]
        ? a.disputes[0].status === 'resolved'
          ? 'تایید اعتراض'
          : a.disputes[0].status === 'in_review'
          ? 'در حال بررسی'
          : a.disputes[0].status === 'rejected'
          ? 'رد اعتراض'
          : 'در انتظار'
        : 'ندارد';

      return [
        sanitizeVal(a.id),
        sanitizeVal(a.agent?.name || ''),
        sanitizeVal(a.agent?.source_id || ''),
        sanitizeVal(a.agent?.team_name || ''),
        sanitizeVal(a.form_type === 'support' ? 'پشتیبانی' : 'فروش'),
        sanitizeVal(j.jalaliStr),
        sanitizeVal(a.check_date.toISOString()),
        sanitizeVal(a.vendor_id || ''),
        sanitizeVal(a.vendor_title || ''),
        a.total_score,
        sanitizeVal(a.result),
        sanitizeVal(a.controller_id),
        sanitizeVal(a.ticket_number || a.phone_number || ''),
        sanitizeVal(a.is_fraud ? 'تقلب (Fraud)' : a.fault_id ? 'دارای خطا' : 'بدون خطا'),
        sanitizeVal(disputeStatus),
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 20 },
      { wch: 12 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
      { wch: 24 },
      { wch: 14 },
      { wch: 24 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ارزیابی‌ها');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=snappfood_assessments.xlsx');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Excel export error: ' + err.message);
  }
});

// Excel (.xlsx) Export for Monthly Scores
app.get('/api/export/monthly-scores.xlsx', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    // Agents & Admins have NO reports permission under PRD
    if (user.role === 'agent' || user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'دسترسی دریافت گزارش ماهانه برای نقش شما مجاز نمی‌باشد (Forbidden)',
      });
    }
    // Managers without department must fail closed
    if (user.role === 'manager' && !user.department) {
      return res.status(403).json({
        success: false,
        message: 'مدیر بدون انتساب به دپارتمان مجاز به دریافت گزارش نمی‌باشد (Forbidden)',
      });
    }

    const agentWhere = getAgentScope(user, { active: true });
    const assessmentWhere = getAssessmentScope(user, { deleted_at: null });

    const [agents, assessments, settingsRows] = await Promise.all([
      prisma.agent.findMany({ where: agentWhere, include: { team_lead_user: true } }),
      prisma.assessment.findMany({ where: assessmentWhere }),
      prisma.setting.findMany(),
    ]);

    const settings: any = { ...DEFAULT_SETTINGS };
    for (const row of settingsRows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    const highQualityThreshold = Number(settings.high_quality_threshold) || 95;
    const lowQualityThreshold = Number(settings.low_quality_threshold) || 80;

    const headers = [
      'کد پرسنلی سورس',
      'نام کارشناس',
      'تیم',
      'واحد',
      'سرپرست تیم',
      'کنترلر کیفیت',
      'تعداد ارزیابی‌ها',
      'حداقل تارگت ماهانه',
      'میانگین نمرات خام',
      'تعداد تقلب',
      'نمره نهایی ماهانه',
      'سطح کیفی',
    ];

    const rows = agents.map((ag) => {
      const agAudits = assessments.filter((a) => a.agent_id === ag.id);
      const scores = agAudits.map((a) => a.total_score);
      const fraudCount = agAudits.filter((a) => a.is_fraud).length;
      const count = scores.length;
      const rawAvg = count > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / count) * 10) / 10 : 0;

      let monthlyScore = rawAvg;
      if (fraudCount === 1) {
        monthlyScore = Math.max(0, rawAvg - 10);
      } else if (fraudCount > 1) {
        monthlyScore = 0;
      }

      let status = 'نامشخص';
      if (count === 0) status = 'بدون ارزیابی';
      else if (monthlyScore >= highQualityThreshold) status = 'کیفیت بالا (High)';
      else if (monthlyScore < lowQualityThreshold) status = 'نیازمند کوچینگ (Low)';
      else status = 'استاندارد (Standard)';

      return [
        ag.source_id,
        ag.name,
        ag.team_name,
        ag.department === 'support' ? 'پشتیبانی' : 'فروش',
        ag.team_lead,
        ag.controller,
        count,
        ag.min_monthly_reviews,
        rawAvg,
        fraudCount,
        monthlyScore,
        status,
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 22 },
      { wch: 16 },
      { wch: 12 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نمرات ماهانه');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=snappfood_monthly_scores.xlsx');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Excel monthly export error: ' + err.message);
  }
});

// CSV Assessment Import for Historical Assessments (Dry-Run Preview + Error Report)
app.post(
  '/api/assessments/import',
  authenticate,
  requireRole(['qa_controller', 'qa_supervisor', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { csvText, rows: inputRows, dryRun = true } = req.body;

      let records: any[] = [];
      if (Array.isArray(inputRows) && inputRows.length > 0) {
        records = inputRows;
      } else if (typeof csvText === 'string' && csvText.trim()) {
        const cleanText = csvText.replace(/^\uFEFF/, '').trim();
        const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          return res.status(400).json({ success: false, message: 'فایل CSV فاقد داده است' });
        }

        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === ',' && !inQuotes) {
              result.push(cur.trim());
              cur = '';
            } else {
              cur += ch;
            }
          }
          result.push(cur.trim());
          return result;
        };

        const headerRow = parseCsvLine(lines[0]);
        records = lines.slice(1).map((line, idx) => {
          const values = parseCsvLine(line);
          const obj: Record<string, string> = { _rowIndex: String(idx + 2) };
          headerRow.forEach((h, hIdx) => {
            obj[h] = values[hIdx] ?? '';
          });
          return obj;
        });
      } else {
        return res
          .status(400)
          .json({ success: false, message: 'لطفاً فایل CSV یا لیست ارزیابی‌ها را ارسال نمایید' });
      }

      const allAgents = await prisma.agent.findMany();
      const agentMapById = new Map<string, any>();
      const agentMapBySource = new Map<string, any>();
      const agentMapByName = new Map<string, any>();

      for (const ag of allAgents) {
        agentMapById.set(ag.id.toLowerCase(), ag);
        agentMapBySource.set(ag.source_id.toLowerCase(), ag);
        agentMapByName.set(ag.name.toLowerCase(), ag);
      }

      const errors: Array<{ row: number; field: string; message: string; rawValue?: any }> = [];
      const validAssessments: Array<any> = [];

      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const rowNum = Number(rec._rowIndex) || i + 2;

        const rawAgent =
          rec.agent_id ||
          rec['کد کارشناس'] ||
          rec['شناسه کارشناس'] ||
          rec['کارشناس'] ||
          rec['کد سورس'] ||
          rec.source_id ||
          '';
        const rawDate =
          rec.check_date || rec['تاریخ بررسی'] || rec['تاریخ'] || rec['check_date_jalali'] || '';
        const rawScore =
          rec.total_score !== undefined
            ? rec.total_score
            : rec['نمره کل'] !== undefined
            ? rec['نمره کل']
            : rec['نمره'] !== undefined
            ? rec['نمره']
            : '';
        const rawVendorId = rec.vendor_id || rec['شناسه وندور'] || rec['کد وندور'] || '';
        const rawVendorTitle =
          rec.vendor_title || rec['عنوان وندور'] || rec['نام وندور'] || 'وندور ثبت‌شده';
        const rawResult = rec.result || rec['نتیجه'] || 'No problem';
        const rawFormType = (rec.form_type || rec['واحد'] || rec['دپارتمان'] || '').toLowerCase();
        const rawTicket =
          rec.ticket_number || rec['شماره تیکت'] || rec.phone_number || rec['شماره تماس'] || '';

        const cleanAgentKey = String(rawAgent).trim().toLowerCase();
        const targetAgent =
          agentMapById.get(cleanAgentKey) ||
          agentMapBySource.get(cleanAgentKey) ||
          agentMapByName.get(cleanAgentKey);

        if (!targetAgent) {
          errors.push({
            row: rowNum,
            field: 'agent_id',
            message: `کارشناس با شناسه/کد "${rawAgent}" در سیستم یافت نشد`,
            rawValue: rawAgent,
          });
          continue;
        }

        if (user.role === 'qa_controller') {
          const isAssigned =
            targetAgent.controller_id === user.id ||
            targetAgent.controller.toLowerCase() === user.username.toLowerCase();
          if (!isAssigned) {
            errors.push({
              row: rowNum,
              field: 'agent_id',
              message: `شما به عنوان کنترلر فقط مجاز به ثبت ارزیابی برای کارشناسان تخصیص‌یافته به خود هستید (کارشناس: ${targetAgent.name})`,
              rawValue: rawAgent,
            });
            continue;
          }
        }

        const cleanScoreStr = toEnglishDigits(String(rawScore)).trim();
        const scoreNum = Number(cleanScoreStr);
        if (cleanScoreStr === '' || isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
          errors.push({
            row: rowNum,
            field: 'total_score',
            message: `نمره کل نامعتبر است (${rawScore}). نمره باید بین ۰ تا ۱۰۰ باشد`,
            rawValue: rawScore,
          });
          continue;
        }

        let parsedDate: Date;
        try {
          const maybeDate = parseJalaliOrGregorianDate(rawDate);
          if (!maybeDate || isNaN(maybeDate.getTime())) {
            throw new Error('Invalid date');
          }
          parsedDate = maybeDate;
        } catch {
          errors.push({
            row: rowNum,
            field: 'check_date',
            message: `تاریخ بررسی نامعتبر است: "${rawDate}"`,
            rawValue: rawDate,
          });
          continue;
        }

        let finalFormType = 'support';
        if (rawFormType.includes('فروش') || rawFormType.includes('sales')) {
          finalFormType = 'sales';
        } else if (rawFormType.includes('پشتیبانی') || rawFormType.includes('support')) {
          finalFormType = 'support';
        } else if (targetAgent.department) {
          finalFormType = targetAgent.department;
        }

        const newId = `qa-imp-${Date.now().toString().slice(-5)}-${i}`;
        validAssessments.push({
          id: newId,
          agent_id: targetAgent.id,
          agent_name: targetAgent.name,
          agent_source_id: targetAgent.source_id,
          controller_id: user.username,
          form_id: `form-${finalFormType}-v1`,
          form_type: finalFormType,
          form_version: 1,
          sample_name: 'Historical Import',
          vendor_id: String(rawVendorId).trim() || undefined,
          vendor_title: String(rawVendorTitle).trim() || 'وندور ایمپورت‌شده',
          check_date: parsedDate,
          total_score: Math.round(scoreNum),
          result: String(rawResult).trim() || 'No problem',
          ticket_number: finalFormType === 'support' ? rawTicket : undefined,
          phone_number: finalFormType === 'sales' ? rawTicket : undefined,
        });
      }

      if (dryRun) {
        return res.json({
          success: true,
          dryRun: true,
          totalRows: records.length,
          validCount: validAssessments.length,
          errorCount: errors.length,
          errors,
          preview: validAssessments.slice(0, 15).map((a) => {
            const j = dateToJalali(a.check_date);
            return {
              ...a,
              check_date_jalali: j.persianJalaliStr,
            };
          }),
        });
      }

      if (validAssessments.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'هیچ رکورد معتبری برای ایمپورت یافت نشد',
          errors,
        });
      }

      for (const item of validAssessments) {
        await prisma.assessment.create({
          data: {
            id: item.id,
            agent_id: item.agent_id,
            controller_id: item.controller_id,
            form_id: item.form_id,
            form_type: item.form_type,
            form_version: item.form_version,
            sample_name: item.sample_name,
            vendor_id: item.vendor_id,
            vendor_title: item.vendor_title,
            check_date: item.check_date,
            total_score: item.total_score,
            result: item.result,
            ticket_number: item.ticket_number,
            phone_number: item.phone_number,
          },
        });
      }

      await recordServerAuditLog({
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        entity: 'assessment',
        entity_id: 'batch_csv_import',
        action: 'create',
        field: 'bulk_import',
        new_value: `ایمپورت موفق ${validAssessments.length} ارزیابی تاریخی از فایل CSV`,
      });

      res.json({
        success: true,
        dryRun: false,
        importedCount: validAssessments.length,
        errorCount: errors.length,
        errors,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'خطا در پردازش فایل: ' + err.message });
    }
  }
);

// System Reset Seed (Admin Only)
app.post('/api/system/reset-seed', authenticate, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    // Reset tables
    await prisma.dispute.deleteMany();
    await prisma.assessmentScore.deleteMany();
    await prisma.assessment.deleteMany();
    await prisma.rubricCriteriaItem.deleteMany();
    await prisma.rubricCriteria.deleteMany();
    await prisma.assessmentForm.deleteMany();
    await prisma.problem.deleteMany();
    await prisma.fault.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.team.deleteMany();

    // Re-seed settings
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: JSON.stringify(val) },
        create: { key, value: JSON.stringify(val) },
      });
    }

    // Re-seed teams
    for (const t of SEED_TEAMS) {
      await prisma.team.create({
        data: { id: t.id, name: t.name, department: t.department, lead_name: t.lead_name },
      });
    }

    // Re-seed agents
    for (const ag of SEED_AGENTS) {
      const teamRec = await prisma.team.findFirst({ where: { name: ag.team } });
      await prisma.agent.create({
        data: {
          id: ag.id,
          source_id: ag.source_id,
          name: ag.name,
          department: ag.department,
          team_id: teamRec?.id || 'team-technical',
          team_name: ag.team,
          team_lead: ag.team_lead,
          controller: ag.controller,
          operator_panel: ag.operator_panel,
          sample_name: ag.sample_name || 'Random Sampling',
          check_process: ag.check_process || 'if needed',
          min_monthly_reviews: ag.min_monthly_reviews,
          active: true,
        },
      });
    }

    // Re-seed forms
    const supportForm = await prisma.assessmentForm.create({
      data: {
        id: 'form-support-v1',
        form_type: 'support',
        title: 'روبریک ارزیابی پشتیبانی (Support Rubric)',
        version: 1,
        is_active: true,
      },
    });

    for (const [secIdx, section] of SUPPORT_RUBRIC.entries()) {
      for (const [critIdx, crit] of section.criteria.entries()) {
        const critRec = await prisma.rubricCriteria.create({
          data: {
            id: `crit-${crit.id}`,
            form_id: supportForm.id,
            section: section.id,
            title: crit.title,
            max_points: crit.maxPoints,
            order_index: secIdx * 10 + critIdx,
          },
        });
        for (const [itemIdx, item] of crit.items.entries()) {
          await prisma.rubricCriteriaItem.create({
            data: {
              id: `item-${item.id}`,
              criteria_id: critRec.id,
              title: item.title,
              max_points: item.maxPoints,
              order_index: itemIdx,
            },
          });
        }
      }
    }

    const salesForm = await prisma.assessmentForm.create({
      data: {
        id: 'form-sales-v1',
        form_type: 'sales',
        title: 'روبریک ارزیابی فروش (Sales Rubric)',
        version: 1,
        is_active: true,
      },
    });

    for (const [secIdx, section] of SALES_RUBRIC.entries()) {
      for (const [critIdx, crit] of section.criteria.entries()) {
        const critRec = await prisma.rubricCriteria.create({
          data: {
            id: `crit-${crit.id}`,
            form_id: salesForm.id,
            section: section.id,
            title: crit.title,
            max_points: crit.maxPoints,
            order_index: secIdx * 10 + critIdx,
          },
        });
        for (const [itemIdx, item] of crit.items.entries()) {
          await prisma.rubricCriteriaItem.create({
            data: {
              id: `item-${item.id}`,
              criteria_id: critRec.id,
              title: item.title,
              max_points: item.maxPoints,
              order_index: itemIdx,
            },
          });
        }
      }
    }

    // Re-seed faults
    for (const f of SEED_FAULTS) {
      await prisma.fault.create({
        data: {
          id: f.id,
          title: f.title,
          department: f.department,
          category: f.category,
          is_critical: f.is_critical,
          description: f.description,
        },
      });
    }

    // Re-seed assessments
    for (const a of SEED_ASSESSMENTS) {
      await prisma.assessment.create({
        data: {
          id: a.id,
          agent_id: a.agent_id,
          controller_id: a.controller_id,
          form_type: a.form_type,
          form_version: a.form_version || 1,
          sample_name: a.sample_name,
          vendor_id: a.vendor_id,
          vendor_title: a.vendor_title,
          check_date: a.check_date,
          fault_id: a.fault_id,
          backend_general: a.backend_general,
          is_fraud: a.is_fraud,
          result: a.result,
          result_comment: a.result_comment,
          team_lead_reviewed: a.team_lead_reviewed || false,
          team_lead_note: a.team_lead_note,
          team_lead_reviewed_at: a.team_lead_reviewed_at,
          action_taken: a.action_taken,
          ticket_number: a.ticket_number,
          voice_link: a.voice_link,
          fault_categories: a.fault_categories ? JSON.stringify(a.fault_categories) : null,
          support_scores_json: a.support_scores ? JSON.stringify(a.support_scores) : null,
          sales_scores_json: a.sales_scores ? JSON.stringify(a.sales_scores) : null,
          phone_number: a.phone_number,
          project: a.project,
          discount_or_coupon: a.discount_or_coupon,
          registration_date: a.registration_date,
          execution_date: a.execution_date,
          mistake_count: a.mistake_count,
          total_score: a.total_score,
          created_at: new Date(a.created_at),
        },
      });

      if (a.dispute) {
        await prisma.dispute.create({
          data: {
            id: a.dispute.id || `disp-${a.id}`,
            assessment_id: a.id,
            agent_id: a.agent_id,
            agent_name: a.dispute.agent_name,
            criterion_id: a.dispute.criterion_id,
            criterion_title: a.dispute.criterion_title,
            agent_comment: a.dispute.agent_comment,
            status: a.dispute.status,
            controller_id: a.dispute.controller_id,
            controller_comment: a.dispute.controller_comment,
            original_score: a.dispute.original_score,
            revised_score: a.dispute.revised_score,
          },
        });
      }
    }

    // Re-seed problems
    for (const p of SEED_PROBLEMS) {
      await prisma.problem.create({
        data: {
          id: p.id,
          priority: p.priority,
          issue_date: p.issue_date,
          team: p.team,
          category: p.category,
          title: p.title,
          description: p.description,
          status: p.status,
          owner: p.owner,
          resolved_at: p.resolved_at,
          solution_note: p.solution_note,
          created_at: new Date(p.created_at),
        },
      });
    }

    await recordServerAuditLog({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      entity: 'settings',
      entity_id: 'database',
      action: 'update',
      field: 'reset_seed',
      new_value: 'بازنشانی کامل پایگاه‌داده به داده‌های مرجع PRD',
    });

    res.json({ success: true, message: 'پایگاه داده با موفقیت بازنشانی شد' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 15. DEV VITE MIDDLEWARE & PROD STATIC SERVE
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('⚡ Vite dev server middleware mounted in Express');
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SnappFood Commercial QA Server running at http://0.0.0.0:${PORT}`);
    console.log(`📡 Real Prisma REST backend active with RBAC & Auth Adapter (${authAdapter.name})`);
  });
  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { app, prisma, authAdapter, recordServerAuditLog, startServer };
