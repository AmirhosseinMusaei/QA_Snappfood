import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import type { AuthAdapter, AuthCredentials, AuthUser } from './types.ts';
import type { UserRole, DepartmentType } from '../../types/index.ts';

export const KNOWN_DEFAULT_SESSION_SECRET = 'snappfood-qa-secure-auth-secret-key-2024';
export const KNOWN_DEFAULT_COOKIE_SECRET = 'snappfood-qa-session-cookie-secret-2024';

const generatedRuntimeSecret = crypto.randomBytes(32).toString('hex');

export const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET !== KNOWN_DEFAULT_SESSION_SECRET
    ? process.env.SESSION_SECRET
    : process.env.NODE_ENV === 'production'
    ? generatedRuntimeSecret
    : KNOWN_DEFAULT_SESSION_SECRET;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory revocation registry to ensure destroyed sessions cannot be replayed
const revokedTokens = new Set<string>();

/**
 * Validates security configuration in production
 */
export function validateProductionSecrets(cookieSecret: string) {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.STRICT_SECRET_FAIL === 'true') {
      if (
        !process.env.SESSION_SECRET ||
        process.env.SESSION_SECRET === KNOWN_DEFAULT_SESSION_SECRET ||
        !cookieSecret ||
        cookieSecret === KNOWN_DEFAULT_COOKIE_SECRET
      ) {
        throw new Error(
          'FATAL: Insecure or default SESSION_SECRET / COOKIE_SECRET detected in production environment. Refusing to start.'
        );
      }
    }
  }
}

/**
 * Sign a payload with HMAC SHA256
 */
function signPayload(data: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
}

/**
 * Local Database Auth Adapter (Prisma + bcrypt)
 */
export class LocalDatabaseAuthAdapter implements AuthAdapter {
  name = 'LocalDatabaseAuthAdapter';
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthUser | null> {
    const { username, password } = credentials;
    if (!username || !password) return null;

    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        agent_profile: true,
        managed_teams: true,
      },
    });

    if (!user || !user.active) return null;

    // Verify bcrypt hash
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return null;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as UserRole,
      department: (user.department || user.agent_profile?.department) as DepartmentType | null,
      team: user.team || user.agent_profile?.team_name || null,
      team_id: user.agent_profile?.team_id || user.managed_teams?.[0]?.id || null,
      agent_id: user.agent_profile?.id || null,
      active: user.active,
    };
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        agent_profile: true,
        managed_teams: true,
      },
    });
    if (!user || !user.active) return null;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as UserRole,
      department: (user.department || user.agent_profile?.department) as DepartmentType | null,
      team: user.team || user.agent_profile?.team_name || null,
      team_id: user.agent_profile?.team_id || user.managed_teams?.[0]?.id || null,
      agent_id: user.agent_profile?.id || null,
      active: user.active,
    };
  }

  async createSession(user: AuthUser): Promise<string> {
    const expires = Date.now() + SESSION_TTL_MS;
    const randomNonce = crypto.randomBytes(16).toString('hex');
    const raw = `${user.id}:${expires}:${randomNonce}`;
    const sig = signPayload(raw);
    const token = Buffer.from(`${raw}:${sig}`).toString('base64url');
    return token;
  }

  async validateSession(sessionToken: string): Promise<AuthUser | null> {
    if (!sessionToken) return null;

    // Reject revoked tokens immediately
    if (revokedTokens.has(sessionToken)) {
      return null;
    }

    try {
      const decoded = Buffer.from(sessionToken, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 4) return null;

      const [userId, expiresStr, randomNonce, signature] = parts;
      const raw = `${userId}:${expiresStr}:${randomNonce}`;
      const expectedSig = signPayload(raw);

      if (signature !== expectedSig) {
        return null; // Tampered token
      }

      const expires = Number(expiresStr);
      if (Date.now() > expires) {
        return null; // Expired token
      }

      return await this.getUserById(userId);
    } catch {
      return null;
    }
  }

  async destroySession(sessionToken: string): Promise<void> {
    if (sessionToken) {
      revokedTokens.add(sessionToken);
    }
  }
}

/**
 * Corporate SSO Adapter (Fail-closed placeholder until real IdP integration)
 */
export class CorporateSSOAdapter implements AuthAdapter {
  name = 'CorporateSSOAdapter';
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  async authenticate(_credentials: AuthCredentials): Promise<AuthUser | null> {
    // FAIL CLOSED: Never authenticate a user merely because a username exists and ssoToken is non-empty.
    // Until a real identity provider (SAML / LDAP / OAuth2) is configured and verified, fail closed.
    console.warn('[CorporateSSO] Corporate identity provider is not configured or unavailable.');
    return null;
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { agent_profile: true },
    });
    if (!user || !user.active) return null;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as UserRole,
      department: user.department as DepartmentType | null,
      team: user.team,
      team_id: user.agent_profile?.team_id || null,
      agent_id: user.agent_profile?.id || null,
      active: user.active,
    };
  }

  async createSession(user: AuthUser): Promise<string> {
    const expires = Date.now() + SESSION_TTL_MS;
    const randomNonce = crypto.randomBytes(16).toString('hex');
    const raw = `${user.id}:${expires}:${randomNonce}`;
    const sig = signPayload(raw);
    return Buffer.from(`${raw}:${sig}`).toString('base64url');
  }

  async validateSession(sessionToken: string): Promise<AuthUser | null> {
    if (!sessionToken || revokedTokens.has(sessionToken)) return null;
    try {
      const decoded = Buffer.from(sessionToken, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 4) return null;
      const [userId, expiresStr, randomNonce, signature] = parts;
      const raw = `${userId}:${expiresStr}:${randomNonce}`;
      if (signature !== signPayload(raw)) return null;
      if (Date.now() > Number(expiresStr)) return null;
      return await this.getUserById(userId);
    } catch {
      return null;
    }
  }

  async destroySession(sessionToken: string): Promise<void> {
    if (sessionToken) {
      revokedTokens.add(sessionToken);
    }
  }
}
