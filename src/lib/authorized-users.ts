export type AuthorizedUser = {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  color: string;
  /** Env override key for this user's password (optional). */
  passwordEnvKey: string;
  /** Default password used only when env override is unset (local/dev seed). */
  defaultPassword: string;
};

export const AUTHORIZED_USERS: AuthorizedUser[] = [
  {
    id: "admin",
    name: "Admin",
    email: "admin@lexcore.com",
    roleTitle: "Administrator",
    color: "#2563EB",
    passwordEnvKey: "AUTH_PASSWORD_ADMIN",
    defaultPassword: "Admin@Lexcore1!"
  },
  {
    id: "abdul",
    name: "Abdul",
    email: "abdul@lexcore.com",
    roleTitle: "Software Engineer",
    color: "#7C3AED",
    passwordEnvKey: "AUTH_PASSWORD_ABDUL",
    defaultPassword: "Abdul@Lexcore1!"
  },
  {
    id: "raid",
    name: "Raid",
    email: "raid@lexcore.com",
    roleTitle: "Frontend Developer",
    color: "#059669",
    passwordEnvKey: "AUTH_PASSWORD_RAID",
    defaultPassword: "Raid@Lexcore1!"
  },
  {
    id: "yousuf",
    name: "Yousuf",
    email: "yousuf@lexcore.com",
    roleTitle: "Project Coordinator",
    color: "#D97706",
    passwordEnvKey: "AUTH_PASSWORD_YOUSUF",
    defaultPassword: "Yousuf@Lexcore1!"
  },
  {
    id: "anjasha",
    name: "Anjasha",
    email: "anjasha@lexcore.com",
    roleTitle: "HR Executive",
    color: "#DC2626",
    passwordEnvKey: "AUTH_PASSWORD_ANJASHA",
    defaultPassword: "Anjasha@Lexcore1!"
  }
];

/** Historical shared / seed passwords that must be migrated to per-user defaults. */
export const LEGACY_SHARED_PASSWORDS = ["Lexcore@2026!", "Lexcore@2026", "admin123", "Admin123!"] as const;

export const AUTHORIZED_EMAILS = AUTHORIZED_USERS.map((user) => user.email);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAuthorizedEmail(email: string): boolean {
  return AUTHORIZED_EMAILS.includes(normalizeEmail(email));
}

export function getAuthorizedUserByEmail(email: string): AuthorizedUser | undefined {
  const normalized = normalizeEmail(email);
  return AUTHORIZED_USERS.find((user) => user.email === normalized);
}

export function getAuthorizedUserPassword(user: AuthorizedUser): string {
  const fromEnv = process.env[user.passwordEnvKey]?.trim();
  if (fromEnv && fromEnv.length >= 8) return fromEnv;

  // SUPER_ADMIN_PASSWORD is legacy. Use it only when it is a custom (non-legacy) value
  // and AUTH_PASSWORD_ADMIN is unset — never let Lexcore@2026! override Admin@Lexcore1!.
  if (user.passwordEnvKey === "AUTH_PASSWORD_ADMIN") {
    const superAdmin = process.env.SUPER_ADMIN_PASSWORD?.trim();
    if (
      superAdmin &&
      superAdmin.length >= 8 &&
      !(LEGACY_SHARED_PASSWORDS as readonly string[]).includes(superAdmin) &&
      superAdmin !== user.defaultPassword
    ) {
      return superAdmin;
    }
  }

  return user.defaultPassword;
}

/** All passwords that may appear in seed/env for this account (for migration checks). */
export function getMigratablePasswordsForUser(user: AuthorizedUser): string[] {
  const configured = getAuthorizedUserPassword(user);
  const passwords = new Set<string>([configured, user.defaultPassword, ...LEGACY_SHARED_PASSWORDS]);
  return [...passwords];
}
