import { normalizeEmail } from "@/lib/authorized-users";
import type { Message } from "@/components/chat/chat-types";

type MessageRealtimeEvent =
  | { type: "message.created"; message: Message }
  | { type: "message.updated"; messageId: string; text: string; updatedAt: string }
  | { type: "message.deleted"; messageId: string }
  | { type: "typing"; email: string; isTyping: boolean; at: string };

type Subscriber = (event: MessageRealtimeEvent) => void;

const subscribers = new Set<Subscriber>();
const typingState = new Map<string, number>();
const TYPING_TTL_MS = 7000;

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
