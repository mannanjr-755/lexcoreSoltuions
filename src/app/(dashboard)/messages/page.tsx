"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Hash } from "lucide-react";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatWindow } from "@/components/chat/chat-window";
import { workspace, teamMessages, teamMembers, currentUserId } from "@/components/chat/mock-data";
import type { Message } from "@/components/chat/chat-types";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const [chatOpen, setChatOpen] = useState(true);
  const [msgs, setMsgs] = useState<Message[]>(teamMessages);
  const [showMobileList, setShowMobileList] = useState(true);

  const handleSelect = useCallback(() => {
    setChatOpen(true);
    setShowMobileList(false);
  }, []);

  const handleSend = useCallback((text: string) => {
    const msg: Message = {
      id: `msg-${Date.now()}`,
      senderId: currentUserId,
      text,
      timestamp: new Date().toISOString(),
      status: "sent",
      isEdited: false,
      isDeleted: false,
    };
    setMsgs((prev) => [...prev, msg]);
  }, []);

  const handleDelete = useCallback((msgId: string) => {
    setMsgs((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isDeleted: true } : m))
    );
  }, []);

  const handleBack = useCallback(() => {
    setShowMobileList(true);
  }, []);

  return (
    <div className="flex h-[calc(100vh-7.5rem)] animate-fade-in overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm">
      {/* Left — Workspace sidebar */}
      <div
        className={cn(
          "w-full shrink-0 border-r border-[#E2E8F0] bg-white sm:w-72",
          showMobileList ? "block" : "hidden",
          "lg:block"
        )}
      >
        <ConversationList
          workspace={workspace}
          selected={chatOpen}
          onSelect={handleSelect}
        />
      </div>

      {/* Chat area */}
      <div
        className={cn(
          "flex flex-1 flex-col",
          !showMobileList ? "flex" : "hidden",
          "lg:flex"
        )}
      >
        {chatOpen ? (
          <ChatWindow
            workspace={workspace}
            messages={msgs}
            currentUserId={currentUserId}
            members={teamMembers}
            onSend={handleSend}
            onDelete={handleDelete}
            onBack={handleBack}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF6FF]">
              <Hash className="size-8 text-[#2563EB]" />
            </div>
            <p className="mt-4 text-base font-semibold text-[#0F172A]">Lexcore Solutions</p>
            <p className="mt-1 text-sm text-[#64748B]">Select the workspace to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
