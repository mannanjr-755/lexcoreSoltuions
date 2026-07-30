"use client";

import { useState, useRef, useEffect, useCallback, type ChangeEvent } from "react";
import { Send, Paperclip, Smile, Image as ImageIcon } from "lucide-react";
import api from "@/lib/axios";
import type { Attachment } from "./chat-types";

interface ChatInputProps {
  onSend: (payload: { text: string; attachments: Attachment[] }) => void;
  onTypingChange?: (isTyping: boolean) => void;
  replyTo?: { text: string; senderName: string } | null;
  onCancelReply?: () => void;
}

const EMOJI_LIST = [
  "😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘",
  "😗","😋","😛","😜","🤪","😝","🤗","🤔","😐","😏","🙄","😬","😮","😲","😳",
  "🥺","😢","😭","😤","😡","💪","👍","👎","👊","✊","👏","🙌","🤝","🙏","✌️",
  "👌","❤️","🧡","💛","💚","💙","💜","🖤","💕","✨","🔥","💯","🎉","🥳","🚀",
  "✅","❌","❓","❗","💡","📌","🎯","💻","📱","💼","📁","🔑","⚙️","📊","📈"
];

const MAX_SIZE = 10 * 1024 * 1024;
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const FILE_EXT = new Set([".pdf", ".doc", ".docx", ".xlsx", ".zip", ".txt"]);

function extensionOf(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ChatInput({ onSend, onTypingChange, replyTo, onCancelReply }: ChatInputProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  useEffect(() => {
    if (!showEmoji) return;
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmoji]);

  const handleSend = useCallback(() => {
    if (!text.trim() && attachments.length === 0) return;
    onSend({ text: text.trim(), attachments });
    onTypingChange?.(false);
    setText("");
    setAttachments([]);
    setUploadError("");
    textareaRef.current?.focus();
  }, [attachments, text, onSend, onTypingChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const insertEmoji = useCallback((emoji: string) => {
    setText((p) => p + emoji);
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!onTypingChange) return;
    if (text.trim().length === 0) {
      onTypingChange(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }

    onTypingChange(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingChange(false);
    }, 1400);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [onTypingChange, text]);

  const uploadFile = useCallback(async (file: File, kind: "image" | "file") => {
    setUploadError("");
    const ext = extensionOf(file.name);

    if (file.size > MAX_SIZE) {
      setUploadError("File size exceeds 10MB limit.");
      return;
    }

    if (kind === "image" && !IMAGE_EXT.has(ext) && !file.type.startsWith("image/")) {
      setUploadError("Images must be JPG, JPEG, PNG, or WEBP.");
      return;
    }
    if (kind === "file" && !FILE_EXT.has(ext)) {
      setUploadError("Files must be PDF, DOC, DOCX, XLSX, ZIP, or TXT.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("/api/messages/upload", formData, {
        onUploadProgress: (event) => {
          if (!event.total) {
            setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
            return;
          }
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      const attachment = response.data.attachment as Attachment;
      setAttachments((prev) => [...prev, attachment]);
      setUploadProgress(100);
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error && "response" in error
          ? String(
              (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                "Upload failed."
            )
          : "Upload failed.";
      setUploadError(message);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 400);
    }
  }, []);

  const handleImageSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await uploadFile(file, "image");
      event.target.value = "";
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await uploadFile(file, "file");
      event.target.value = "";
    },
    [uploadFile]
  );

  return (
    <div className="border-t border-[#E2E8F0] bg-white px-4 py-3">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-[8px] border-l-2 border-[#2563EB] bg-[#EFF6FF] px-3 py-2 text-xs">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[#2563EB]">Replying to {replyTo.senderName}</p>
            <p className="truncate text-[#64748B]">{replyTo.text}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 text-[#94A3B8] hover:text-[#0F172A]"
          >
            ✕
          </button>
        </div>
      )}
      {uploadError ? <p className="mb-2 text-xs text-red-500">{uploadError}</p> : null}
      {uploading || uploadProgress > 0 ? (
        <div className="mb-2">
          <div className="mb-1 flex items-center justify-between text-[11px] text-[#64748B]">
            <span>{uploading ? "Uploading..." : "Upload complete"}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]">
            <div
              className="h-full rounded-full bg-[#2563EB] transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : null}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="relative overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC]"
            >
              {file.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt={file.name} className="h-20 w-28 object-cover" />
              ) : (
                <div className="flex max-w-[220px] items-center gap-2 px-3 py-2 text-xs">
                  <span>📎</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#0F172A]">{file.name}</p>
                    <p className="text-[#64748B]">{formatBytes(file.size)}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== file.id))}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white hover:bg-black/80"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full resize-none rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 pr-24 text-sm text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-white"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
            <div className="relative" ref={emojiRef}>
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <Smile className="size-4" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full right-0 z-50 mb-2 h-56 w-72 overflow-y-auto rounded-[12px] border border-[#E2E8F0] bg-white p-3 shadow-lg">
                  <div className="grid grid-cols-8 gap-1">
                    {EMOJI_LIST.map((e, i) => (
                      <button
                        key={`${e}-${i}`}
                        type="button"
                        onClick={() => insertEmoji(e)}
                        className="flex h-7 w-7 items-center justify-center rounded-[6px] text-base hover:bg-[#F1F5F9]"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:opacity-40"
              title="Attach image"
            >
              <ImageIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:opacity-40"
              title="Attach file"
            >
              <Paperclip className="size-4" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={(!text.trim() && attachments.length === 0) || uploading}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[#2563EB] text-white transition-all duration-200 hover:bg-[#1D4ED8] disabled:opacity-40 disabled:hover:bg-[#2563EB]"
        >
          <Send className="size-[18px]" />
        </button>
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xlsx,.zip,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,text/plain"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
