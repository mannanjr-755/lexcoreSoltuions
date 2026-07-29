import type { TeamMember, Message, Workspace } from "./chat-types";

const now = Date.now();
const ms = (m: number) => m * 60_000;
const h = (hr: number) => hr * 3_600_000;

export const TEAM_MEMBERS: TeamMember[] = [
  { id: "admin", name: "Admin", email: "admin@lexcore.com", role: "Administrator", color: "#2563EB", isOnline: true },
  { id: "abdul", name: "Abdul", email: "abdul@lexcore.com", role: "Software Engineer", color: "#7C3AED", isOnline: true },
  { id: "raid", name: "Raid", email: "raid@lexcore.com", role: "Frontend Developer", color: "#059669", isOnline: true },
  { id: "yousuf", name: "Yousuf", email: "yousuf@lexcore.com", role: "Project Coordinator", color: "#D97706", isOnline: false },
  { id: "anjasha", name: "Anjasha", email: "anjasha@lexcore.com", role: "HR Executive", color: "#DC2626", isOnline: true },
];

export const WORKSPACE: Workspace = {
  id: "lexcore-team",
  name: "Lexcore Solutions",
  members: TEAM_MEMBERS,
};

export function getMemberByEmail(email: string): TeamMember | undefined {
  return TEAM_MEMBERS.find((m) => m.email === email.toLowerCase());
}

export function getMemberById(id: string): TeamMember | undefined {
  return TEAM_MEMBERS.find((m) => m.id === id);
}

export const SEED_MESSAGES: Message[] = [
  {
    id: "m1",
    senderId: "admin",
    text: "Hello Team \u{1F44B}",
    timestamp: new Date(now - h(4) - ms(50)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m2",
    senderId: "abdul",
    text: "Customer module has been updated.",
    timestamp: new Date(now - h(4) - ms(45)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m3",
    senderId: "raid",
    text: "Invoice system is completed.",
    timestamp: new Date(now - h(4) - ms(40)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m4",
    senderId: "yousuf",
    text: "Testing has started.",
    timestamp: new Date(now - h(4) - ms(35)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m5",
    senderId: "anjasha",
    text: "UI improvements are finished.",
    timestamp: new Date(now - h(4) - ms(30)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m6",
    senderId: "admin",
    text: "Great progress everyone! Let's aim for staging deploy by end of day.",
    timestamp: new Date(now - h(3) - ms(20)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m7",
    senderId: "abdul",
    text: "API endpoints are stable. All tests passing. \u{1F680}",
    timestamp: new Date(now - h(3) - ms(10)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m8",
    senderId: "raid",
    text: "Dashboard components refactored. Performance is much better now.",
    timestamp: new Date(now - h(2) - ms(50)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m9",
    senderId: "yousuf",
    text: "Client demo scheduled for tomorrow at 2 PM. Please have everything ready. \u{1F4C5}",
    timestamp: new Date(now - h(2) - ms(30)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m10",
    senderId: "anjasha",
    text: "New team member onboarding documents have been prepared.",
    timestamp: new Date(now - h(2)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m11",
    senderId: "admin",
    text: "Perfect. Let's do a standup in 15 minutes to sync up.",
    timestamp: new Date(now - h(1) - ms(30)).toISOString(),
    status: "read",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m12",
    senderId: "abdul",
    text: "Sounds good, I'll prepare the sprint summary.",
    timestamp: new Date(now - h(1) - ms(20)).toISOString(),
    status: "delivered",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m13",
    senderId: "raid",
    text: "I'll share the updated component library docs.",
    timestamp: new Date(now - ms(45)).toISOString(),
    status: "delivered",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m14",
    senderId: "yousuf",
    text: "QA report is almost done. Two minor issues left to verify.",
    timestamp: new Date(now - ms(30)).toISOString(),
    status: "sent",
    isEdited: false,
    isDeleted: false,
  },
  {
    id: "m15",
    senderId: "anjasha",
    text: "All good from HR side. \u{2705}",
    timestamp: new Date(now - ms(15)).toISOString(),
    status: "sent",
    isEdited: false,
    isDeleted: false,
  },
];
