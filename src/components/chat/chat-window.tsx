"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Hash, Search, X, Trash2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Message, TeamMember, Workspace, Attachment } from "./chat-types";
import { ChatBubble } from "./chat-bubble";
import { ChatInput } from "./chat-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ChatWindowProps {
  workspace: Workspace;
  messages: Message[];
  currentUserId: string;
  currentUserEmail: string;
  isAdmin: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onSend: (payload: { text: string; attachments: Attachment[]; replyToId?: string | null }) => void;
  onTypingChange?: (isTyping: boolean) => void;
  typingUsers?: string[];
  onDelete: (id: string) => Promise<void> | void;
  onEdit: (id: string, text: string) => void;
  onClearChat?: () => Promise<void> | void;
  clearChatLoading?: boolean;
  deleteLoading?: boolean;
  onBack?: () => void;
  onUploadError?: (message: string) => void;
  onUploadSuccess?: (name: string) => void;
}

function formatDateSeparator(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function groupByDate(msgs: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  for (const msg of msgs) {
    const dateKey = new Date(msg.createdAt).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.date === dateKey) {
      last.messages.push(msg);
    } else {
      groups.push({ date: dateKey, messages: [msg] });
    }
  }
  return groups;
}

function normalize(email: string) {
  return email.trim().toLowerCase();
}

