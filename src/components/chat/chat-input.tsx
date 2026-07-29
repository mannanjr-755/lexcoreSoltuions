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
    textareaRef.current?.focus();
  }, [attachments, text, onSend, onTypingChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

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

  const uploadFile = useCallback(async (file: File) => {
    setUploadError("");
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("/api/messages/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      const attachment = response.data.attachment as Attachment;
      setAttachments((prev) => [...prev, attachment]);
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Upload failed.")
          : "Upload failed.";
      setUploadError(message);
    } finally {
      setUploadProgress(0);
      setUploading(false);
    }
  }, []);

  const handleImageSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    event.target.value = "";
  }, [uploadFile]);

  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    event.target.value = "";
  }, [uploadFile]);

  return (
    <div className="border-t border-[#E2E8F0] bg-white px-4 py-3">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-[8px] border-l-2 border-[#2563EB] bg-[#EFF6FF] px-3 py-2 text-xs">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[#2563EB]">Replying to {replyTo.senderName}</p>
            <p className="truncate text-[#64748B]">{replyTo.text}</p>
          </div>
          <button onClick={onCancelReply} className="shrink-0 text-[#94A3B8] hover:text-[#0F172A]">✕</button>
        </div>
      )}
      {uploadError ? <p className="mb-2 text-xs text-red-500">{uploadError}</p> : null}
      {uploading ? <p className="mb-2 text-xs text-[#64748B]">Uploading... {uploadProgress}%</p> : null}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <div key={file.id} className="flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs">
              <span>{file.type === "image" ? "🖼️" : "📎"}</span>
              <span className="max-w-[180px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== file.id))}
                className="text-[#94A3B8] hover:text-[#0F172A]"
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
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              title="Attach image"
            >
              <ImageIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
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
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xlsx,.zip,.txt"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
