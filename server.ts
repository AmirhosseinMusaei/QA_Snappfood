import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  SUPPORT_RUBRIC,
  SALES_RUBRIC,
  calculateSupportTotal,
  calculateSalesTotal,
  validateScores,
  getAllRubricItems,
} from "./src/utils/scoring.ts";
import {
  dateToJalali,
  parseJalaliOrGregorianDate,
  formatJalaliDate,
  getCurrentJalaliYear,
  toEnglishDigits,
  jalaliToGregorianUTC,
  jalaliMonthRange,
} from "./src/utils/persian.ts";
import { writeWorkbook } from "./src/server/workbook.ts";
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
} from "./src/data/seedData.ts";
import {
  LocalDatabaseAuthAdapter,
  CorporateSSOAdapter,
  validateProductionSecrets,
} from "./src/server/auth/adapter.ts";
import { createAuthMiddleware } from "./src/server/auth/middleware.ts";
import {
  getAssessmentScope,
  canUserAccessAssessment,
  canUserEditAssessment,
  canUserDeleteAssessment,
  getAgentScope,
} from "./src/server/auth/scope.ts";
import { publicData, ApiError, apiFailure } from "./src/server/safe.ts";
import { z } from "zod";
import {
  assessmentInput,
  problemInput,
  roleSchema,
} from "./src/server/validation.ts";
import { parse as parseCsvRaw } from "csv-parse/sync";
import {
  calculateAgentMonthlyScoreDetailed,
  validateRubricDefinition,
} from "./src/utils/scoring.ts";
import type { AuthUser } from "./src/server/auth/types.ts";

dotenv.config();
function parseCsv(input: string, options: any): any[] {
  try {
    return parseCsvRaw(input, {
      ...options,
      max_record_size: 200000,
      columns: (headers: string[]) => {
        if (new Set(headers).size !== headers.length)
          throw new Error("Duplicate CSV header");
        return headers;
      },
    });
  } catch {
    throw new ApiError(
      400,
      "ساختار CSV نامعتبر است؛ نقل‌قول‌ها و نام ستون‌ها را بررسی کنید",
    );
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbUrl =
  process.env.NODE_ENV === "test"
    ? process.env.TEST_DATABASE_URL || "file:./test.db"
    : process.env.DATABASE_URL || "file:./dev.db";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});
const app = express();
if (process.env.TRUST_PROXY)
  app.set(
    "trust proxy",
    process.env.TRUST_PROXY.split(",").map((s) => s.trim()),
  );
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const COOKIE_SECRET =
  process.env.COOKIE_SECRET &&
  process.env.COOKIE_SECRET !== "snappfood-qa-session-cookie-secret-2024"
    ? process.env.COOKIE_SECRET
    : "snappfood-qa-session-cookie-secret-2024";

// Validate production secrets configuration
validateProductionSecrets(COOKIE_SECRET);

// Pluggable Auth Adapter: Local Database (bcrypt) or Corporate SSO (LDAP / SAML)
const authAdapter =
  process.env.AUTH_PROVIDER === "sso"
    ? new CorporateSSOAdapter(prisma)
    : new LocalDatabaseAuthAdapter(prisma);

const {
  authenticate,
  optionalAuth,
  requireRole,
  loginRateLimiter,
  validateCsrfOrigin,
} = createAuthMiddleware(authAdapter);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser(COOKIE_SECRET));
app.use("/api", validateCsrfOrigin);
const reqBody = (r: any) => r.body && typeof r.body === "object";
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (reqBody(_req)) delete _req.body.currentUser;
  const json = res.json.bind(res);
  res.json = ((body: any) => json(publicData(body))) as any;
  next();
});

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
        user_id: params.user_id || "system",
        user_name: params.user_name || "کاربر سیستم",
        user_role: params.user_role || "system",
        entity: params.entity,
        entity_id: params.entity_id,
        action: params.action,
        field: params.field,
        old_value: params.old_value,
        new_value: params.new_value,
      },
    });
  } catch (err) {
    console.error("Failed to create server audit log:", err);
    throw err;
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
  } else if (a.scores && a.scores.length > 0 && a.form_type === "support") {
    a.scores.forEach((s: any) => {
      supportScores[s.item_id] = s.awarded_score;
    });
  }

  let salesScores: Record<string, number> = {};
  if (a.sales_scores_json) {
    try {
      salesScores = JSON.parse(a.sales_scores_json);
    } catch {}
  } else if (a.scores && a.scores.length > 0 && a.form_type === "sales") {
    a.scores.forEach((s: any) => {
      salesScores[s.item_id] = s.awarded_score;
    });
  }

  const dispute =
    a.disputes && a.disputes.length > 0 ? a.disputes[0] : undefined;
  const jalali = dateToJalali(a.check_date);
  const checkDateIso =
    a.check_date instanceof Date
      ? a.check_date.toISOString()
      : typeof a.check_date === "string"
        ? a.check_date
        : new Date().toISOString();

  return {
    ...a,
    form: undefined,
    rubric: a.form
      ? convertFormToRubric(
          a.form,
          a.form_type === "support" ? SUPPORT_RUBRIC : SALES_RUBRIC,
        )
      : null,
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
          status:
            ({ pending: "open", resolved: "accepted" } as any)[
              dispute.status
            ] || dispute.status,
          controller_id: dispute.controller_id,
          controller_comment: dispute.controller_comment,
          original_score: dispute.original_score,
          revised_score: dispute.revised_score,
          created_at: dispute.created_at
            ? new Date(dispute.created_at).toISOString()
            : "",
          resolved_at: dispute.resolved_at
            ? new Date(dispute.resolved_at).toISOString()
            : undefined,
        }
      : undefined,
  };
}

// ==========================================
// 1. HEALTH & SYSTEM INFO
// ==========================================
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

// ==========================================
// 2. AUTHENTICATION & SESSION API
// ==========================================
app.post(
  "/api/auth/login",
  loginRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { username, password, ssoToken, provider } = z
        .object({
          username: z.string().trim().max(100).optional(),
          password: z.string().max(200).optional(),
          ssoToken: z.string().optional(),
          provider: z.enum(["local", "sso"]).default("local"),
        })
        .strict()
        .parse(req.body);

      if (provider === "sso" || ssoToken) {
        return res.status(503).json({
          success: false,
          message:
            "سرویس احراز هویت یکپارچه سازمانی (SSO) پیکربندی نشده و در دسترس نیست",
        });
      }

      if (!username) {
        return res
          .status(400)
          .json({ success: false, message: "نام کاربری الزامی است" });
      }
      if (!password) {
        return res
          .status(400)
          .json({ success: false, message: "کلمه عبور الزامی است" });
      }

      const authUser = await authAdapter.authenticate({
        username,
        password,
        provider,
      });

      if (!authUser) {
        return res.status(401).json({
          success: false,
          message: "نام کاربری یا رمز عبور اشتباه است.",
        });
      }

      // Create session token
      const sessionToken = await authAdapter.createSession(authUser);

      // Set HttpOnly signed cookie
      res.cookie("snappfood_session", sessionToken, {
        httpOnly: true,
        signed: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/",
      });

      await recordServerAuditLog({
        user_id: authUser.id,
        user_name: authUser.name,
        user_role: authUser.role,
        entity: "settings",
        entity_id: authUser.id,
        action: "create",
        field: "user_session",
        new_value: `ورود موفق: ${authUser.name} (${authUser.role})`,
      });

      // Do not return raw session token in JSON body
      res.json({
        success: true,
        user: authUser,
      });
    } catch (err: any) {
      apiFailure(res, err);
    }
  },
);

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  try {
    const token =
      req.signedCookies?.snappfood_session ||
      req.cookies?.snappfood_session ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    if (token) {
      await authAdapter.destroySession(token);
    }
    res.clearCookie("snappfood_session", { path: "/" });
    res.json({ success: true, message: "خروج موفقیت‌آمیز" });
  } catch (err: any) {
    apiFailure(res, err);
  }
});

