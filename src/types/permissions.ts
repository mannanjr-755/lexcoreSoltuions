import type { UserRole } from "@/types/auth";

export type Permission =
  | "dashboard:view"
  | "customers:read"
  | "customers:write"
  | "customers:delete"
  | "projects:read"
  | "projects:write"
  | "employees:read"
  | "employees:write"
  | "accounting:read"
  | "accounting:write"
  | "settings:read"
  | "settings:write"
  | "reports:read"
  | "notifications:read"
  | "backup:manage"
  | "profile:manage";

export const PERMISSIONS: Record<Permission, UserRole[]> = {
  "dashboard:view": ["super_admin", "admin", "manager", "employee", "accountant"],
  "customers:read": ["super_admin", "admin", "manager", "employee"],
  "customers:write": ["super_admin", "admin", "manager"],
  "customers:delete": ["super_admin", "admin"],
  "projects:read": ["super_admin", "admin", "manager", "employee"],
  "projects:write": ["super_admin", "admin", "manager"],
  "employees:read": ["super_admin", "admin", "manager"],
  "employees:write": ["super_admin", "admin"],
  "accounting:read": ["super_admin", "admin", "accountant"],
  "accounting:write": ["super_admin", "admin", "accountant"],
  "settings:read": ["super_admin", "admin"],
  "settings:write": ["super_admin"],
  "reports:read": ["super_admin", "admin", "manager", "accountant"],
  "notifications:read": ["super_admin", "admin", "manager", "employee", "accountant"],
  "backup:manage": ["super_admin"],
  "profile:manage": ["super_admin", "admin", "manager", "employee", "accountant"]
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role);
}
