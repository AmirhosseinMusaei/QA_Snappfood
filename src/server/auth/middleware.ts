import type { Request, Response, NextFunction } from 'express';
import type { AuthAdapter, AuthUser } from './types.ts';
import type { UserRole } from '../../types/index.ts';

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
const MAX_LOGIN_ATTEMPTS = process.env.NODE_ENV === 'test' ? 1000 : 15;
const LOGIN_WINDOW_MS = 60 * 1000; // 1 minute

export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
  const now = Date.now();
  const timestamps = loginAttempts.get(ip) || [];

  // Filter timestamps within current window
  const recent = timestamps.filter((t) => now - t < LOGIN_WINDOW_MS);

  if (recent.length >= MAX_LOGIN_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً پس از یک دقیقه مجدداً تلاش نمایید (Too Many Requests)',
    });
  }

  recent.push(now);
  loginAttempts.set(ip, recent);
  next();
}

/**
 * Validates Origin / Referer for state-changing requests authenticated via cookies.
 */
export function validateCsrfOrigin(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  const hasCookieAuth = Boolean(
    (req.signedCookies && req.signedCookies.snappfood_session) ||
    (req.cookies && req.cookies.snappfood_session)
  );

  // If request uses cookie authentication, verify Origin / Referer
  if (hasCookieAuth) {
    const origin = req.headers.origin;
    const host = req.headers.host;

    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        // Compare origin host to req.headers.host
        if (originUrl.host !== host) {
          return res.status(403).json({
            success: false,
            message: 'درخواست به دلیل عدم تطابق منبع ارسالی مسدود گردید (CSRF Protection Blocked)',
          });
        }
      } catch {
        return res.status(403).json({
          success: false,
          message: 'فرمت منبع درخواست نامعتبر است (Invalid Origin)',
        });
      }
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
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return null;
  };

  /**
   * Require valid authenticated session
   */
  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);

    if (!token) {
      // In explicitly configured development environment ONLY, support dev role switch
      const devRole = req.headers['x-dev-role'] as UserRole | undefined;
      const isExplicitDevSwitch =
        process.env.NODE_ENV === 'development' && process.env.DEV_ROLE_SWITCH === 'true';

      if (isExplicitDevSwitch && devRole) {
        req.user = {
          id: `usr-${devRole}`,
          username: devRole,
          name: `کاربر ${devRole}`,
          role: devRole,
          department: devRole === 'agent' ? 'sales' : undefined,
          team: devRole === 'agent' ? 'Campaign' : undefined,
          agent_id: devRole === 'agent' ? 'agent-3718' : null,
          active: true,
        };
        return next();
      }

      return res.status(401).json({
        success: false,
        message: 'نشست کاربری نامعتبر است. لطفاً ابتدا وارد سامانه شوید (Unauthorized)',
      });
    }

    const user = await authAdapter.validateSession(token);
    if (!user || !user.active) {
      return res.status(401).json({
        success: false,
        message: 'اعتبار نشست منقضی شده یا خروج ثبت شده است (Unauthorized)',
      });
    }

    req.user = user;
    req.sessionToken = token;
    next();
  };

  /**
   * Optional authentication (attaches user if session token present)
   */
  const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (token) {
      const user = await authAdapter.validateSession(token);
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
          message: 'احراز هویت انجام نشده است (Unauthorized)',
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
