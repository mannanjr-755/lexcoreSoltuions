export type AuthorizedUser = {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  color: string;
};

export const AUTHORIZED_USERS: AuthorizedUser[] = [
  { id: "admin", name: "Admin", email: "admin@lexcore.com", roleTitle: "Administrator", color: "#2563EB" },
  { id: "abdul", name: "Abdul", email: "abdul@lexcore.com", roleTitle: "Software Engineer", color: "#7C3AED" },
  { id: "raid", name: "Raid", email: "raid@lexcore.com", roleTitle: "Frontend Developer", color: "#059669" },
  { id: "yousuf", name: "Yousuf", email: "yousuf@lexcore.com", roleTitle: "Project Coordinator", color: "#D97706" },
  { id: "anjasha", name: "Anjasha", email: "anjasha@lexcore.com", roleTitle: "HR Executive", color: "#DC2626" }
];

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
