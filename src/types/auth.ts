export const ROLES = ["super_admin", "admin", "manager", "employee", "accountant", "customer"] as const;
export type UserRole = (typeof ROLES)[number];

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  profilePhoto?: string;
}

export const LOGIN_LOCK_THRESHOLD = 5;
export const LOGIN_LOCK_DURATION_MS = 30 * 60 * 1000;
