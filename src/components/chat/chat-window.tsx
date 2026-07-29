"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Hash, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Message, TeamMember, Workspace } from "./chat-types";
import { ChatBubble } from "./chat-bubble";
import { ChatInput } from "./chat-input";
import { TypingIndicator } from "./typing-indicator";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  workspace: Workspace;
  messages: Message[];
  currentUserId: string;
  onSend: (text: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onBack?: () => void;
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
    const dateKey = new Date(msg.timestamp).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.date === dateKey) {
      last.messages.push(msg);
    } else {
      groups.push({ date: dateKey, messages: [msg] });
    }
  }
  return groups;
}

export function ChatWindow({ workspace, messages, currentUserId, onSend, onDelete, onEdit, onBack }: ChatWindowProps) {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const memberMap = useMemo(() => {
    const map: Record<string, TeamMember> = {};
    for (const m of workspace.members) map[m.id] = m;
    return map;
  }, [workspace.members]);

  const fallbackMember: TeamMember = { id: "unknown", name: "Unknown", email: "", role: "", color: "#94A3B8", isOnline: false };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) =>
      m.text.toLowerCase().includes(q) ||
      (memberMap[m.senderId]?.name ?? "").toLowerCase().includes(q)
    );
  }, [messages, searchQuery, memberMap]);

  const grouped = groupByDate(filtered);

  const handleReply = useCallback((msg: Message) => {
    setReplyTo(msg);
  }, []);

  const handleSend = useCallback((text: string) => {
    setReplyTo(null);
    onSend(text);
  }, [onSend]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const onlineCount = workspace.members.filter((m) => m.isOnline).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 py-3">
        {onBack && (
          <button onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#64748B] hover:bg-[#F1F5F9] lg:hidden">
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        )}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#2563EB]">
          <Hash className="size-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0F172A]">{workspace.name}</p>
          <p className="text-[11px] text-[#64748B]">{workspace.members.length} Members · {onlineCount} Online</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hidden items-center -space-x-1.5 sm:flex">
            {workspace.members.map((m) => (
              <div
                key={m.id}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
                style={{ backgroundColor: m.color }}
                title={`${m.name} (${m.email})`}
              >
                {m.name[0]}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowSearch((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <Search className="size-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <Search className="size-4 text-[#94A3B8]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages or members..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
          />
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(""); }}
            className="flex h-6 w-6 items-center justify-center rounded text-[#94A3B8] hover:text-[#0F172A]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC] px-4 py-4">
        {grouped.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
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
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#64748B] shadow-sm">
                  {formatDateSeparator(group.messages[0].timestamp)}
                </span>
              </div>
              <div className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {group.messages.map((msg, idx) => {
                    const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
                    const showHeader = !prevMsg || prevMsg.senderId !== msg.senderId;
                    const sender = memberMap[msg.senderId] ?? fallbackMember;

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.015 }}
                      >
                        <ChatBubble
                          message={msg}
                          sender={sender}
                          isOwn={msg.senderId === currentUserId}
                          showHeader={showHeader}
                          onDelete={onDelete}
                          onEdit={onEdit}
                          onReply={handleReply}
                          onCopy={handleCopy}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        replyTo={replyTo ? { text: replyTo.text, senderName: memberMap[replyTo.senderId]?.name ?? "Unknown" } : null}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
