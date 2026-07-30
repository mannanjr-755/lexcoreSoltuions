import { normalizeEmail } from "@/lib/authorized-users";
import type { Message } from "@/components/chat/chat-types";

export type MessageRealtimeEvent =
  | { type: "message.created"; message: Message }
  | { type: "message.updated"; messageId: string; text: string; updatedAt: string }
  | { type: "message.deleted"; messageId: string }
  | { type: "messages.cleared"; workspaceId: string; at: string }
  | { type: "message.status"; messageIds: string[]; status: "sent" | "delivered" | "read" }
  | { type: "typing"; email: string; isTyping: boolean; at: string }
  | { type: "presence"; email: string; isOnline: boolean; onlineEmails: string[] }
  | { type: "presence.snapshot"; onlineEmails: string[] };

type Subscriber = (event: MessageRealtimeEvent) => void;

const subscribers = new Set<Subscriber>();
const typingState = new Map<string, number>();
const onlineState = new Map<string, number>();
const TYPING_TTL_MS = 7000;
const PRESENCE_TTL_MS = 45_000;

export function subscribeMessagesRealtime(subscriber: Subscriber) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

function broadcast(event: MessageRealtimeEvent) {
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

export function publishMessageCreated(message: Message) {
  broadcast({ type: "message.created", message });
}

export function publishMessageUpdated(messageId: string, text: string, updatedAt: string) {
  broadcast({ type: "message.updated", messageId, text, updatedAt });
}

export function publishMessageDeleted(messageId: string) {
  broadcast({ type: "message.deleted", messageId });
}

export function publishMessagesCleared(workspaceId = "lexcore-solutions") {
  broadcast({
    type: "messages.cleared",
    workspaceId,
    at: new Date().toISOString()
  });
}

export function publishMessageStatus(messageIds: string[], status: "sent" | "delivered" | "read") {
  if (messageIds.length === 0) return;
  broadcast({ type: "message.status", messageIds, status });
}

export function publishTyping(email: string, isTyping: boolean) {
  const normalized = normalizeEmail(email);
  if (isTyping) {
    typingState.set(normalized, Date.now() + TYPING_TTL_MS);
  } else {
    typingState.delete(normalized);
  }
  broadcast({ type: "typing", email: normalized, isTyping, at: new Date().toISOString() });
}

export function getTypingUsers(now = Date.now()) {
  for (const [email, expiresAt] of typingState.entries()) {
    if (expiresAt <= now) typingState.delete(email);
  }
  return Array.from(typingState.keys());
}

function prunePresence(now = Date.now()) {
  for (const [email, expiresAt] of onlineState.entries()) {
    if (expiresAt <= now) onlineState.delete(email);
  }
}

export function getOnlineEmails(now = Date.now()) {
  prunePresence(now);
  return Array.from(onlineState.keys());
}

export function setUserOnline(email: string) {
  const normalized = normalizeEmail(email);
  const wasOnline = onlineState.has(normalized);
  onlineState.set(normalized, Date.now() + PRESENCE_TTL_MS);
  const onlineEmails = getOnlineEmails();
  if (!wasOnline) {
    broadcast({ type: "presence", email: normalized, isOnline: true, onlineEmails });
  }
  return onlineEmails;
}

export function heartbeatPresence(email: string) {
  const normalized = normalizeEmail(email);
  onlineState.set(normalized, Date.now() + PRESENCE_TTL_MS);
  return getOnlineEmails();
}

export function setUserOffline(email: string) {
  const normalized = normalizeEmail(email);
  const wasOnline = onlineState.delete(normalized);
  typingState.delete(normalized);
  const onlineEmails = getOnlineEmails();
  if (wasOnline) {
    broadcast({ type: "presence", email: normalized, isOnline: false, onlineEmails });
  }
  return onlineEmails;
}
