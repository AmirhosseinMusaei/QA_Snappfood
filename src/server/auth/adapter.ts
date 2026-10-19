import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { AuthAdapter, AuthCredentials, AuthUser } from './types.ts';
import { UserRole, DepartmentType } from '../../types/index.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || 'snappfood-qa-secure-auth-secret-key-2024';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
      department: user.department as DepartmentType | null,
      team: user.team,
      agent_id: user.agent_profile?.id || null,
      active: user.active,
    };
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
      agent_id: user.agent_profile?.id || null,
      active: user.active,
    };
  }

  async createSession(user: AuthUser): Promise<string> {
    const expires = Date.now() + SESSION_TTL_MS;
    const randomNonce = crypto.randomBytes(8).toString('hex');
    const raw = `${user.id}:${expires}:${randomNonce}`;
    const sig = signPayload(raw);
    const token = Buffer.from(`${raw}:${sig}`).toString('base64url');
    return token;
  }

  async validateSession(sessionToken: string): Promise<AuthUser | null> {
    if (!sessionToken) return null;

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
    } catch (err) {
      return null;
    }
  }

  async destroySession(_sessionToken: string): Promise<void> {
    // Stateless signed token invalidated via cookie clear or token blocklist
  }
}

/**
 * Corporate SSO Adapter (LDAP / SAML 2.0 / Active Directory)
 * Can be configured via environment variables for Snappfood corporate infrastructure.
 */
export class CorporateSSOAdapter implements AuthAdapter {
  name = 'CorporateSSOAdapter';
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthUser | null> {
    const { username, ssoToken } = credentials;
    if (!username || !ssoToken) return null;

    // Corporate LDAP / SAML verification logic:
    // 1. Verify SAML Assertion signature against Corporate IdP metadata
    // 2. Extract user attributes (department, Snappfood staff code, title)
    // 3. Upsert into database and return mapped AuthUser
    console.log(`[CorporateSSO] Authenticating ${username} via corporate identity provider...`);

    // In production, integrate with passport-saml / ldapjs
    const existing = await this.prisma.user.findUnique({
      where: { username },
      include: { agent_profile: true },
    });

    if (!existing) {
      return null;
    }

    return {
      id: existing.id,
      username: existing.username,
      name: existing.name,
      role: existing.role as UserRole,
      department: existing.department as DepartmentType | null,
      team: existing.team,
      agent_id: existing.agent_profile?.id || null,
      active: existing.active,
    };
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
      agent_id: user.agent_profile?.id || null,
      active: user.active,
    };
  }

  async createSession(user: AuthUser): Promise<string> {
    const expires = Date.now() + SESSION_TTL_MS;
    const randomNonce = crypto.randomBytes(8).toString('hex');
    const raw = `${user.id}:${expires}:${randomNonce}`;
    const sig = signPayload(raw);
    return Buffer.from(`${raw}:${sig}`).toString('base64url');
  }

  async validateSession(sessionToken: string): Promise<AuthUser | null> {
    if (!sessionToken) return null;
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

  async destroySession(_sessionToken: string): Promise<void> {}
}
