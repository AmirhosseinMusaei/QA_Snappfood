import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import type { AuthAdapter, AuthCredentials, AuthUser } from "./types.ts";
import type { UserRole, DepartmentType } from "../../types/index.ts";

export const KNOWN_DEFAULT_SESSION_SECRET =
  "snappfood-qa-secure-auth-secret-key-2024";
export const KNOWN_DEFAULT_COOKIE_SECRET =
  "snappfood-qa-session-cookie-secret-2024";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export function validateProductionSecrets(cookieSecret: string) {
  if (process.env.NODE_ENV !== "production") return;
  const session = process.env.SESSION_SECRET;
  if (
    !session ||
    session === KNOWN_DEFAULT_SESSION_SECRET ||
    session.length < 32 ||
    !cookieSecret ||
    cookieSecret === KNOWN_DEFAULT_COOKIE_SECRET ||
    cookieSecret.length < 32
  ) {
    throw new Error(
      "Production requires non-default SESSION_SECRET and COOKIE_SECRET (32+ characters).",
    );
  }
  if (!process.env.APP_URL || !process.env.APP_URL.startsWith("https://"))
    throw new Error("Production APP_URL must be an HTTPS origin.");
  if (process.env.DEV_ROLE_SWITCH === "true")
    throw new Error("DEV_ROLE_SWITCH is forbidden in production.");
}
const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * Local Database Auth Adapter (Prisma + bcrypt)
 */
export class LocalDatabaseAuthAdapter implements AuthAdapter {
  name = "LocalDatabaseAuthAdapter";
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
      department: (user.department ||
        user.agent_profile?.department) as DepartmentType | null,
      team: user.team || user.agent_profile?.team_name || null,
      team_id:
        user.agent_profile?.team_id || user.managed_teams?.[0]?.id || null,
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
      department: (user.department ||
        user.agent_profile?.department) as DepartmentType | null,
      team: user.team || user.agent_profile?.team_name || null,
      team_id:
        user.agent_profile?.team_id || user.managed_teams?.[0]?.id || null,
      agent_id: user.agent_profile?.id || null,
      active: user.active,
    };
  }

  async createSession(user: AuthUser): Promise<string> {
    const token = crypto.randomBytes(32).toString("base64url");
    await this.prisma.session.create({
      data: {
        token_hash: hashToken(token),
        user_id: user.id,
        expires_at: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return token;
  }
  async validateSession(token: string): Promise<AuthUser | null> {
    if (!token || token.length > 256) return null;
    const session = await this.prisma.session.findUnique({
      where: { token_hash: hashToken(token) },
    });
    if (!session || session.expires_at.getTime() <= Date.now()) return null;
    return this.getUserById(session.user_id);
  }
  async destroySession(token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { token_hash: hashToken(token) },
    });
  }
}

/**
 * Corporate SSO Adapter (Fail-closed placeholder until real IdP integration)
 */
export class CorporateSSOAdapter extends LocalDatabaseAuthAdapter {
  name = "CorporateSSOAdapter";
  async authenticate(_credentials: AuthCredentials): Promise<AuthUser | null> {
    return null;
  }
}
