import { Request, Response, NextFunction } from 'express';
import { AuthAdapter, AuthUser } from './types.ts';
import { UserRole } from '../../types/index.ts';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function createAuthMiddleware(authAdapter: AuthAdapter) {
  const extractToken = (req: Request): string | null => {
    // 1. Signed cookie
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
      // In dev mode with dev header, support dev user impersonation if enabled
      const devRole = req.headers['x-dev-role'] as UserRole | undefined;
      const isDevSwitch = process.env.DEV_ROLE_SWITCH === 'true' && process.env.NODE_ENV !== 'test';

      if (isDevSwitch && devRole) {
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
        message: 'اعتبار نشست منقضی شده است. لطفاً مجدداً وارد شوید (Unauthorized)',
      });
    }

    req.user = user;
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
  };
}
