"use client";

import { useState, useRef, useEffect } from "react";
import type { Message, TeamMember } from "./chat-types";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  message: Message;
  sender: TeamMember;
  isOwn: boolean;
  canEdit: boolean;
  canDelete: boolean;
  showHeader: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, text: string) => void;
  onReply?: (msg: Message) => void;
  onCopy?: (text: string) => void;
  onPreviewImage?: (url: string, name: string) => void;
}

function formatBytes(size: number) {
  if (!size || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ChatBubble({
  message,
  sender,
  isOwn,
  canEdit,
  canDelete,
  showHeader,
  onDelete,
  onEdit,
  onReply,
  onCopy,
  onPreviewImage
}: ChatBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = sender.name !== "Unknown" ? sender.name : message.senderName || "Unknown";
  const displayEmail = sender.email || message.senderEmail || "";
  const displayColor = sender.color || "#94A3B8";

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const timeStr = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.text) {
      onEdit?.(message.id, editText);
    }
    setEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === "Escape") {
      setEditing(false);
      setEditText(message.text);
    }
  };

  return (
    <div className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      {!isOwn && showHeader && (
        <div
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: displayColor }}
        >
          {(displayName[0] || "?").toUpperCase()}
        </div>
      )}
      {!isOwn && !showHeader && <div className="w-8 shrink-0" />}

      <div className="group relative max-w-[70%]">
        {showHeader && !isOwn && (
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold" style={{ color: displayColor }}>
              {displayName}
            </span>
            {displayEmail ? <span className="text-[10px] text-[#94A3B8]">{displayEmail}</span> : null}
          </div>
        )}

        {message.replyToText && (
          <div
            className={cn(
              "mb-1 rounded-[8px] border-l-2 px-3 py-1.5 text-xs",
              isOwn ? "border-white/40 bg-white/10" : "border-[#94A3B8] bg-[#F8FAFC]"
            )}
          >
            <p className="font-medium text-[#0F172A]">{message.replyToSenderName}</p>
            <p className="truncate text-[#64748B]">{message.replyToText}</p>
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-1.5">
            <input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              autoFocus
              className="w-full rounded-[10px] border border-[#2563EB] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none"
            />
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={handleSaveEdit} className="font-medium text-[#2563EB]">
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditText(message.text);
                }}
                className="text-[#64748B]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "relative rounded-[14px] px-4 py-2.5 text-sm leading-relaxed",
                isOwn
                  ? "rounded-br-[4px] bg-[#2563EB] text-white"
                  : "rounded-bl-[4px] bg-[#F1F5F9] text-[#0F172A]"
              )}
            >
              {message.attachments
                .filter((a) => a.type === "image")
                .map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => onPreviewImage?.(image.url, image.name)}
                    className="mb-2 block w-full overflow-hidden rounded-[8px] text-left"
                  >
                    {/* Local chat uploads are served from /public; next/image is unnecessary here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.name}
                      className="max-h-56 w-full rounded-[8px] object-cover transition hover:opacity-95"
                      loading="lazy"
                    />
                  </button>
                ))}
              {message.attachments
                .filter((a) => a.type === "file")
                .map((file) => (
                  <div
                    key={file.id}
                    className={cn(
                      "mb-2 flex items-center gap-2 rounded-[8px] border px-3 py-2 text-xs",
                      isOwn ? "border-white/20" : "border-[#E2E8F0]"
                    )}
                  >
                    <span className="text-base" aria-hidden>
                      📎
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{file.name}</p>
                      {file.size ? <p className="opacity-70">{formatBytes(file.size)}</p> : null}
                    </div>
                    <a
                      href={file.url}
                      download={file.name}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "rounded px-2 py-1 text-[10px] font-medium",
                        isOwn ? "bg-white/20" : "bg-[#E2E8F0]"
                      )}
                    >
                      Download
                    </a>
                  </div>
                ))}

              {message.text ? <p className="whitespace-pre-wrap break-words">{message.text}</p> : null}

              <div className={cn("mt-1 flex items-center gap-1.5", isOwn ? "justify-end" : "justify-start")}>
                <span className={cn("text-[10px]", isOwn ? "text-white/70" : "text-[#94A3B8]")}>{timeStr}</span>
                {message.isEdited && (
                  <span className={cn("text-[10px]", isOwn ? "text-white/50" : "text-[#94A3B8]")}>edited</span>
                )}
                {isOwn && (
                  <span className={cn("text-[10px]", message.status === "read" ? "text-white/90" : "text-white/60")}>
                    {message.status === "read" || message.status === "delivered" ? "✓✓" : "✓"}
                  </span>
                )}
              </div>
            </div>

            <div className={cn("absolute -top-1 hidden group-hover:flex", isOwn ? "-left-8" : "-right-8")}>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                  aria-label="Message actions"
                >
                  <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="8" cy="3" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="8" cy="13" r="1.5" />
                  </svg>
                </button>
                {menuOpen && (
                  <div
                    className={cn(
                      "absolute z-50 w-36 rounded-[10px] border border-[#E2E8F0] bg-white p-1 shadow-lg",
                      isOwn ? "right-0" : "left-0"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onReply?.(message);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                    >
                      Reply
                    </button>
                    {message.text ? (
                      <button
                        type="button"
                        onClick={() => {
                          onCopy?.(message.text);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                      >
                        Copy
                      </button>
                    ) : null}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(true);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F1F5F9]"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          onDelete?.(message.id);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-[6px] px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
