"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, Smile, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (text: string) => void;
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

export function ChatInput({ onSend, replyTo, onCancelReply }: ChatInputProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

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
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
    textareaRef.current?.focus();
  }, [text, onSend]);

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
                    {EMOJI_LIST.map((e) => (
                      <button
                        key={e}
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
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              title="Attach image"
            >
              <ImageIcon className="size-4" />
            </button>
            <button
              type="button"
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
          disabled={!text.trim()}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[#2563EB] text-white transition-all duration-200 hover:bg-[#1D4ED8] disabled:opacity-40 disabled:hover:bg-[#2563EB]"
        >
          <Send className="size-[18px]" />
        </button>
      </div>
    </div>
  );
}