app.get("/api/auth/me", optionalAuth, (req: Request, res: Response) => {
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
app.post("/api/users/login", loginRateLimiter, (req, res) => {
  if (!req.body.username || !req.body.password)
    return res
      .status(400)
      .json({ success: false, message: "نام کاربری و رمز عبور الزامی است" });
  res.redirect(307, "/api/auth/login");
});

app.get("/api/staff", authenticate, async (_req: Request, res: Response) => {
  try {
    const [controllers, teamLeads] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: { in: ["qa_controller", "qa_supervisor"] },
          active: true,
        },
        select: { id: true, username: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: {
          role: "team_lead",
          active: true,
        },
        select: {
          id: true,
          username: true,
          name: true,
          team: true,
          department: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const targetSetting = await prisma.setting.findUnique({
      where: { key: "controller_monthly_target" },
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
      teamLeads: teamLeads.map((tl) => ({
        id: tl.id,
        username: tl.username,
        name: tl.name,
        team: tl.team,
        department: tl.department,
      })),
    });
  } catch (err: any) {
    apiFailure(res, err);
  }
});

// ==========================================
// 3. USERS MANAGEMENT (Admin & Supervisor Only)
// ==========================================
app.get(
  "/api/users",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (_req: Request, res: Response) => {
    try {
      const users = await prisma.user.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      });
      res.json({ success: true, count: users.length, data: users });
    } catch (err: any) {
      apiFailure(res, err);
    }
  },
);

const userInput = z
  .object({
    username: z.string().trim().min(1).max(100).optional(),
    password: z.string().min(10).max(200).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    role: roleSchema.optional(),
    department: z.enum(["support", "sales"]).nullable().optional(),
    team: z.string().max(200).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();
async function auditedMutation(
  user: AuthUser,
  entity: string,
  id: string | undefined,
  action: string,
  operation: (db: any) => Promise<any>,
) {
  return prisma.$transaction(async (db) => {
    const model = (db as any)[entity];
    const before = id ? await model.findUnique({ where: { id } }) : null;
    const after = await operation(db);
    await auditFields(
      db,
      user,
      entity,
      after?.id || id,
      action,
      before,
      after || null,
    );
    return after;
  }, txOptions);
}
app.post(
  "/api/users",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const b = userInput.parse(req.body);
      if (!b.username || !b.password || !b.name || !b.role)
        throw new ApiError(400, "اطلاعات کاربر ناقص است");
      const data = await auditedMutation(
        req.user!,
        "user",
        undefined,
        "create",
        (db) =>
          db.user.create({
            data: { ...b, password: bcrypt.hashSync(b.password!, 12) },
          }),
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.put(
  "/api/users/:id",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const b = userInput.omit({ username: true }).parse(req.body);
      if (
        req.params.id === req.user!.id &&
        (b.active === false || (b.role && b.role !== req.user!.role))
      )
        throw new ApiError(400, "تغییر نقش یا غیرفعال‌کردن خود مجاز نیست");
      const data = await auditedMutation(
        req.user!,
        "user",
        req.params.id,
        "update",
        async (db) => {
          const updated = await db.user.update({
            where: { id: req.params.id },
            data: {
              ...b,
              ...(b.password
                ? { password: bcrypt.hashSync(b.password, 12) }
                : {}),
            },
          });
          if (b.password || b.active === false || b.role)
            await db.session.deleteMany({ where: { user_id: req.params.id } });
          return updated;
        },
      );
      res.json({ success: true, data });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.delete(
  "/api/users/:id",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      if (req.params.id === req.user!.id)
        throw new ApiError(400, "غیرفعال‌کردن خود مجاز نیست");
      const data = await auditedMutation(
        req.user!,
        "user",
        req.params.id,
        "deactivate",
        async (db) => {
          await db.session.deleteMany({ where: { user_id: req.params.id } });
          return db.user.update({
            where: { id: req.params.id },
            data: { active: false },
          });
        },
      );
      res.json({ success: true, data });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

// ==========================================
// 4. TEAMS API
// ==========================================
app.get("/api/teams", authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const where: any = {};

    if (user.role === "team_lead") {
      where.lead_id = user.id;
    } else if (user.role === "manager") {
      if (user.department) {
        where.department = user.department;
      } else {
        where.id = "__NONE__";
      }
    }

    const teams = await prisma.team.findMany({
      where,
      orderBy: { name: "asc" },
    });
    res.json({ success: true, count: teams.length, data: teams });
  } catch (err: any) {
    apiFailure(res, err);
  }
});

const teamInput = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    department: z.enum(["support", "sales"]).optional(),
    lead_id: z.string().nullable().optional(),
  })
  .strict();
async function teamData(db: any, b: any) {
  const data = { ...b };
  if (b.lead_id !== undefined) {
    const lead = b.lead_id
      ? await db.user.findUnique({ where: { id: b.lead_id } })
      : null;
    if (b.lead_id && (!lead?.active || lead.role !== "team_lead"))
      throw new ApiError(400, "سرپرست معتبر نیست");
    data.lead_name = lead?.name || "";
  }
  return data;
}
app.post(
  "/api/teams",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const b = teamInput.parse(req.body);
      if (!b.name || !b.department)
        throw new ApiError(400, "نام و واحد تیم الزامی است");
      const data = await auditedMutation(
        req.user!,
        "team",
        undefined,
        "create",
        async (db) =>
          db.team.create({
            data: { lead_name: "", ...(await teamData(db, b)) },
          }),
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.put(
  "/api/teams/:id",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const b = teamInput.parse(req.body);
      const data = await auditedMutation(
        req.user!,
        "team",
        req.params.id,
        "update",
        async (db) => {
          const old = await db.team.findUnique({
            where: { id: req.params.id },
          });
          if (!old) throw new ApiError(404, "تیم یافت نشد");
          if (
            b.department &&
            b.department !== old.department &&
            (await db.agent.count({ where: { team_id: old.id } }))
          )
            throw new ApiError(
              409,
              "برای تغییر واحد تیم دارای عضو، ابتدا اعضا را منتقل کنید",
            );
          const updated = await db.team.update({
            where: { id: old.id },
            data: await teamData(db, b),
          });
          const members = await db.agent.findMany({
            where: { team_id: old.id },
          });
          for (const a of members) {
            const changes = {
              team_name: updated.name,
              ...(b.lead_id !== undefined
                ? {
                    team_lead_id: updated.lead_id,
                    team_lead: updated.lead_name,
                  }
                : {}),
            };
            await db.agent.update({ where: { id: a.id }, data: changes });
            await auditFields(
              db,
              req.user!,
              "agent",
              a.id,
              "team_update",
              a,
              changes,
            );
          }
          return updated;
        },
      );
      res.json({ success: true, data });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.delete(
  "/api/teams/:id",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      await auditedMutation(
        req.user!,
        "team",
        req.params.id,
        "delete",
        async (db) => {
          if (
            (await db.agent.count({ where: { team_id: req.params.id } })) ||
            (await db.assessment.count({ where: { team_id: req.params.id } }))
          )
            throw new ApiError(409, "تیم دارای عضو یا تاریخچه قابل حذف نیست");
          await db.team.delete({ where: { id: req.params.id } });
          return null;
        },
      );
      res.json({ success: true });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

// ==========================================
// 5. AGENTS API (All Source Tab with RBAC Filtering)
// ==========================================
app.get("/api/agents", authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { team, department, source_id, active } = req.query;
    const baseWhere: any = {};

    if (active !== undefined) {
      baseWhere.active = active === "true";
    }
    if (source_id && typeof source_id === "string") {
      baseWhere.source_id = source_id;
    }

    // Role-based data scoping via immutable relations
    const where = getAgentScope(user, baseWhere);

    if (team && typeof team === "string" && team !== "all") {
      where.team_name = team;
    }
    if (department && typeof department === "string") {
      if (
        user.role === "manager" &&
        user.department &&
        user.department !== department
      ) {
        where.id = "__NONE__";
      } else if (user.role === "manager" && !user.department) {
        where.id = "__NONE__";
      } else if (user.role === "admin" || user.role === "qa_supervisor") {
        where.department = department;
      }
    }

    const agents = await prisma.agent.findMany({
      where,
      include: {
        team_lead_user: true,
        controller_user: true,
      },
      orderBy: { name: "asc" },
    });

    const mapped = agents.map((ag) => ({
      ...ag,
      team: ag.team_name,
    }));

    res.json({ success: true, count: mapped.length, data: mapped });
  } catch (err: any) {
    apiFailure(res, err);
  }
});

const agentInput = z
  .object({
    source_id: z.string().trim().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    team: z.string().min(1).optional(),
    team_id: z.string().optional(),
    department: z.enum(["support", "sales"]).optional(),
    user_id: z.string().nullable().optional(),
    team_lead_id: z.string().nullable().optional(),
    controller_id: z.string().nullable().optional(),
    team_lead: z.string().optional(),
    controller: z.string().optional(),
    operator_panel: z.string().optional(),
    sample_name: z.string().optional(),
    check_process: z.string().optional(),
    min_monthly_reviews: z.number().int().min(1).max(100000).optional(),
    active: z.boolean().optional(),
    avatar: z.string().optional(),
  })
  .strict();
async function agentData(db: any, b: any, old?: any) {
  const team = await db.team.findFirst({
    where: b.team_id
      ? { id: b.team_id }
      : b.team
        ? { name: b.team }
        : { id: old?.team_id || "" },
  });
  if (!team) throw new ApiError(400, "تیم معتبر الزامی است");
  if (!old && b.department && b.department !== team.department)
    throw new ApiError(400, "دپارتمان باید با تیم سازگار باشد");
  const data: any = {
    ...b,
    team_id: team.id,
    team_name: team.name,
    department: team.department,
  };
  delete data.team;
  for (const [idField, nameField, roles] of [
    ["controller_id", "controller", ["qa_controller", "qa_supervisor"]],
    ["team_lead_id", "team_lead", ["team_lead"]],
  ] as any) {
    let id = b[idField] === undefined ? old?.[idField] : b[idField];
    if (
      b[nameField] !== undefined &&
      old &&
      b[nameField] !== old[nameField] &&
      id === old[idField]
    )
      id = null;
    if (!id && b[nameField]) {
      const matches = await db.user.findMany({
        where: {
          active: true,
          role: { in: roles },
          OR: [
            { username: b[nameField].toLowerCase() },
            { name: b[nameField] },
          ],
        },
      });
      if (matches.length !== 1)
        throw new ApiError(400, "تخصیص کاربر نامشخص است");
      id = matches[0].id;
    }
    if (id) {
      const u = await db.user.findUnique({ where: { id } });
      if (!u?.active || !roles.includes(u.role))
        throw new ApiError(400, "نقش کاربر تخصیص‌یافته معتبر نیست");
      data[idField] = u.id;
      data[nameField] = nameField === "controller" ? u.username : u.name;
    } else {
      data[idField] = null;
      data[nameField] = "";
    }
  }
  if (data.user_id) {
    const u = await db.user.findUnique({ where: { id: data.user_id } });
    if (!u || u.role !== "agent")
      throw new ApiError(400, "حساب کارشناس معتبر نیست");
  }
  return data;
}
app.post(
  "/api/agents",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const b = agentInput.parse(req.body);
      if (!b.name || !b.source_id)
        throw new ApiError(400, "نام و کد سورس الزامی است");
      const data = await auditedMutation(
        req.user!,
        "agent",
        undefined,
        "create",
        async (db) => db.agent.create({ data: await agentData(db, b) }),
      );
      res
        .status(201)
        .json({ success: true, data: { ...data, team: data.team_name } });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.put(
  "/api/agents/:id",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const b = agentInput.parse(req.body);
      const data = await auditedMutation(
        req.user!,
        "agent",
        req.params.id,
        "update",
        async (db) => {
          const old = await db.agent.findUnique({
            where: { id: req.params.id },
          });
          if (!old) throw new ApiError(404, "کارشناس یافت نشد");
          return db.agent.update({
            where: { id: old.id },
            data: await agentData(db, b, old),
          });
        },
      );
      res.json({ success: true, data: { ...data, team: data.team_name } });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.delete(
  "/api/agents/:id",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const data = await auditedMutation(
        req.user!,
        "agent",
        req.params.id,
        "deactivate",
        (db) =>
          db.agent.update({
            where: { id: req.params.id },
            data: { active: false },
          }),
      );
      res.json({ success: true, deactivated: true, data });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

app.post(
  "/api/agents/import-csv",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const input = z
        .object({
          csvText: z.string().min(1).max(10_000_000),
          dryRun: z.boolean().default(true),
        })
        .strict()
        .parse(req.body);
      const records: any[] = parseCsv(input.csvText, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      if (!records.length || records.length > 5000)
        throw new ApiError(400, "تعداد ردیف‌ها باید بین ۱ تا ۵۰۰۰ باشد");
      const parsed: any[] = [],
        errors: string[] = [],
        seen = new Set();
      for (const [i, r] of records.entries())
        try {
          const vals = Object.values(r);
          const raw: any = {
            name: r.name || vals[0],
            source_id: r.source_id || vals[1],
            team: r.team || vals[2],
            team_lead: r.team_lead || vals[4],
            controller: r.controller || vals[5],
            operator_panel: r.operator_panel || vals[6] || "Ring",
            sample_name: r.sample_name || vals[7] || "Random Sampling",
            check_process: r.check_process || vals[8] || "if needed",
            min_monthly_reviews: Number(
              toEnglishDigits(r.min_monthly_reviews || String(vals[9] || 40)),
            ),
          };
          const b = agentInput.parse(raw);
          if (!b.name || !b.source_id)
            throw new Error("نام و کد سورس الزامی است");
          if (seen.has(b.source_id)) throw new Error("کد سورس تکراری در فایل");
          seen.add(b.source_id);
          parsed.push(
            await agentData(
              prisma,
              b,
              await prisma.agent.findUnique({
                where: { source_id: b.source_id },
              }),
            ),
          );
        } catch (e: any) {
          errors.push(`ردیف ${i + 2}: ${e.message}`);
        }
      if (input.dryRun)
        return res.json({ success: true, count: parsed.length, errors });
      if (errors.length)
        throw new ApiError(
          400,
          "هیچ ردیفی ذخیره نشد؛ خطاهای فایل را اصلاح کنید",
          { errors, count: 0 },
        );
      await prisma.$transaction(async (db) => {
        for (const b of parsed) {
          const old = await db.agent.findUnique({
            where: { source_id: b.source_id },
          });
          const a = await db.agent.upsert({
            where: { source_id: b.source_id },
            update: b,
            create: b,
          });
          await auditFields(db, req.user!, "agent", a.id, "csv_import", old, a);
        }
      }, txOptions);
      res.json({ success: true, count: parsed.length, errors: [] });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

// Helper to convert DB AssessmentForm criteria into RubricSection[]
function convertFormToRubric(form: any, defaultRubric: any[]) {
  if (!form || !form.criteria || form.criteria.length === 0) {
    return defaultRubric;
  }
  const sectionMap = new Map<string, any>();
  for (const crit of form.criteria) {
    const secId = crit.section || "default";
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
      id: crit.id.replace(/^crit-/, "").replace(/-v\d+$/, ""),
      title: crit.title,
      maxPoints: crit.max_points,
      items: crit.items.map((it: any) => ({
        id: it.id.replace(/^item-/, "").replace(/-v\d+$/, ""),
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
async function getRubricForForm(
  params: {
    formId?: string;
    formType: string;
    formVersion?: number;
  },
  db: any = prisma,
): Promise<{ rubric: any[]; formId: string; formVersion: number }> {
  let form: any = null;

  if (params.formId) {
    form = await db.assessmentForm.findUnique({
      where: { id: params.formId },
      include: {
        criteria: { include: { items: true }, orderBy: { order_index: "asc" } },
      },
    });
  }

  if (params.formId && (!form || form.form_type !== params.formType))
    throw new ApiError(400, "نسخه فرم با نوع ارزیابی سازگار نیست");
  if (
    !form &&
    params.formVersion !== undefined &&
    params.formVersion !== null
  ) {
    form = await db.assessmentForm.findFirst({
      where: {
        form_type: params.formType,
        version: Number(params.formVersion),
      },
      include: {
        criteria: { include: { items: true }, orderBy: { order_index: "asc" } },
      },
    });
  }

  if (!form && (params.formId || params.formVersion))
    throw new ApiError(409, "نسخه تاریخی فرم یافت نشد");
  if (!form) {
    form = await db.assessmentForm.findFirst({
      where: { form_type: params.formType, is_active: true },
      orderBy: { version: "desc" },
      include: {
        criteria: { include: { items: true }, orderBy: { order_index: "asc" } },
      },
    });
  }

  if (!form || !form.criteria.length)
    throw new ApiError(409, "فرم معتبر در دسترس نیست");
  const defaultRubric =
    params.formType === "support" ? SUPPORT_RUBRIC : SALES_RUBRIC;
  const formId =
    form?.id || `form-${params.formType}-v${params.formVersion || 1}`;
  const formVersion = form?.version || params.formVersion || 1;

  const rubric = convertFormToRubric(form, defaultRubric);
  return { rubric, formId, formVersion };
}

// ==========================================
// 6. RUBRIC FORMS & CRITERIA API
// ==========================================
app.get("/api/forms", authenticate, async (_req: Request, res: Response) => {
  try {
    const [supportForm, salesForm] = await Promise.all([
      prisma.assessmentForm.findFirst({
        where: { form_type: "support", is_active: true },
        include: {
          criteria: {
            include: { items: true },
            orderBy: { order_index: "asc" },
          },
        },
      }),
      prisma.assessmentForm.findFirst({
        where: { form_type: "sales", is_active: true },
        include: {
          criteria: {
            include: { items: true },
            orderBy: { order_index: "asc" },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      supportRubric: convertFormToRubric(supportForm, SUPPORT_RUBRIC),
      salesRubric: convertFormToRubric(salesForm, SALES_RUBRIC),
      supportFormId: supportForm?.id || "form-support-v1",
      salesFormId: salesForm?.id || "form-sales-v1",
      supportFormVersion: supportForm?.version || 1,
      salesFormVersion: salesForm?.version || 1,
    });
  } catch (err: any) {
    apiFailure(res, err);
  }
});

// Endpoint to fetch historical rubric for a specific version
app.get(
  "/api/forms/:formType/version/:version",
  authenticate,
  async (req: Request, res: Response) => {
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
      apiFailure(res, err);
    }
  },
);

app.put(
  "/api/forms/:formType",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const formType = z.enum(["support", "sales"]).parse(req.params.formType);
      const { sections } = req.body;
      const validation = validateRubricDefinition(formType, sections);
      if (!validation.isValid)
        throw new ApiError(400, validation.error || "فرم نامعتبر است");
      const result = await prisma.$transaction(async (db) => {
        const latest = await db.assessmentForm.findFirst({
          where: { form_type: formType },
          orderBy: { version: "desc" },
        });
        if (
          req.body.expected_version !== undefined &&
          req.body.expected_version !== (latest?.version || 0)
        )
          throw new ApiError(409, "نسخه فرم تغییر کرده است");
        const version = (latest?.version || 0) + 1;
        await db.assessmentForm.updateMany({
          where: { form_type: formType, is_active: true },
          data: { is_active: false },
        });
        const form = await db.assessmentForm.create({
          data: {
            form_type: formType,
            title: formType === "sales" ? "فرم فروش" : "فرم پشتیبانی",
            version,
          },
        });
        for (const [si, section] of sections.entries())
          for (const [ci, c] of section.criteria.entries()) {
            const criterion = await db.rubricCriteria.create({
              data: {
                id: `crit-${c.id.replace(/^crit-/, "").replace(/-v\d+$/, "")}-v${version}`,
                form_id: form.id,
                section: section.id,
                title: c.title,
                max_points: c.maxPoints,
                order_index: si * 100 + ci,
              },
            });
            for (const [ii, it] of c.items.entries())
              await db.rubricCriteriaItem.create({
                data: {
                  id: `item-${it.id.replace(/^item-/, "").replace(/-v\d+$/, "")}-v${version}`,
                  criteria_id: criterion.id,
                  title: it.title,
                  max_points: it.maxPoints,
                  order_index: ii,
                },
              });
          }
        const canonical = await getRubricForForm(
          { formType, formId: form.id },
          db,
        );
        await auditFields(
          db,
          req.user!,
          "rubric",
          form.id,
          "rubric_updated",
          null,
          { version, sections },
        );
        return { formId: form.id, version, canonicalRubric: canonical.rubric };
      }, txOptions);
      res.json({ success: true, ...result });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

// ==========================================
// 7. FAULTS API
// ==========================================
app.get("/api/faults", authenticate, async (_req: Request, res: Response) => {
  try {
    const faults = await prisma.fault.findMany({
      orderBy: { title: "asc" },
    });
    res.json({ success: true, count: faults.length, data: faults });
  } catch (err: any) {
    apiFailure(res, err);
  }
});

const faultInput = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    department: z.enum(["support", "sales", "both"]).optional(),
    category: z.string().trim().min(1).max(200).optional(),
    is_critical: z.boolean().optional(),
    description: z.string().max(10000).optional(),
  })
  .strict();
app.post(
  "/api/faults",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const b = faultInput.parse(req.body);
      if (!b.title || !b.department || !b.category)
        throw new ApiError(400, "اطلاعات خطا ناقص است");
      const data = await auditedMutation(
        req.user!,
        "fault",
        undefined,
        "create",
        (db) => db.fault.create({ data: b }),
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.put(
  "/api/faults/:id",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const b = faultInput.parse(req.body);
      const data = await auditedMutation(
        req.user!,
        "fault",
        req.params.id,
        "update",
        (db) => db.fault.update({ where: { id: req.params.id }, data: b }),
      );
      res.json({ success: true, data });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.delete(
  "/api/faults/:id",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      await auditedMutation(
        req.user!,
        "fault",
        req.params.id,
        "delete",
        async (db) => {
          if (await db.assessment.count({ where: { fault_id: req.params.id } }))
            throw new ApiError(
              409,
              "خطای استفاده‌شده در تاریخچه قابل حذف نیست",
            );
          await db.fault.delete({ where: { id: req.params.id } });
          return null;
        },
      );
      res.json({ success: true });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

function buildAssessmentFilterWhere(
  user: AuthUser,
  query: Record<string, any>,
) {
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
  if (
    include_deleted !== "true" ||
    !["admin", "qa_supervisor", "qa_controller"].includes(user.role)
  ) {
    baseWhere.deleted_at = null;
  }

  // 1. Role-based scoping per PRD
  const where = getAssessmentScope(user, baseWhere);

  // 2. User-supplied filters within authorized boundary
  if (agent_id && typeof agent_id === "string" && agent_id !== "all") {
    if (user.role === "agent" && user.agent_id && user.agent_id !== agent_id) {
      where.id = "__NONE__";
    } else {
      where.agent_id = agent_id;
    }
  }

  if (form_type && typeof form_type === "string" && form_type !== "all") {
    if (
      user.role === "manager" &&
      user.department &&
      user.department !== form_type
    ) {
      where.id = "__NONE__";
    } else if (user.role === "manager" && !user.department) {
      where.id = "__NONE__";
    } else if (
      user.role === "admin" ||
      user.role === "qa_supervisor" ||
      user.role === "qa_controller" ||
      user.role === "team_lead"
    ) {
      where.form_type = form_type;
    }
  }

  if (result && typeof result === "string" && result !== "all") {
    where.result = result;
  }

  if (
    controller_id &&
    typeof controller_id === "string" &&
    controller_id !== "all"
  ) {
    where.controller_id = controller_id;
  }

  const teamFilter = team_id || team;
  if (teamFilter && typeof teamFilter === "string" && teamFilter !== "all") {
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

  if (query.backend_general === "true") where.backend_general = true;
  if (
    query.deleted_only === "true" &&
    ["admin", "qa_supervisor", "qa_controller"].includes(user.role)
  )
    where.deleted_at = { not: null };
  // Score range
  for (const k of ["min_score", "max_score"])
    if (
      query[k] !== undefined &&
      (!Number.isFinite(Number(query[k])) ||
        Number(query[k]) < 0 ||
        Number(query[k]) > 100)
    )
      throw new ApiError(400, "بازه نمره نامعتبر است");
  const minScoreNum =
    min_score !== undefined && min_score !== ""
      ? parseInt(String(min_score), 10)
      : NaN;
  const maxScoreNum =
    max_score !== undefined && max_score !== ""
      ? parseInt(String(max_score), 10)
      : NaN;
  if (!isNaN(minScoreNum) || !isNaN(maxScoreNum)) {
    where.total_score = {};
    if (!isNaN(minScoreNum)) where.total_score.gte = minScoreNum;
    if (!isNaN(maxScoreNum)) where.total_score.lte = maxScoreNum;
  }

  // Fault filter
  if (fault_id && typeof fault_id === "string" && fault_id !== "all") {
    where.fault_id = fault_id;
  } else if (has_fault === "true") {
    where.fault_id = { not: null };
  } else if (has_fault === "false") {
    where.fault_id = null;
  }

  // Fraud filter
  if (is_fraud === "true") {
    where.is_fraud = true;
  } else if (is_fraud === "false") {
    where.is_fraud = false;
  }

  // Jalali year / month filter
  if (
    year !== undefined ||
    month !== undefined ||
    jalali_year !== undefined ||
    jalali_month !== undefined
  ) {
    const y = Number(toEnglishDigits(String(jalali_year || year))),
      m = Number(toEnglishDigits(String(jalali_month || month)));
    try {
      where.check_date = jalaliMonthRange(y, m);
    } catch {
      throw new ApiError(400, "سال و ماه معتبر الزامی است");
    }
  }

  // Search filter
  if (search && typeof search === "string" && search.trim()) {
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

async function settingsFor(db: any = prisma) {
  const out: any = { ...DEFAULT_SETTINGS };
  for (const row of await db.setting.findMany()) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      out[row.key] = row.value;
    }
  }
  return out;
}
async function auditFields(
  db: any,
  user: AuthUser,
  entity: string,
  id: string,
  action: string,
  before: any,
  after: any,
) {
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  for (const field of keys) {
    if (["request_hash", "idempotency_key", "updated_at"].includes(field))
      continue;
    if (field === "password") {
      if (before?.password !== after?.password)
        await db.auditLog.create({
          data: {
            user_id: user.id,
            user_name: user.name,
            user_role: user.role,
            entity,
            entity_id: id,
            action,
            field: "password_changed",
            old_value: "[redacted]",
            new_value: "[redacted]",
          },
        });
      continue;
    }
    const oldValue = JSON.stringify(before?.[field] ?? null),
      newValue = JSON.stringify(after?.[field] ?? null);
    if (oldValue === newValue) continue;
    await db.auditLog.create({
      data: {
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        entity,
        entity_id: id,
        action,
        field,
        old_value: oldValue,
        new_value: newValue,
      },
    });
  }
}
const assessInclude = {
  agent: { include: { team: true } },
  disputes: { orderBy: { created_at: "desc" as const } },
  scores: true,
  form: {
    include: {
      criteria: {
        include: { items: { orderBy: { order_index: "asc" as const } } },
        orderBy: { order_index: "asc" as const },
      },
    },
  },
};
const txOptions = {
  isolationLevel: "Serializable" as const,
  maxWait: 10000,
  timeout: 30000,
};
function checkRevision(input: any, existing: any) {
  if (input.revision === undefined)
    throw new ApiError(428, "نسخه ارزیابی الزامی است؛ صفحه را تازه کنید");
  if (input.revision !== existing.revision)
    throw new ApiError(
      409,
      "ارزیابی توسط فرد دیگری تغییر کرده است؛ صفحه را تازه کنید",
    );
}
async function scoreData(db: any, body: any, agent: any, existing?: any) {
  const formType = existing?.form_type || agent.department;
  if (body.form_type && body.form_type !== formType)
    throw new ApiError(400, "نوع فرم از تیم کارشناس تعیین می‌شود");
  const form = await getRubricForForm(
    {
      formType,
      formId: existing?.form_id || body.form_id,
      formVersion: existing?.form_version || body.form_version,
    },
    db,
  );
  if (!existing) {
    const active = await db.assessmentForm.findUnique({
      where: { id: form.formId },
    });
    if (!active?.is_active)
      throw new ApiError(
        409,
        "نسخه فرم تغییر کرده است؛ فرم را دوباره باز کنید",
      );
  }
  const inputKey = formType === "support" ? "support_scores" : "sales_scores";
  const otherKey = formType === "support" ? "sales_scores" : "support_scores";
  if (body[otherKey]) throw new ApiError(400, "نمرات فرم دیگری ارسال شده است");
  const oldScores = existing
    ? JSON.parse(existing[formType + "_scores_json"] || "{}")
    : {};
  const scores = { ...oldScores, ...body[inputKey] };
  const validation = validateScores(form.rubric, scores);
  if (!validation.isValid)
    throw new ApiError(400, validation.error || "نمرات نامعتبر است");
  const setting = await settingsFor(db);
  const policy = existing?.scoring_policy_json
    ? JSON.parse(existing.scoring_policy_json)
    : setting.sales_mistake_deductions;
  const faultId =
    body.fault_id !== undefined
      ? body.fault_id || null
      : existing?.fault_id || null;
  let critical = false;
  if (faultId) {
    const fault = await db.fault.findUnique({ where: { id: faultId } });
    if (!fault || !["both", formType].includes(fault.department))
      throw new ApiError(400, "خطای انتخابی معتبر نیست");
    critical =
      existing?.fault_id === faultId && existing.fault_is_critical !== null
        ? existing.fault_is_critical
        : fault.is_critical;
  }
  const merged = { ...existing, ...body };
  const fraud = merged.is_fraud ?? false,
    mistakes = merged.mistake_count ?? 0;
  const total =
    formType === "sales"
      ? calculateSalesTotal(
          scores,
          mistakes,
          fraud,
          critical,
          form.rubric,
          policy,
        ).total
      : calculateSupportTotal(scores, fraud, critical, form.rubric).total;
  if (body.total_score !== undefined && body.total_score !== total)
    throw new ApiError(400, "نمره ارسالی با محاسبه سرور برابر نیست");
  const data: any = {
    form_type: formType,
    form_id: form.formId,
    form_version: form.formVersion,
    total_score: total,
    [formType + "_scores_json"]: JSON.stringify(scores),
    scoring_policy_json: JSON.stringify(policy),
    fault_id: faultId,
    fault_is_critical: critical,
    is_fraud: fraud,
    backend_general: merged.backend_general ?? false,
    mistake_count: formType === "sales" ? mistakes : 0,
  };
  const metadata = [
    "ticket_number",
    "phone_number",
    "project",
    "vendor_id",
    "vendor_title",
    "voice_link",
    "sample_name",
    "discount_or_coupon",
    "description",
    "result",
    "result_comment",
  ];
  for (const key of metadata)
    if (body[key] !== undefined) data[key] = body[key];
  if (body.fault_categories !== undefined)
    data.fault_categories = JSON.stringify(body.fault_categories);
  for (const key of ["check_date", "registration_date", "execution_date"]) {
    if (body[key] !== undefined) {
      if (body[key] === "" && key !== "check_date") {
        data[key] = null;
        continue;
      }
      const d = parseJalaliOrGregorianDate(body[key]);
      if (!d) throw new ApiError(400, "تاریخ نامعتبر: " + key);
      data[key] = key === "check_date" ? d : d.toISOString();
    }
  }
  const combined = { ...existing, ...data };
  for (const key of formType === "support"
    ? ["ticket_number", "vendor_id", "check_date", "result"]
    : [
        "phone_number",
        "project",
        "vendor_id",
        "registration_date",
        "execution_date",
        "check_date",
        "result",
      ]) {
    if (!combined[key] || !String(combined[key]).trim())
      throw new ApiError(400, "فیلد الزامی: " + key);
  }
  if (
    formType === "sales" &&
    ["Promotion", "Campaign"].includes(combined.project) &&
    !combined.discount_or_coupon?.trim()
  )
    throw new ApiError(400, "شناسه تخفیف یا کوپن الزامی است");
  const allowedResults = setting.result_options || [
    "No problem",
    "Need to check",
    "Coaching Required",
    "بررسی شده",
  ];
  if (!allowedResults.includes(combined.result))
    throw new ApiError(400, "نتیجه معتبر نیست");
  return { data, scores, rubric: form.rubric };
}
async function storeScores(db: any, id: string, rubric: any[], scores: any) {
  await db.assessmentScore.deleteMany({ where: { assessment_id: id } });
  const items = getAllRubricItems(rubric);
  await db.assessmentScore.createMany({
    data: items.map((it) => ({
      assessment_id: id,
      item_id: it.id,
      criterion_id: it.criterionId,
      awarded_score: scores[it.id],
      max_score: it.maxPoints,
    })),
  });
}
// ==========================================
// 8. ASSESSMENTS API (Strict RBAC Scoping & Enforcement)
// ==========================================
app.get(
  "/api/assessments",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const where = buildAssessmentFilterWhere(user, req.query);
      const { page, limit, sort_by, sort_dir } = req.query;

      const allowedSortFields = [
        "created_at",
        "check_date",
        "total_score",
        "result",
      ];
      const sortField =
        typeof sort_by === "string" && allowedSortFields.includes(sort_by)
          ? sort_by
          : "created_at";
      const sortDirection = sort_dir === "asc" ? "asc" : "desc";
      const orderBy = { [sortField]: sortDirection };

      const total = await prisma.assessment.count({ where });

      if (true) {
        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(
          100,
          Math.max(1, parseInt(String(limit), 10) || 20),
        );
        const skip = (pageNum - 1) * limitNum;
        const assessments = await prisma.assessment.findMany({
          where,
          include: {
            ...assessInclude,
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
          ...assessInclude,
        },
        orderBy,
        ...(limit ? { take: parseInt(String(limit), 10) } : {}),
      });

      const formatted = assessments.map(formatAssessmentResponse);
      res.json({
        success: true,
        count: formatted.length,
        total,
        data: formatted,
      });
    } catch (err: any) {
      apiFailure(res, err);
    }
  },
);

app.get(
  "/api/assessments/:id",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const assessment = await prisma.assessment.findUnique({
        where: { id },
        include: {
          ...assessInclude,
        },
      });
      if (!assessment) {
        return res
          .status(404)
          .json({ success: false, message: "Assessment not found" });
      }
      if (!canUserAccessAssessment(req.user!, assessment)) {
        return res.status(403).json({
          success: false,
          message:
            "شما دسترسی مجاز به مشاهده این ارزیابی را ندارید (Forbidden)",
        });
      }
      if (
        assessment.deleted_at &&
        !["admin", "qa_supervisor", "qa_controller"].includes(req.user!.role)
      ) {
        return res
          .status(404)
          .json({ success: false, message: "Assessment not found" });
      }
      res.json({ success: true, data: formatAssessmentResponse(assessment) });
    } catch (err: any) {
      apiFailure(res, err);
    }
  },
);

app.get("/api/assessments/:id/history", authenticate, async (req, res) => {
  try {
    const assessment = await prisma.assessment.findFirst({
      where: getAssessmentScope(req.user!, {
        id: req.params.id,
        deleted_at: null,
      }),
    });
    if (!assessment) throw new ApiError(404, "ارزیابی یافت نشد");
    const page = Math.max(1, Number(req.query.page) || 1);
    const where = {
      entity_id: assessment.id,
      entity: { in: ["assessment", "dispute"] },
    };
    const [total, data] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * 50,
        take: 50,
        select: {
          id: true,
          user_name: true,
          action: true,
          field: true,
          old_value: true,
          new_value: true,
          created_at: true,
        },
      }),
    ]);
    res.json({
      success: true,
      total,
      data,
      page,
      total_pages: Math.ceil(total / 50) || 1,
    });
  } catch (e) {
    apiFailure(res, e);
  }
});

app.post(
  "/api/assessments",
  authenticate,
  requireRole(["qa_controller", "qa_supervisor"]),
  async (req, res) => {
    try {
      const body = assessmentInput.parse(req.body),
        user = req.user!;
      const key = req.get("Idempotency-Key");
      if (key && key.length > 128)
        throw new ApiError(400, "کلید تکرار نامعتبر است");
      const requestKey = key ? user.id + ":" + key : null;
      const requestHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(body))
        .digest("hex");
      const out = await prisma.$transaction(async (db) => {
        if (requestKey) {
          const prior = await db.assessment.findFirst({
            where: { idempotency_key: requestKey },
          });
          if (prior) {
            if (prior.request_hash !== requestHash)
              throw new ApiError(
                409,
                "کلید ثبت با درخواست دیگری استفاده شده است",
              );
            return db.assessment.findUnique({
              where: { id: prior.id },
              include: assessInclude,
            });
          }
        }
        const agent = await db.agent.findUnique({
          where: { id: body.agent_id || "" },
          include: { team: true },
        });
        if (!agent?.active) throw new ApiError(404, "کارشناس فعال یافت نشد");
        if (user.role === "qa_controller" && agent.controller_id !== user.id)
          throw new ApiError(403, "کارشناس به شما تخصیص نیافته است");
        if (agent.department !== agent.team.department)
          throw new ApiError(409, "دپارتمان کارشناس و تیم ناسازگار است");
        if (body.ticket_number) {
          const duplicate = await db.assessment.findFirst({
            where: {
              agent_id: agent.id,
              ticket_number: body.ticket_number,
              deleted_at: null,
            },
          });
          if (duplicate && !body.confirm_duplicate)
            throw new ApiError(
              409,
              "این تیکت قبلاً ارزیابی شده است؛ برای نمونه‌برداری دوباره تأیید کنید",
              { code: "DUPLICATE_TICKET" },
            );
        }
        const calc = await scoreData(db, body, agent);
        const data = {
          ...calc.data,
          agent_id: agent.id,
          controller_id: user.id,
          team_id: agent.team_id,
          sample_name: body.sample_name || "Random Sampling",
          idempotency_key: requestKey,
          request_hash: requestHash,
        };
        const record = await db.assessment.create({ data });
        await storeScores(db, record.id, calc.rubric, calc.scores);
        await auditFields(
          db,
          user,
          "assessment",
          record.id,
          "create",
          null,
          data,
        );
        return db.assessment.findUnique({
          where: { id: record.id },
          include: assessInclude,
        });
      }, txOptions);
      res
        .status(201)
        .json({ success: true, data: formatAssessmentResponse(out) });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.put("/api/assessments/:id", authenticate, async (req, res) => {
  try {
    const body = assessmentInput.parse(req.body),
      user = req.user!;
    const out = await prisma.$transaction(async (db) => {
      const existing = await db.assessment.findUnique({
        where: { id: req.params.id },
        include: { agent: true, scores: true },
      });
      if (!existing || existing.deleted_at)
        throw new ApiError(404, "ارزیابی یافت نشد");
      if (!canUserEditAssessment(user, existing))
        throw new ApiError(403, "مجوز ویرایش ندارید");
      checkRevision(body, existing);
      if (body.agent_id && body.agent_id !== existing.agent_id)
        throw new ApiError(400, "کارشناس ارزیابی قابل تغییر نیست");
      if (body.form_id && body.form_id !== existing.form_id)
        throw new ApiError(400, "نسخه ارزیابی قابل تغییر نیست");
      if (body.form_version && body.form_version !== existing.form_version)
        throw new ApiError(400, "نسخه ارزیابی قابل تغییر نیست");
      if (existing.legacy_aggregate)
        throw new ApiError(409, "ارزیابی تجمیعی فاقد جزئیات قابل محاسبه است");
      const calc = await scoreData(db, body, existing.agent, existing);
      const update = await db.assessment.updateMany({
        where: { id: existing.id, revision: existing.revision },
        data: { ...calc.data, revision: { increment: 1 } },
      });
      if (update.count !== 1) throw new ApiError(409, "تعارض ویرایش");
      await storeScores(db, existing.id, calc.rubric, calc.scores);
      await auditFields(
        db,
        user,
        "assessment",
        existing.id,
        "update",
        existing,
        calc.data,
      );
      return db.assessment.findUnique({
        where: { id: existing.id },
        include: assessInclude,
      });
    }, txOptions);
    res.json({ success: true, data: formatAssessmentResponse(out) });
  } catch (e) {
    apiFailure(res, e);
  }
});

// Team Lead Review Endpoint (Team Lead only for own team)

app.post(
  "/api/assessments/:id/review",
  authenticate,
  requireRole(["team_lead", "qa_supervisor"]),
  async (req, res) => {
    try {
      const { note } = z
        .object({ note: z.string().trim().min(1).max(10000) })
        .strict()
        .parse(req.body);
      const data = await prisma.$transaction(async (db) => {
        const a = await db.assessment.findUnique({
          where: { id: req.params.id },
          include: { agent: { include: { team: true } } },
        });
        if (!a || a.deleted_at) throw new ApiError(404, "ارزیابی یافت نشد");
        if (!canUserAccessAssessment(req.user!, a))
          throw new ApiError(403, "تیم مجاز نیست");
        const update = {
          result: "بررسی شده",
          team_lead_reviewed: true,
          team_lead_note: note,
          team_lead_reviewed_at: new Date().toISOString(),
          revision: { increment: 1 },
        };
        await db.assessment.update({ where: { id: a.id }, data: update });
        await auditFields(
          db,
          req.user!,
          "assessment",
          a.id,
          "team_lead_reviewed",
          a,
          update,
        );
        return db.assessment.findUnique({
          where: { id: a.id },
          include: assessInclude,
        });
      }, txOptions);
      res.json({ success: true, data: formatAssessmentResponse(data) });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.delete(
  "/api/assessments/:id",
  authenticate,
  requireRole(["qa_controller", "qa_supervisor"]),
  async (req, res) => {
    try {
      const data = await prisma.$transaction(async (db) => {
        const a = await db.assessment.findUnique({
          where: { id: req.params.id },
        });
        if (!a || a.deleted_at)
          throw new ApiError(404, "ارزیابی فعال یافت نشد");
        if (!canUserDeleteAssessment(req.user!, a))
          throw new ApiError(403, "مجوز حذف ندارید");
        checkRevision(req.body, a);
        const update = { deleted_at: new Date(), revision: { increment: 1 } };
        await db.assessment.update({ where: { id: a.id }, data: update });
        await auditFields(
          db,
          req.user!,
          "assessment",
          a.id,
          "delete",
          a,
          update,
        );
        return db.assessment.findUnique({
          where: { id: a.id },
          include: assessInclude,
        });
      }, txOptions);
      res.json({ success: true, data: formatAssessmentResponse(data) });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.post(
  "/api/assessments/:id/restore",
  authenticate,
  requireRole(["qa_supervisor"]),
  async (req, res) => {
    try {
      const data = await prisma.$transaction(async (db) => {
        const a = await db.assessment.findUnique({
          where: { id: req.params.id },
        });
        if (!a || !a.deleted_at)
          throw new ApiError(404, "ارزیابی حذف‌شده یافت نشد");
        const update = { deleted_at: null, revision: { increment: 1 } };
        await db.assessment.update({ where: { id: a.id }, data: update });
        await auditFields(
          db,
          req.user!,
          "assessment",
          a.id,
          "restore",
          a,
          update,
        );
        return db.assessment.findUnique({
          where: { id: a.id },
          include: assessInclude,
        });
      }, txOptions);
      res.json({ success: true, data: formatAssessmentResponse(data) });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.get("/api/disputes", authenticate, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1),
      limit = 25;
    const scope = getAssessmentScope(req.user!, { deleted_at: null });
    const status =
      req.query.status && req.query.status !== "all"
        ? z
            .enum(["open", "in_review", "accepted", "rejected"])
            .parse(req.query.status)
        : undefined;
    const where: any = { assessment: scope, ...(status ? { status } : {}) };
    const [total, disputes] = await Promise.all([
      prisma.dispute.count({ where }),
      prisma.dispute.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { assessment: { include: assessInclude } },
      }),
    ]);
    const data = disputes.map((d) =>
      formatAssessmentResponse({ ...d.assessment, disputes: [d] }),
    );
    res.json({
      success: true,
      total,
      page,
      total_pages: Math.ceil(total / limit) || 1,
      data,
    });
  } catch (e) {
    apiFailure(res, e);
  }
});

app.post(
  "/api/assessments/:id/dispute",
  authenticate,
  requireRole(["agent"]),
  async (req, res) => {
    try {
      const input = z
        .object({
          criterion_id: z.string().min(1),
          criterion_title: z.string().optional(),
          agent_comment: z.string().trim().min(1).max(10000),
        })
        .strict()
        .parse(req.body);
      const record = await prisma.$transaction(async (db) => {
        const a = await db.assessment.findUnique({
          where: { id: req.params.id },
          include: { agent: true },
        });
        if (!a || a.deleted_at) throw new ApiError(404, "ارزیابی یافت نشد");
        if (a.agent_id !== req.user!.agent_id)
          throw new ApiError(403, "فقط ارزیابی خودتان مجاز است");
        if (a.legacy_aggregate)
          throw new ApiError(409, "این رکورد فاقد جزئیات معیار است");
        const settings = await settingsFor(db),
          age = Date.now() - a.created_at.getTime();
        if (age < 0 || age > Number(settings.dispute_window_days) * 86400000)
          throw new ApiError(400, "مهلت اعتراض پایان یافته است");
        const form = await getRubricForForm(
          {
            formType: a.form_type,
            formId: a.form_id || undefined,
            formVersion: a.form_version || 1,
          },
          db,
        );
        const criteria = form.rubric.flatMap((s) => s.criteria);
        const criterion = criteria.find(
          (c) =>
            c.id === input.criterion_id ||
            c.items.some((i: any) => i.id === input.criterion_id),
        );
        if (!criterion)
          throw new ApiError(400, "معیار متعلق به این نسخه فرم نیست");
        if (
          await db.dispute.findFirst({
            where: {
              assessment_id: a.id,
              status: { in: ["open", "pending", "in_review"] },
            },
          })
        )
          throw new ApiError(409, "یک اعتراض باز برای این ارزیابی وجود دارد");
        const d = await db.dispute.create({
          data: {
            assessment_id: a.id,
            agent_id: a.agent_id,
            agent_name: a.agent.name,
            criterion_id: input.criterion_id,
            criterion_title: criterion.title,
            agent_comment: input.agent_comment,
            status: "open",
            original_score: a.total_score,
          },
        });
        await auditFields(
          db,
          req.user!,
          "dispute",
          a.id,
          "dispute_filed",
          null,
          { dispute_id: d.id, ...input, status: "open" },
        );
        return d;
      }, txOptions);
      res.status(201).json({ success: true, data: record });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.put(
  "/api/disputes/:disputeId/resolve",
  authenticate,
  requireRole(["qa_controller", "qa_supervisor"]),
  async (req, res) => {
    try {
      const input = z
        .object({
          status: z.enum(["in_review", "accepted", "rejected"]),
          controller_comment: z.string().trim().min(1).max(10000),
          item_scores: z.record(z.string(), z.number().int().min(0)).optional(),
          revision: z.number().int().positive(),
          override_reason: z.string().trim().min(1).optional(),
        })
        .strict()
        .parse(req.body);
      const result = await prisma.$transaction(async (db) => {
        const d = await db.dispute.findUnique({
          where: { id: req.params.disputeId },
          include: { assessment: { include: { agent: true } } },
        });
        if (!d || d.assessment.deleted_at)
          throw new ApiError(404, "اعتراض یافت نشد");
        const a = d.assessment,
          user = req.user!;
        if (!canUserEditAssessment(user, a))
          throw new ApiError(403, "فقط کنترلر ثبت‌کننده یا سوپروایزر مجاز است");
        checkRevision(input, a);
        const oldStatus =
          ({ pending: "open", resolved: "accepted" } as any)[d.status] ||
          d.status;
        if (
          ["accepted", "rejected"].includes(oldStatus) &&
          !(user.role === "qa_supervisor" && input.override_reason)
        )
          throw new ApiError(
            409,
            "اعتراض نهایی شده است؛ بازبینی سوپروایزر با دلیل الزامی است",
          );
        const before = { ...a },
          update: any = { revision: { increment: 1 } };
        if (input.status === "accepted") {
          const form = await getRubricForForm(
            {
              formType: a.form_type,
              formId: a.form_id || undefined,
              formVersion: a.form_version || 1,
            },
            db,
          );
          const criterion = form.rubric
            .flatMap((s) => s.criteria)
            .find(
              (c) =>
                c.id === d.criterion_id ||
                c.items.some((i: any) => i.id === d.criterion_id),
            );
          if (
            !criterion ||
            !input.item_scores ||
            !Object.keys(input.item_scores).length
          )
            throw new ApiError(400, "نمرات اصلاحی معیار الزامی است");
          const allowed = new Set(
            criterion.items
              .filter(
                (i: any) =>
                  criterion.id === d.criterion_id || i.id === d.criterion_id,
              )
              .map((i: any) => i.id),
          );
          if (Object.keys(input.item_scores).some((id) => !allowed.has(id)))
            throw new ApiError(
              400,
              "فقط آیتم‌های معیار مورد اعتراض قابل اصلاح است",
            );
          const calc = await scoreData(
            db,
            { [a.form_type + "_scores"]: input.item_scores },
            a.agent,
            a,
          );
          Object.assign(update, calc.data);
          await storeScores(db, a.id, calc.rubric, calc.scores);
        } else if (input.item_scores)
          throw new ApiError(400, "اصلاح نمره فقط همراه پذیرش مجاز است");
        const count = await db.assessment.updateMany({
          where: { id: a.id, revision: a.revision },
          data: update,
        });
        if (count.count !== 1) throw new ApiError(409, "تعارض تصمیم");
        const decision = {
          status: input.status,
          controller_id: user.id,
          controller_comment: input.controller_comment,
          resolved_at: input.status === "in_review" ? null : new Date(),
          revised_score:
            input.status === "accepted" ? update.total_score : null,
        };
        await db.dispute.update({ where: { id: d.id }, data: decision });
        await auditFields(
          db,
          user,
          "assessment",
          a.id,
          "dispute_score_update",
          before,
          update,
        );
        await auditFields(db, user, "dispute", a.id, "dispute_decision", d, {
          ...decision,
          dispute_id: d.id,
          override_reason: input.override_reason,
        });
        return db.assessment.findUnique({
          where: { id: a.id },
          include: assessInclude,
        });
      }, txOptions);
      res.json({ success: true, data: formatAssessmentResponse(result) });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

// ==========================================
// 10. AUDIT LOGS API (Server-Written, Role-Restricted View)
// ==========================================
app.get(
  "/api/audit-logs",
  authenticate,
  requireRole(["qa_controller", "qa_supervisor", "admin"]),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const {
        entity,
        action,
        user_id,
        search,
        page,
        limit,
        sort_by,
        sort_dir,
      } = req.query;
      const where: any = {};

      // QA Controllers see only logs associated with their own assessments or actions
      if (user.role === "qa_controller") {
        const myAssessments = await prisma.assessment.findMany({
          where: {
            OR: [{ controller_id: user.id }],
          },
          select: { id: true },
        });
        const myAssessmentIds = myAssessments.map((a) => a.id);

        where.OR = [
          { user_id: user.id },
          ...(myAssessmentIds.length > 0
            ? [{ entity: "assessment", entity_id: { in: myAssessmentIds } }]
            : []),
          ...(myAssessmentIds.length > 0
            ? [{ entity: "dispute", entity_id: { in: myAssessmentIds } }]
            : []),
        ];
      }
      if (entity && typeof entity === "string" && entity !== "all") {
        where.entity = entity;
      }
      if (action && typeof action === "string" && action !== "all") {
        where.action = action;
      }
      if (user_id && typeof user_id === "string" && user_id !== "all") {
        where.user_id = user_id;
      }

      if (search && typeof search === "string" && search.trim()) {
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

      const allowedSortFields = ["created_at", "action", "entity"];
      const sortField =
        typeof sort_by === "string" && allowedSortFields.includes(sort_by)
          ? sort_by
          : "created_at";
      const sortDirection = sort_dir === "asc" ? "asc" : "desc";
      const orderBy = { [sortField]: sortDirection };

      const total = await prisma.auditLog.count({ where });

      if (true) {
        const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
        const limitNum = Math.min(
          100,
          Math.max(1, parseInt(String(limit), 10) || 50),
        );
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
            new Date(log.created_at).toLocaleDateString("fa-IR") +
            " " +
            new Date(log.created_at).toLocaleTimeString("fa-IR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
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
          new Date(log.created_at).toLocaleDateString("fa-IR") +
          " " +
          new Date(log.created_at).toLocaleTimeString("fa-IR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
      }));

      res.json({
        success: true,
        count: formatted.length,
        total,
        data: formatted,
      });
    } catch (err: any) {
      apiFailure(res, err);
    }
  },
);

// ==========================================
// 11. SETTINGS API (Admin Only for Updates)
// ==========================================
app.get("/api/settings", authenticate, async (_req: Request, res: Response) => {
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
    apiFailure(res, err);
  }
});

app.put(
  "/api/settings",
  authenticate,
  requireRole(["admin", "qa_supervisor"]),
  async (req, res) => {
    try {
      const settings = z
        .object({
          dispute_window_days: z.number().int().min(1).max(90).optional(),
          min_monthly_reviews_default: z.number().int().positive().optional(),
          controller_monthly_target: z.number().int().positive().optional(),
          sales_mistake_deductions: z
            .record(z.string(), z.number().int().min(0).max(30))
            .optional(),
          high_quality_threshold: z.number().min(0).max(100).optional(),
          low_quality_threshold: z.number().min(0).max(100).optional(),
          result_options: z
            .array(z.string().trim().min(1))
            .min(1)
            .max(100)
            .optional(),
          fraud_penalty_single: z.literal(0).optional(),
          fraud_penalty_monthly_1: z.literal(-10).optional(),
          fraud_penalty_monthly_multiple: z.literal(0).optional(),
        })
        .strict()
        .parse(req.body.settings);
      const merged = { ...(await settingsFor()), ...settings };
      if (merged.high_quality_threshold <= merged.low_quality_threshold)
        throw new ApiError(400, "آستانه بالا باید از پایین بیشتر باشد");
      const table = merged.sales_mistake_deductions;
      if (
        Object.keys(table).length !== 6 ||
        [0, 1, 2, 3, 4, 5].some(
          (k) => !Number.isInteger(table[k]) || table[k] < 0 || table[k] > 30,
        ) ||
        table[0] !== 30 ||
        table[5] !== 0
      )
        throw new ApiError(
          400,
          "جدول خطا باید شش مقدار معتبر با شروع ۳۰ و پایان صفر داشته باشد",
        );
      for (let i = 1; i < 6; i++)
        if (table[i] > table[i - 1])
          throw new ApiError(
            400,
            "امتیاز خطا نباید با افزایش اشتباه بیشتر شود",
          );
      await prisma.$transaction(async (db) => {
        for (const [key, value] of Object.entries(settings)) {
          const old = await db.setting.findUnique({ where: { key } });
          await db.setting.upsert({
            where: { key },
            update: { value: JSON.stringify(value) },
            create: { key, value: JSON.stringify(value) },
          });
          await auditFields(
            db,
            req.user!,
            "settings",
            key,
            "settings_updated",
            { value: old?.value },
            { value: JSON.stringify(value) },
          );
        }
      }, txOptions);
      res.json({ success: true, data: merged });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

// ==========================================
// 12. PROBLEMS TRACKER API
// ==========================================

async function problemScope(user: AuthUser) {
  if (["admin", "qa_supervisor"].includes(user.role)) return {};
  if (!["manager", "team_lead"].includes(user.role)) return { id: "__NONE__" };
  const teams = await prisma.team.findMany({
    where:
      user.role === "manager"
        ? user.department
          ? { department: user.department }
          : { id: "__NONE__" }
        : { lead_id: user.id },
  });
  return { team: { in: teams.map((t) => t.name) } };
}
app.get("/api/problems", authenticate, async (req, res) => {
  try {
    if (
      !["team_lead", "manager", "qa_supervisor", "admin"].includes(
        req.user!.role,
      )
    )
      throw new ApiError(403, "مجوز مشکلات عملیاتی ندارید");
    const data = await prisma.problem.findMany({
      where: await problemScope(req.user!),
      orderBy: { created_at: "desc" },
    });
    res.json({ success: true, count: data.length, data });
  } catch (e) {
    apiFailure(res, e);
  }
});
app.post(
  "/api/problems",
  authenticate,
  requireRole(["team_lead", "manager", "qa_supervisor"]),
  async (req, res) => {
    try {
      const b = problemInput.parse(req.body);
      if (!b.title || !b.description || !b.team)
        throw new ApiError(400, "عنوان، شرح و تیم الزامی است");
      const scope: any = await problemScope(req.user!);
      if (scope.team && !scope.team.in.includes(b.team))
        throw new ApiError(403, "تیم مجاز نیست");
      const data = await auditedMutation(
        req.user!,
        "problem",
        undefined,
        "create",
        (db) =>
          db.problem.create({
            data: {
              priority: "Medium",
              issue_date: formatJalaliDate(new Date()),
              category: "General",
              owner: req.user!.name,
              ...b,
            },
          }),
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.put(
  "/api/problems/:id",
  authenticate,
  requireRole(["team_lead", "manager", "qa_supervisor"]),
  async (req, res) => {
    try {
      const b = problemInput.parse(req.body),
        scope: any = await problemScope(req.user!);
      if (b.team && scope.team && !scope.team.in.includes(b.team))
        throw new ApiError(403, "تیم مجاز نیست");
      const data = await auditedMutation(
        req.user!,
        "problem",
        req.params.id,
        "update",
        async (db) => {
          if (
            !(await db.problem.findFirst({
              where: { AND: [{ id: req.params.id }, scope] },
            }))
          )
            throw new ApiError(404, "مشکل یافت نشد");
          return db.problem.update({ where: { id: req.params.id }, data: b });
        },
      );
      res.json({ success: true, data });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);
app.delete(
  "/api/problems/:id",
  authenticate,
  requireRole(["manager", "qa_supervisor"]),
  async (req, res) => {
    try {
      const scope = await problemScope(req.user!);
      await auditedMutation(
        req.user!,
        "problem",
        req.params.id,
        "delete",
        async (db) => {
          if (
            !(await db.problem.findFirst({
              where: { AND: [{ id: req.params.id }, scope] },
            }))
          )
            throw new ApiError(404, "مشکل یافت نشد");
          await db.problem.delete({ where: { id: req.params.id } });
          return null;
        },
      );
      res.json({ success: true });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

// ==========================================
// 13. EXECUTIVE ANALYTICS API (Direct DB Aggregate with Scoping)
// ==========================================
app.get(
  "/api/analytics",
  authenticate,
  requireRole([
    "manager",
    "qa_supervisor",
    "admin",
    "team_lead",
    "qa_controller",
  ]),
  async (req, res) => {
    try {
      if (req.user!.role === "manager" && !req.user!.department)
        throw new ApiError(403, "دپارتمان مشخص نیست");
      res.json({
        success: true,
        data: await monthlyReport(req.user!, req.query),
      });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

// ==========================================
// 14. CSV EXPORT & BACKUP API (UTF-8 BOM)
// ==========================================
app.get(
  "/api/export/assessments.csv",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      // Agents & Admins have NO reports permission under PRD
      if (user.role === "agent") {
        return res.status(403).json({
          success: false,
          message:
            "دسترسی دریافت گزارش و خروجی برای نقش شما مجاز نمی‌باشد (Forbidden)",
        });
      }
      // Managers without department must fail closed
      if (user.role === "manager" && !user.department) {
        return res.status(403).json({
          success: false,
          message:
            "مدیر بدون انتساب به دپارتمان مجاز به دریافت گزارش نمی‌باشد (Forbidden)",
        });
      }

      const where: any = buildAssessmentFilterWhere(user, req.query);

      const assessments = await prisma.assessment.findMany({
        where,
        include: { agent: { include: { team: true } } },
        orderBy: { check_date: "desc" },
      });

      const sanitizeCell = (val: any) => {
        if (val === null || val === undefined) return "";
        let str = String(val);
        if (/^[=+\-@\t\r]/.test(str)) {
          str = "'" + str;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };

      const headers = [
        "شناسه",
        "کارشناس",
        "کد سورس",
        "تیم",
        "واحد",
        "تاریخ بررسی",
        "شناسه وندور",
        "نام وندور",
        "نمره کل",
        "نتیجه",
        "کنترلر",
        "شماره تیکت/تماس",
      ];

      const rows = assessments.map((a) => [
        sanitizeCell(a.id),
        sanitizeCell(a.agent?.name || ""),
        sanitizeCell(a.agent?.source_id || ""),
        sanitizeCell(a.agent?.team_name || ""),
        sanitizeCell(a.form_type === "support" ? "پشتیبانی" : "فروش"),
        sanitizeCell(formatJalaliDate(a.check_date)),
        sanitizeCell(a.vendor_id || ""),
        sanitizeCell(a.vendor_title || ""),
        a.total_score,
        sanitizeCell(a.result),
        sanitizeCell(a.controller_id),
        sanitizeCell(a.ticket_number || a.phone_number || ""),
      ]);

      const csv =
        "\uFEFF" +
        [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=snappfood_assessments.csv",
      );
      res.send(csv);
    } catch (err: any) {
      res.status(500).send("Export error: " + err.message);
    }
  },
);

// Excel (.xlsx) Export for Assessments
app.get(
  "/api/export/assessments.xlsx",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      // Agents & Admins have NO reports permission under PRD
      if (user.role === "agent") {
        return res.status(403).json({
          success: false,
          message:
            "دسترسی دریافت گزارش و خروجی برای نقش شما مجاز نمی‌باشد (Forbidden)",
        });
      }
      // Managers without department must fail closed
      if (user.role === "manager" && !user.department) {
        return res.status(403).json({
          success: false,
          message:
            "مدیر بدون انتساب به دپارتمان مجاز به دریافت گزارش نمی‌باشد (Forbidden)",
        });
      }

      const where: any = buildAssessmentFilterWhere(user, req.query);

      const assessments = await prisma.assessment.findMany({
        where,
        include: { agent: true, disputes: true },
        orderBy: { check_date: "desc" },
      });

      const sanitizeVal = (val: any) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (/^[=+\-@\t\r]/.test(str)) {
          return "'" + str;
        }
        return val;
      };

      const headers = [
        "شناسه ارزیابی",
        "نام کارشناس",
        "کد سورس",
        "تیم",
        "واحد",
        "تاریخ بررسی (شمسی)",
        "تاریخ بررسی (UTC)",
        "شناسه وندور",
        "عنوان وندور",
        "نمره کل",
        "نتیجه",
        "کنترلر",
        "شماره تیکت/تماس",
        "وضعیت خطا/تقلب",
        "وضعیت اعتراض",
      ];

      const data = assessments.map((a) => {
        const j = dateToJalali(a.check_date);
        const disputeStatus = a.disputes?.[0]
          ? a.disputes[0].status === "resolved"
            ? "تایید اعتراض"
            : a.disputes[0].status === "in_review"
              ? "در حال بررسی"
              : a.disputes[0].status === "rejected"
                ? "رد اعتراض"
                : "در انتظار"
          : "ندارد";

        return [
          sanitizeVal(a.id),
          sanitizeVal(a.agent?.name || ""),
          sanitizeVal(a.agent?.source_id || ""),
          sanitizeVal(a.agent?.team_name || ""),
          sanitizeVal(a.form_type === "support" ? "پشتیبانی" : "فروش"),
          sanitizeVal(j.jalaliStr),
          sanitizeVal(a.check_date.toISOString()),
          sanitizeVal(a.vendor_id || ""),
          sanitizeVal(a.vendor_title || ""),
          a.total_score,
          sanitizeVal(a.result),
          sanitizeVal(a.controller_id),
          sanitizeVal(a.ticket_number || a.phone_number || ""),
          sanitizeVal(
            a.is_fraud ? "تقلب (Fraud)" : a.fault_id ? "دارای خطا" : "بدون خطا",
          ),
          sanitizeVal(disputeStatus),
        ];
      });

      const buffer = await writeWorkbook("ارزیابی‌ها", [headers, ...data]);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=snappfood_assessments.xlsx",
      );
      res.send(buffer);
    } catch (err: any) {
      res.status(500).send("Excel export error: " + err.message);
    }
  },
);

// Excel (.xlsx) Export for Monthly Scores

function selectedPeriod(query: any) {
  const now = dateToJalali(new Date());
  const year =
    query.year === undefined
      ? now.year
      : Number(toEnglishDigits(String(query.year)));
  const month =
    query.month === undefined
      ? now.month
      : Number(toEnglishDigits(String(query.month)));
  try {
    return { year, month, range: jalaliMonthRange(year, month) };
  } catch {
    throw new ApiError(400, "سال و ماه معتبر الزامی است");
  }
}
async function monthlyReport(user: AuthUser, query: any) {
  const { year, month, range } = selectedPeriod(query),
    settings = await settingsFor();
  const [agents, assessments, teams, faults] = await Promise.all([
    prisma.agent.findMany({ where: getAgentScope(user, {}) }),
    prisma.assessment.findMany({
      where: buildAssessmentFilterWhere(user, {
        ...query,
        year: String(year),
        month: String(month),
        include_deleted: "false",
      }),
      include: assessInclude,
    }),
    prisma.team.findMany(),
    prisma.fault.findMany(),
  ]);
  const thresholds = {
    high: settings.high_quality_threshold,
    low: settings.low_quality_threshold,
  };
  const previous = jalaliMonthRange(
    month === 1 ? year - 1 : year,
    month === 1 ? 12 : month - 1,
  );
  const before = await prisma.assessment.findMany({
    where: getAssessmentScope(user, { deleted_at: null, check_date: previous }),
  });
  const rows = agents.map((agent) => {
    const list = assessments.filter((a) => a.agent_id === agent.id);
    const score = calculateAgentMonthlyScoreDetailed(
      list,
      agent.department as any,
      thresholds,
    );
    const prior = calculateAgentMonthlyScoreDetailed(
      before.filter((a) => a.agent_id === agent.id),
      agent.department as any,
      thresholds,
    );
    return {
      agent,
      ...score,
      previousScore: prior.finalMonthlyScore,
      delta:
        score.finalMonthlyScore !== null && prior.finalMonthlyScore !== null
          ? Math.round(
              (score.finalMonthlyScore - prior.finalMonthlyScore) * 10,
            ) / 10
          : null,
      target: agent.min_monthly_reviews,
    };
  });
  const criterionMap = new Map<string, any>();
  let unavailable = 0;
  for (const a of assessments) {
    if (a.legacy_aggregate || !a.form) {
      unavailable++;
      continue;
    }
    const rubric = convertFormToRubric(
        a.form,
        a.form_type === "sales" ? SALES_RUBRIC : SUPPORT_RUBRIC,
      ),
      scores = JSON.parse(
        (a.form_type === "sales"
          ? a.sales_scores_json
          : a.support_scores_json) || "{}",
      );
    for (const sec of rubric)
      for (const c of sec.criteria) {
        // Keep each historical version separate: different maxima are not comparable silently.
        const key = a.form_id + ":" + c.id;
        const value = criterionMap.get(key) || {
          id: key,
          title: c.title,
          formVersion: a.form_version,
          lostPoints: 0,
          count: 0,
        };
        let complete = true,
          lost = 0;
        for (const item of c.items) {
          if (scores[item.id] === undefined) {
            complete = false;
            break;
          }
          lost += item.maxPoints - scores[item.id];
        }
        if (complete) {
          value.lostPoints += lost;
          value.count++;
          criterionMap.set(key, value);
        }
      }
  }
  const groups = (field: "team_id" | "department") => {
    const keys = [...new Set(rows.map((r) => r.agent[field]))];
    return keys.map((key) => {
      const group = rows.filter((r) => r.agent[field] === key),
        scored = group.filter((r) => r.finalMonthlyScore !== null);
      return {
        id: key,
        title:
          field === "team_id"
            ? teams.find((t) => t.id === key)?.name || key
            : key,
        agentCount: group.length,
        assessmentCount: group.reduce((n, r) => n + r.assessmentCount, 0),
        score: scored.length
          ? Math.round(
              (scored.reduce((n, r) => n + r.finalMonthlyScore!, 0) /
                scored.length) *
                10,
            ) / 10
          : null,
      };
    });
  };
  const controllers = await prisma.user.findMany({
    where: { role: "qa_controller", active: true },
    select: { id: true, name: true },
  });
  const visibleControllers =
    user.role === "qa_controller"
      ? controllers.filter((c) => c.id === user.id)
      : controllers.filter(
          (c) =>
            assessments.some((a) => a.controller_id === c.id) ||
            ["admin", "qa_supervisor"].includes(user.role),
        );
  return {
    period: {
      year,
      month,
      timeZone: "Asia/Tehran",
      start: range.gte,
      end: range.lt,
    },
    rows,
    teams: groups("team_id"),
    departments: groups("department"),
    assessmentCount: assessments.length,
    backendGeneralCount: assessments.filter((a) => a.backend_general).length,
    fraudCount: assessments.filter((a) => a.is_fraud).length,
    faultDistribution: faults
      .map((f) => ({
        id: f.id,
        title: f.title,
        count: assessments.filter((a) => a.fault_id === f.id).length,
      }))
      .filter((f) => f.count),
    supportCategories: Object.entries(
      assessments
        .filter((a) => a.form_type === "support")
        .flatMap((a) => JSON.parse(a.fault_categories || "[]"))
        .reduce(
          (out: any, c: string) => ({ ...out, [c]: (out[c] || 0) + 1 }),
          {},
        ),
    ).map(([title, count]) => ({ title, count })),
    criteriaLoss: [...criterionMap.values()].sort(
      (a, b) => b.lostPoints - a.lostPoints,
    ),
    detailUnavailableCount: unavailable,
    controllers: visibleControllers.map((c) => ({
      ...c,
      count: assessments.filter((a) => a.controller_id === c.id).length,
      target: settings.controller_monthly_target,
    })),
    semantics: {
      team: "Unweighted mean of non-empty agent final monthly scores",
      threeMonth:
        "Unweighted mean of available final monthly scores; empty months excluded",
    },
  };
}
app.get("/api/monthly-scores", authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: await monthlyReport(req.user!, req.query),
    });
  } catch (e) {
    apiFailure(res, e);
  }
});
app.get(
  "/api/export/monthly-scores.xlsx",
  authenticate,
  requireRole([
    "team_lead",
    "manager",
    "qa_controller",
    "qa_supervisor",
    "admin",
  ]),
  async (req, res) => {
    try {
      if (req.user!.role === "manager" && !req.user!.department)
        throw new ApiError(403, "دپارتمان مدیر مشخص نیست");
      const report = await monthlyReport(req.user!, req.query);
      const rows = report.rows.map((r) => [
        r.agent.source_id,
        r.agent.name,
        r.agent.team_name,
        r.agent.department,
        r.agent.team_lead,
        r.agent.controller,
        r.assessmentCount,
        r.target,
        r.rawAverage ?? "",
        r.fraudCount,
        r.finalMonthlyScore ?? "",
        r.status,
      ]);
      const buffer = await writeWorkbook("نمرات ماهانه", [
        [
          "کد سورس",
          "کارشناس",
          "تیم",
          "واحد",
          "لید",
          "کنترلر",
          "تعداد",
          "هدف",
          "میانگین خام",
          "تقلب",
          "نمره نهایی",
          "وضعیت",
        ],
        ...rows,
      ]);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="monthly-${report.period.year}-${report.period.month}.xlsx"`,
      );
      res.send(buffer);
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

// CSV Assessment Import for Historical Assessments (Dry-Run Preview + Error Report)

app.post(
  "/api/assessments/import",
  authenticate,
  requireRole(["qa_controller", "qa_supervisor"]),
  async (req, res) => {
    try {
      const {
        csvText,
        rows,
        dryRun = true,
      } = z
        .object({
          csvText: z.string().max(10_000_000).optional(),
          rows: z.array(z.record(z.string(), z.any())).max(5000).optional(),
          dryRun: z.boolean().default(true),
        })
        .strict()
        .parse(req.body);
      const records =
        rows ||
        parseCsv(csvText || "", {
          bom: true,
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      if (!records.length || records.length > 5000)
        throw new ApiError(400, "تعداد ردیف‌ها نامعتبر است");
      const errors: any[] = [],
        valid: any[] = [],
        seen = new Set();
      for (const [index, r] of records.entries())
        try {
          const key = String(
            r.agent_id ||
              r.source_id ||
              r["کد سورس کارشناس"] ||
              r["کد سورس"] ||
              "",
          );
          const agent = await prisma.agent.findFirst({
            where: { OR: [{ id: key }, { source_id: key }] },
          });
          if (!agent) throw new Error("شناسه یا کد سورس کارشناس یافت نشد");
          if (
            req.user!.role === "qa_controller" &&
            agent.controller_id !== req.user!.id
          )
            throw new Error("کارشناس به شما تخصیص نیافته است");
          const controllerKey = String(r.controller_id || r.controller || "");
          const controller = await prisma.user.findFirst({
            where: {
              OR: [{ id: controllerKey }, { username: controllerKey }],
              role: { in: ["qa_controller", "qa_supervisor"] },
            },
          });
          if (!controller) throw new Error("کنترلر اصلی الزامی است");
          if (
            req.user!.role === "qa_controller" &&
            controller.id !== req.user!.id
          )
            throw new Error("ثبت به نام کنترلر دیگر مجاز نیست");
          const date = parseJalaliOrGregorianDate(
            r.check_date || r["تاریخ بررسی (شمسی)"] || r["تاریخ بررسی"],
          );
          if (!date) throw new Error("تاریخ نامعتبر است");
          const bool = (v: any) => {
            if (v === undefined || v === "") return false;
            if (v === true || v === "true" || v === "1") return true;
            if (v === false || v === "false" || v === "0") return false;
            throw new Error("پرچم باید true/false باشد");
          };
          const score = Number(
            toEnglishDigits(String(r.total_score ?? r["نمره کل"] ?? "")),
          );
          if (
            !Number.isInteger(score) ||
            score < 0 ||
            score > 100 ||
            String(r.total_score ?? r["نمره کل"] ?? "").trim() === ""
          )
            throw new Error("نمره نامعتبر است");
          if (r.form_type && r.form_type !== agent.department)
            throw new Error("نوع فرم با کارشناس ناسازگار است");
          const fraud = bool(r.is_fraud),
            backend = bool(r.backend_general);
          const base: any = {
            agent_id: agent.id,
            team_id: agent.team_id,
            controller_id: controller.id,
            form_type: agent.department,
            form_id: null,
            form_version: null,
            sample_name: r.sample_name || "Historical Import",
            check_date: date,
            total_score: score,
            is_fraud: fraud,
            backend_general: backend,
            result: r.result || r["نتیجه ارزیابی"] || "No problem",
            vendor_id: String(r.vendor_id || r["شناسه وندور"] || ""),
            vendor_title: r.vendor_title || r["نام مجموعه / وندور"] || "",
            ticket_number:
              r.ticket_number ||
              (agent.department === "support" ? r["شماره تیکت / تماس"] : null),
            phone_number:
              r.phone_number ||
              (agent.department === "sales" ? r["شماره تیکت / تماس"] : null),
            legacy_aggregate: true,
          };
          const scoreKey = agent.department + "_scores";
          let calc: any;
          if (r[scoreKey]) {
            if (!r.form_id && !r.form_version)
              throw new Error("نسخه اصلی فرم برای نمرات جزئی الزامی است");
            const obj =
              typeof r[scoreKey] === "string"
                ? JSON.parse(r[scoreKey])
                : r[scoreKey];
            const {
              team_id,
              legacy_aggregate,
              form_version,
              form_id,
              ...allowed
            } = base;
            const input = assessmentInput.parse({
              ...Object.fromEntries(
                Object.entries(allowed).filter(([, v]) => v !== null),
              ),
              check_date: date.toISOString(),
              form_id: r.form_id,
              form_version: r.form_version ? Number(r.form_version) : undefined,
              registration_date: r.registration_date,
              execution_date: r.execution_date,
              project: r.project,
              discount_or_coupon: r.discount_or_coupon,
              fault_id: r.fault_id || undefined,
              mistake_count: Number(r.mistake_count || 0),
              [scoreKey]: obj,
              form_type: agent.department,
            });
            // Historical form may be inactive, so supply an immutable historical baseline.
            calc = await scoreData(prisma, input, agent, {
              ...base,
              form_id: r.form_id,
              form_version: r.form_version ? Number(r.form_version) : undefined,
              scoring_policy_json: null,
            });
            Object.assign(base, calc.data, { legacy_aggregate: false });
          } else {
            if (r.fault_id) {
              const fault = await prisma.fault.findUnique({
                where: { id: r.fault_id },
              });
              if (!fault) throw new Error("خطا یافت نشد");
              base.fault_id = fault.id;
              base.fault_is_critical = fault.is_critical;
              if (fault.is_critical && score !== 0)
                throw new Error("خطای بحرانی باید نمره صفر داشته باشد");
            }
            if (fraud && score !== 0)
              throw new Error("تقلب باید نمره صفر داشته باشد");
          }
          const fingerprint =
            "imp-" +
            crypto
              .createHash("sha256")
              .update(
                JSON.stringify({
                  agent: agent.id,
                  controller: controller.id,
                  date: date.toISOString(),
                  source: r.source_record_id || null,
                  ticket: base.ticket_number,
                  phone: base.phone_number,
                  body: r,
                }),
              )
              .digest("hex")
              .slice(0, 40);
          if (seen.has(fingerprint)) throw new Error("ردیف تکراری در فایل");
          seen.add(fingerprint);
          valid.push({
            id: fingerprint,
            data: base,
            calc,
            already: !!(await prisma.assessment.findUnique({
              where: { id: fingerprint },
            })),
            agent_name: agent.name,
          });
        } catch (e: any) {
          errors.push({ row: index + 2, field: "row", message: e.message });
        }
      const preview = valid
        .slice(0, 15)
        .map((v) => ({
          ...v.data,
          agent_name: v.agent_name,
          check_date_jalali: formatJalaliDate(v.data.check_date),
          already_imported: v.already,
        }));
      if (dryRun)
        return res.json({
          success: true,
          dryRun: true,
          totalRows: records.length,
          validCount: valid.length,
          errorCount: errors.length,
          errors,
          preview,
        });
      if (errors.length)
        throw new ApiError(400, "هیچ ردیفی ذخیره نشد؛ خطاها را اصلاح کنید", {
          errors,
        });
      let importedCount = 0;
      await prisma.$transaction(async (db) => {
        for (const v of valid) {
          if (await db.assessment.findUnique({ where: { id: v.id } })) continue;
          await db.assessment.create({ data: { id: v.id, ...v.data } });
          if (v.calc) await storeScores(db, v.id, v.calc.rubric, v.calc.scores);
          await auditFields(
            db,
            req.user!,
            "assessment",
            v.id,
            "historical_import",
            null,
            v.data,
          );
          importedCount++;
        }
      }, txOptions);
      res.json({
        success: true,
        dryRun: false,
        importedCount,
        errorCount: 0,
        errors: [],
        skippedCount: valid.length - importedCount,
      });
    } catch (e) {
      apiFailure(res, e);
    }
  },
);

// System Reset Seed (Admin Only)
app.post(
  "/api/system/reset-seed",
  authenticate,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.ALLOW_DEMO_RESET !== "true"
    )
      return res
        .status(403)
        .json({
          success: false,
          message: "بازنشانی فقط در محیط نمایشی صریح مجاز است",
        });
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
          data: {
            id: t.id,
            name: t.name,
            department: t.department,
            lead_name: t.lead_name,
          },
        });
      }

      // Re-seed agents
      for (const ag of SEED_AGENTS) {
        const teamRec = await prisma.team.findFirst({
          where: { name: ag.team },
        });
        await prisma.agent.create({
          data: {
            id: ag.id,
            source_id: ag.source_id,
            name: ag.name,
            department: ag.department,
            team_id: teamRec?.id || "team-technical",
            team_name: ag.team,
            team_lead: ag.team_lead,
            controller: ag.controller,
            operator_panel: ag.operator_panel,
            sample_name: ag.sample_name || "Random Sampling",
            check_process: ag.check_process || "if needed",
            min_monthly_reviews: ag.min_monthly_reviews,
            active: true,
          },
        });
      }

      // Re-seed forms
      const supportForm = await prisma.assessmentForm.create({
        data: {
          id: "form-support-v1",
          form_type: "support",
          title: "روبریک ارزیابی پشتیبانی (Support Rubric)",
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
          id: "form-sales-v1",
          form_type: "sales",
          title: "روبریک ارزیابی فروش (Sales Rubric)",
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
            fault_categories: a.fault_categories
              ? JSON.stringify(a.fault_categories)
              : null,
            support_scores_json: a.support_scores
              ? JSON.stringify(a.support_scores)
              : null,
            sales_scores_json: a.sales_scores
              ? JSON.stringify(a.sales_scores)
              : null,
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
        entity: "settings",
        entity_id: "database",
        action: "update",
        field: "reset_seed",
        new_value: "بازنشانی کامل پایگاه‌داده به داده‌های مرجع PRD",
      });

      res.json({ success: true, message: "پایگاه داده با موفقیت بازنشانی شد" });
    } catch (err: any) {
      apiFailure(res, err);
    }
  },
);

app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "مسیر یافت نشد" });
});
app.use((err: any, _req: Request, res: Response, _next: any) => {
  if (err?.type === "entity.parse.failed")
    return res
      .status(400)
      .json({ success: false, message: "ساختار JSON نامعتبر است" });
  if (err?.type === "entity.too.large")
    return res
      .status(413)
      .json({ success: false, message: "حجم درخواست بیش از حد مجاز است" });
  return apiFailure(res, err);
});

// ==========================================
// 15. DEV VITE MIDDLEWARE & PROD STATIC SERVE
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: PORT },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("⚡ Vite dev server middleware mounted in Express");
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `🚀 SnappFood Commercial QA Server running at http://0.0.0.0:${PORT}`,
    );
    console.log(
      `📡 Real Prisma REST backend active with RBAC & Auth Adapter (${authAdapter.name})`,
    );
  });
  return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export { app, prisma, authAdapter, recordServerAuditLog, startServer };