export function ChatWindow({
  workspace,
  messages,
  currentUserId,
  currentUserEmail,
  isAdmin,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onSend,
  onTypingChange,
  typingUsers = [],
  onDelete,
  onEdit,
  onClearChat,
  clearChatLoading = false,
  deleteLoading = false,
  onBack,
  onUploadError,
  onUploadSuccess
}: ChatWindowProps) {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const prevLenRef = useRef(messages.length);

  const selfEmail = normalize(currentUserEmail);

  const memberByEmail = useMemo(() => {
    const map: Record<string, TeamMember> = {};
    for (const m of workspace.members) map[normalize(m.email)] = m;
    return map;
  }, [workspace.members]);

  const memberById = useMemo(() => {
    const map: Record<string, TeamMember> = {};
    for (const m of workspace.members) map[m.id] = m;
    return map;
  }, [workspace.members]);

  const resolveSender = useCallback(
    (msg: Message): TeamMember => {
      const byEmail = memberByEmail[normalize(msg.senderEmail)];
      if (byEmail) return byEmail;
      const byId = memberById[msg.senderId];
      if (byId) return byId;
      return {
        id: msg.senderId || msg.senderEmail,
        name: msg.senderName || "Unknown",
        email: msg.senderEmail || "",
        role: "",
        color: "#94A3B8",
        isOnline: false
      };
    },
    [memberByEmail, memberById]
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  }, []);

  useEffect(() => {
    const grewAtEnd = messages.length > prevLenRef.current;
    const prepended = messages.length > prevLenRef.current && !stickToBottomRef.current;
    prevLenRef.current = messages.length;

    if (stickToBottomRef.current && grewAtEnd && !prepended) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!hasMore || !onLoadMore || searchQuery.trim()) return;
    const root = scrollRef.current;
    const target = topSentinelRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !loadingMore) {
          onLoadMore();
        }
      },
      { root, rootMargin: "120px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, searchQuery, messages.length]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => {
      const sender = resolveSender(m);
      return (
        m.text.toLowerCase().includes(q) ||
        sender.name.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q) ||
        m.attachments.some((a) => a.name.toLowerCase().includes(q))
      );
    });
  }, [messages, searchQuery, resolveSender]);

  const grouped = groupByDate(filtered);

  const handleReply = useCallback((msg: Message) => {
    setReplyTo(msg);
  }, []);

  const handleSend = useCallback(
    (payload: { text: string; attachments: Attachment[] }) => {
      onSend({
        ...payload,
        replyToId: replyTo?.id ?? null
      });
      setReplyTo(null);
      stickToBottomRef.current = true;
    },
    [onSend, replyTo]
  );

  const handleCopy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  const isOwnMessage = useCallback(
    (msg: Message) => {
      if (selfEmail && normalize(msg.senderEmail) === selfEmail) return true;
      if (currentUserId && msg.senderId === currentUserId) return true;
      return false;
    },
    [currentUserId, selfEmail]
  );

  const onlineCount = workspace.members.filter((m) => m.isOnline).length;

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC]">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 py-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] lg:hidden"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        ) : null}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#2563EB]">
          <Hash className="size-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0F172A]">{workspace.name}</p>
          <p className="text-[11px] text-[#64748B]">
            {workspace.members.length} members · {onlineCount} online
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hidden items-center -space-x-1.5 sm:flex">
            {workspace.members.slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
                style={{ backgroundColor: m.color }}
                title={`${m.name} (${m.isOnline ? "online" : "offline"})`}
              >
                {m.name[0]}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${
                    m.isOnline ? "bg-[#22C55E]" : "bg-[#94A3B8]"
                  }`}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowSearch((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            title="Search messages"
          >
            <Search className="size-4" />
          </button>
          {isAdmin && onClearChat ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-xs font-medium text-[#EF4444] transition hover:bg-[#FEF2F2]"
              title="Clear chat history"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          ) : null}
        </div>
      </div>

      {showSearch ? (
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-white px-4 py-2">
          <Search className="size-4 text-[#94A3B8]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages, files, or members..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
          />
          <button
            type="button"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-[#94A3B8] hover:text-[#0F172A]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4">
        <div ref={topSentinelRef} className="h-1 w-full" />
        {loadingMore ? (
          <div className="mb-3 flex justify-center text-xs text-[#64748B]">
            <Loader2 className="mr-2 size-3.5 animate-spin" /> Loading earlier messages...
          </div>
        ) : null}
        {hasMore && !searchQuery.trim() ? (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={() => onLoadMore?.()}
              disabled={loadingMore}
              className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#2563EB] shadow-sm ring-1 ring-[#E2E8F0] hover:bg-[#EFF6FF] disabled:opacity-50"
            >
              Load earlier messages
            </button>
          </div>
        ) : null}

        {grouped.length === 0 ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-[#0F172A]">
              {searchQuery ? "No messages match your search" : "No messages yet"}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              {searchQuery ? "Try a different search term" : "Send a message to start the conversation"}
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              <div className="sticky top-0 z-10 flex justify-center py-3">
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#64748B] shadow-sm ring-1 ring-[#E2E8F0]">
                  {formatDateSeparator(group.messages[0].createdAt)}
                </span>
              </div>
              <div className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {group.messages.map((msg, idx) => {
                    const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
                    const showHeader =
                      !prevMsg || normalize(prevMsg.senderEmail) !== normalize(msg.senderEmail);
                    const sender = resolveSender(msg);
                    const own = isOwnMessage(msg);

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.01, 0.12) }}
                      >
                        <ChatBubble
                          message={msg}
                          sender={sender}
                          isOwn={own}
                          canEdit={own}
                          canDelete={isAdmin || own}
                          showHeader={showHeader}
                          onDelete={(id) => setPendingDeleteId(id)}
                          onEdit={onEdit}
                          onReply={handleReply}
                          onCopy={handleCopy}
                          onPreviewImage={(url, name) => setLightbox({ url, name })}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))
        )}

        {typingUsers.length > 0 ? (
          <div className="mt-3 text-xs text-[#64748B]">
            {typingUsers.join(", ")} {typingUsers.length > 1 ? "are" : "is"} typing...
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <ChatInput
        onSend={handleSend}
        onTypingChange={onTypingChange}
        replyTo={
          replyTo
            ? {
                text: replyTo.text || (replyTo.attachments[0]?.name ?? "Attachment"),
                senderName: resolveSender(replyTo).name
              }
            : null
        }
        onCancelReply={() => setReplyTo(null)}
        onUploadError={onUploadError}
        onUploadSuccess={onUploadSuccess}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear Chat"
        description="This will permanently delete all messages. This action cannot be undone."
        confirmLabel="Clear Chat"
        loading={clearChatLoading}
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await onClearChat?.();
          setConfirmClear(false);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Delete message"
        description="Are you sure you want to delete this message?"
        confirmLabel="Delete"
        loading={deleteLoading}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          await onDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />

      {lightbox ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.name}
            className="max-h-[90vh] max-w-[95vw] rounded-[12px] object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
