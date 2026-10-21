import type { Request, Response, NextFunction } from "express";
import type { AuthAdapter, AuthUser } from "./types.ts";
import type { UserRole } from "../../types/index.ts";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionToken?: string;
    }
  }
}

// In-memory rate limiting map for login attempts: ip -> timestamps[]
const loginAttempts = new Map<string, number[]>();
const MAX_LOGIN_ATTEMPTS = process.env.NODE_ENV === "test" ? 1000 : 15;
const LOGIN_WINDOW_MS = 60 * 1000; // 1 minute

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of loginAttempts) {
    const recent = times.filter((t) => now - t < LOGIN_WINDOW_MS);
    if (recent.length) loginAttempts.set(ip, recent);
    else loginAttempts.delete(ip);
  }
}, LOGIN_WINDOW_MS);
cleanup.unref();

export function loginRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
  const now = Date.now();
  const timestamps = loginAttempts.get(ip) || [];

  // Filter timestamps within current window
  const recent = timestamps.filter((t) => now - t < LOGIN_WINDOW_MS);

  if (recent.length >= MAX_LOGIN_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message:
        "تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً پس از یک دقیقه مجدداً تلاش نمایید (Too Many Requests)",
    });
  }

  recent.push(now);
  loginAttempts.set(ip, recent);
  next();
}

/**
 * Validates Origin / Referer for state-changing requests authenticated via cookies.
 */
export function validateCsrfOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return next();
  }

  const hasCookieAuth = Boolean(
    (req.signedCookies && req.signedCookies.snappfood_session) ||
    (req.cookies && req.cookies.snappfood_session),
  );

  // If request uses cookie authentication, verify Origin / Referer
  if (
    hasCookieAuth ||
    req.path === "/auth/login" ||
    req.path === "/users/login"
  ) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const expected =
      process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    // Browsers supply Origin/Referer; non-browser clients may use Bearer auth instead.
    // Permit headerless requests only in isolated tests, never in production.
    if (!origin && !referer) {
      if (process.env.NODE_ENV === "test") return next();
      return res
        .status(403)
        .json({ success: false, message: "منبع درخواست الزامی است" });
    }
    try {
      const source = new URL(origin || referer!);
      const allowed = new Set([new URL(expected).origin]);
      // Codespaces provides these trusted process variables; never trust a request-supplied forwarded host.
      if (
        process.env.NODE_ENV !== "production" &&
        process.env.CODESPACE_NAME &&
        process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
      ) {
        allowed.add(
          `https://${process.env.CODESPACE_NAME}-${process.env.PORT || "3000"}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`,
        );
      }
      if (!allowed.has(source.origin))
        return res
          .status(403)
          .json({ success: false, message: "منبع درخواست مجاز نیست" });
    } catch {
      return res
        .status(403)
        .json({ success: false, message: "منبع درخواست نامعتبر است" });
    }
  }

  next();
}

export function createAuthMiddleware(authAdapter: AuthAdapter) {
  const extractToken = (req: Request): string | null => {
    // 1. Signed cookie (preferred)
    if (req.signedCookies && req.signedCookies.snappfood_session) {
      return req.signedCookies.snappfood_session;
    }
    // 2. Unsigned cookie fallback
    if (req.cookies && req.cookies.snappfood_session) {
      return req.cookies.snappfood_session;
    }
    // 3. Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7).trim();
    }
    return null;
  };

  /**
   * Require valid authenticated session
   */
  const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const token = extractToken(req);

    if (!token) {
      // In explicitly configured development environment ONLY, support dev role switch
      const devRole = req.headers["x-dev-role"] as UserRole | undefined;
      const isExplicitDevSwitch =
        process.env.NODE_ENV === "development" &&
        process.env.DEV_ROLE_SWITCH === "true";

      if (isExplicitDevSwitch && devRole) {
        req.user = {
          id: `usr-${devRole}`,
          username: devRole,
          name: `کاربر ${devRole}`,
          role: devRole,
          department: devRole === "agent" ? "sales" : undefined,
          team: devRole === "agent" ? "Campaign" : undefined,
          agent_id: devRole === "agent" ? "agent-3718" : null,
          active: true,
        };
        return next();
      }

      return res.status(401).json({
        success: false,
        message:
          "نشست کاربری نامعتبر است. لطفاً ابتدا وارد سامانه شوید (Unauthorized)",
      });
    }

    const user = await authAdapter.validateSession(token).catch(() => null);
    if (!user || !user.active) {
      return res.status(401).json({
        success: false,
        message: "اعتبار نشست منقضی شده یا خروج ثبت شده است (Unauthorized)",
      });
    }

    req.user = user;
    req.sessionToken = token;
    next();
  };

  /**
   * Optional authentication (attaches user if session token present)
   */
  const optionalAuth = async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    const token = extractToken(req);
    if (token) {
      const user = await authAdapter.validateSession(token).catch(() => null);
      if (user && user.active) {
        req.user = user;
        req.sessionToken = token;
      }
    }
    next();
  };

  /**
   * Require one of the specified roles (RBAC)
   */
  const requireRole = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "احراز هویت انجام نشده است (Unauthorized)",
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `دسترسی غیرمجاز برای نقش ${req.user.role} (Forbidden)`,
          requiredRoles: allowedRoles,
        });
      }

      next();
    };
  };

  return {
    authenticate,
    optionalAuth,
    requireRole,
    loginRateLimiter,
    validateCsrfOrigin,
  };
}
