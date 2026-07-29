"use client";

import { useState, useRef, useEffect } from "react";
import type { Message, TeamMember } from "./chat-types";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  message: Message;
  sender: TeamMember;
  isOwn: boolean;
  showName: boolean;
  onDelete?: (id: string) => void;
  onReply?: (msg: Message) => void;
  onCopy?: (text: string) => void;
}

export function ChatBubble({ message, sender, isOwn, showName, onDelete, onReply, onCopy }: ChatBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  if (message.isDeleted) {
    return (
      <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
        <div className="rounded-[12px] bg-[#F1F5F9] px-4 py-2 text-xs italic text-[#94A3B8]">
          Message deleted
        </div>
      </div>
    );
  }

  const time = new Date(message.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleCopy = () => {
    onCopy?.(message.text);
    setMenuOpen(false);
  };

  return (
    <div className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn && showName && (
        <div
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: sender.color }}
        >
          {sender.name[0]}
        </div>
      )}
      {!isOwn && !showName && <div className="w-8 shrink-0" />}

      <div className={cn("group relative max-w-[70%]")}>
        {showName && !isOwn && (
          <p className="mb-0.5 text-[11px] font-semibold" style={{ color: sender.color }}>
            {sender.name} <span className="font-normal text-[#94A3B8]">{sender.role}</span>
          </p>
        )}

        {message.replyTo && (
          <div
            className={cn(
              "mb-1 rounded-[8px] border-l-2 px-3 py-1.5 text-xs",
              isOwn ? "border-white/40 bg-white/10" : "border-[#94A3B8] bg-[#F8FAFC]"
            )}
          >
            <p className="font-medium text-[#0F172A]">{message.replyTo.senderName}</p>
            <p className="truncate text-[#64748B]">{message.replyTo.text}</p>
          </div>
        )}

        <div
          className={cn(
            "relative rounded-[14px] px-4 py-2.5 text-sm leading-relaxed",
            isOwn
              ? "bg-[#2563EB] text-white rounded-br-[4px]"
              : "bg-[#F1F5F9] text-[#0F172A] rounded-bl-[4px]"
          )}
        >
          {message.media?.type === "image" && (
            <div className="mb-2 overflow-hidden rounded-[8px]">
              <div className="flex aspect-video items-center justify-center bg-[#E2E8F0] text-xs text-[#64748B]">
                [Image: {message.media.name}]
              </div>
            </div>
          )}
          {message.media?.type === "file" && (
            <div className="mb-2 flex items-center gap-2 rounded-[8px] border border-current/20 px-3 py-2 text-xs">
              <span className="text-base">📎</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{message.media.name}</p>
                {message.media.size && (
                  <p className="opacity-70">{(message.media.size / 1024 / 1024).toFixed(1)} MB</p>
                )}
              </div>
            </div>
          )}

          <p className="whitespace-pre-wrap break-words">{message.text}</p>

          <div className={cn("mt-1 flex items-center gap-1.5", isOwn ? "justify-end" : "justify-start")}>
            <span className={cn("text-[10px]", isOwn ? "text-white/70" : "text-[#94A3B8]")}>{timeStr}</span>
            {message.isEdited && (
              <span className={cn("text-[10px]", isOwn ? "text-white/50" : "text-[#94A3B8]")}>edited</span>
            )}
            {isOwn && (
              <span className={cn("text-[10px]", message.status === "read" ? "text-white/90" : "text-white/60")}>
                {message.status === "read" ? "✓✓" : message.status === "delivered" ? "✓✓" : "✓"}
              </span>
            )}
          </div>
        </div>

        <div className={cn("absolute -top-1", isOwn ? "-left-8" : "-right-8", "hidden group-hover:flex")}>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className={cn("absolute z-50 w-36 rounded-[10px] border border-[#E2E8F0] bg-white p-1 shadow-lg", isOwn ? "right-0" : "left-0")}>
                <button
                  onClick={() => { onReply?.(message); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                >
                  ↩ Reply
                </button>
                <button
                  onClick={handleCopy}
                  className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                >
                  📋 Copy
                </button>
                {isOwn && (
                  <button
                    onClick={() => { onDelete?.(message.id); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    🗑 Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
