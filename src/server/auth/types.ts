import type { UserRole, DepartmentType } from '../../types/index.ts';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  department?: DepartmentType | null;
  team?: string | null;
  team_id?: string | null;
  agent_id?: string | null;
  active: boolean;
}

export interface AuthCredentials {
  username: string;
  password?: string;
  ssoToken?: string;
  provider?: 'local' | 'ldap' | 'saml' | 'oauth2';
}

export interface AuthAdapter {
  name: string;
  authenticate(credentials: AuthCredentials): Promise<AuthUser | null>;
  getUserById(id: string): Promise<AuthUser | null>;
  createSession(user: AuthUser): Promise<string>;
  validateSession(sessionToken: string): Promise<AuthUser | null>;
  destroySession(sessionToken: string): Promise<void>;
}
