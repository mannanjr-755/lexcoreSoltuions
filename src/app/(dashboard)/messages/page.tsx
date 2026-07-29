"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Hash } from "lucide-react";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatWindow } from "@/components/chat/chat-window";
import type { Attachment, Message, TeamMember, Workspace } from "@/components/chat/chat-types";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";
import { getAuthorizedUserByEmail } from "@/lib/authorized-users";

export default function MessagesPage() {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace>({
    id: "lexcore-solutions",
    name: "Lexcore Solutions",
    members: []
  });
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showMobileList, setShowMobileList] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const currentMember = useMemo(
    () => getAuthorizedUserByEmail(user?.email ?? ""),
    [user?.email]
  );

  const currentUserId = user?.id ?? "";
  const isAdmin = (user?.email ?? "").toLowerCase() === "admin@lexcore.com";
  const [clearChatLoading, setClearChatLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    const response = await api.get("/api/messages");
    const payload = response.data as {
      workspace: { id: string; name: string };
      members: TeamMember[];
      messages: Message[];
    };
    return payload;
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const payload = await fetchMessages();
        if (!mounted) return;
        setWorkspace({ ...payload.workspace, members: payload.members });
        setMsgs(payload.messages);
      } catch (error: unknown) {
        if (!mounted) return;
        setLoadError(
          typeof error === "object" && error && "response" in error
            ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to load messages.")
            : "Failed to load messages."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [fetchMessages]);

  useEffect(() => {
    const source = new EventSource("/api/messages/stream");
    source.addEventListener("message.created", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { message: Message };
      setMsgs((prev) => (prev.some((item) => item.id === payload.message.id) ? prev : [...prev, payload.message]));
    });
    source.addEventListener("message.updated", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { messageId: string; text: string; updatedAt: string };
      setMsgs((prev) =>
        prev.map((item) =>
          item.id === payload.messageId ? { ...item, text: payload.text, updatedAt: payload.updatedAt, isEdited: true } : item
        )
      );
    });
    source.addEventListener("message.deleted", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { messageId: string };
      setMsgs((prev) => prev.filter((item) => item.id !== payload.messageId));
    });
    source.addEventListener("messages.cleared", () => {
      setMsgs([]);
    });
    source.addEventListener("typing", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { email: string; isTyping: boolean };
      setTypingUsers((prev) => {
        if (payload.email === (user?.email ?? "").toLowerCase()) return prev;
        if (payload.isTyping) return prev.includes(payload.email) ? prev : [...prev, payload.email];
        return prev.filter((email) => email !== payload.email);
      });
    });
    source.addEventListener("typing.snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { typingUsers: string[] };
      const self = (user?.email ?? "").toLowerCase();
      setTypingUsers(payload.typingUsers.filter((email) => email !== self));
    });
    return () => source.close();
  }, [user?.email]);

  const handleSelect = useCallback(() => {
    setChatOpen(true);
    setShowMobileList(false);
  }, []);

  const handleSend = useCallback(async (payload: { text: string; attachments: Attachment[]; replyToId?: string | null }) => {
    const optimisticId = `temp-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic: Message = {
      id: optimisticId,
      senderId: currentUserId,
      senderName: currentMember?.name ?? user?.fullName ?? "You",
      senderEmail: user?.email ?? "",
      text: payload.text,
      status: "sent",
      isEdited: false,
      isDeleted: false,
      replyToId: payload.replyToId ?? null,
      replyToText: null,
      replyToSenderName: null,
      createdAt: now,
      updatedAt: now,
      attachments: payload.attachments
    };
    setMsgs((prev) => [...prev, optimistic]);
    try {
      const response = await api.post("/api/messages", payload);
      const saved = response.data.message as Message;
      setMsgs((prev) => {
        const withoutOptimistic = prev.filter((item) => item.id !== optimisticId && item.id !== saved.id);
        return [...withoutOptimistic, saved];
      });
      setLoadError("");
    } catch (error: unknown) {
      setMsgs((prev) => prev.filter((item) => item.id !== optimisticId));
      const message =
        typeof error === "object" && error && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to send message.")
          : "Failed to send message.";
      setLoadError(message);
    }
  }, [currentMember?.name, currentUserId, user?.email, user?.fullName]);

  const handleDelete = useCallback(async (msgId: string) => {
    const snapshot = msgs;
    setMsgs((prev) => prev.filter((m) => m.id !== msgId));
    try {
      await api.delete(`/api/messages/${msgId}`);
    } catch {
      setMsgs(snapshot);
    }
  }, [msgs]);

  const handleEdit = useCallback(async (msgId: string, text: string) => {
    const snapshot = msgs;
    setMsgs((prev) =>
      prev.map((m) =>
        m.id === msgId && m.senderId === currentUserId ? { ...m, text, isEdited: true, updatedAt: new Date().toISOString() } : m
      )
    );
    try {
      await api.patch(`/api/messages/${msgId}`, { text });
    } catch {
      setMsgs(snapshot);
    }
  }, [currentUserId, msgs]);

  const handleClearChat = useCallback(async () => {
    setClearChatLoading(true);
    try {
      await api.delete("/api/messages/clear");
      setMsgs([]);
      setLoadError("");
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Failed to clear chat.")
          : "Failed to clear chat.";
      setLoadError(message);
    } finally {
      setClearChatLoading(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    setShowMobileList(true);
  }, []);

  const handleTypingChange = useCallback(async (isTyping: boolean) => {
    try {
      await api.post("/api/messages/typing", { isTyping });
    } catch {
      // ignore transient typing errors
    }
  }, []);

  const typingUserNames = useMemo(() => {
    const idMap = new Map(workspace.members.map((member) => [member.email.toLowerCase(), member.name]));
    return typingUsers.map((email) => idMap.get(email) ?? email);
  }, [typingUsers, workspace.members]);

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
          currentUserEmail={user?.email ?? ""}
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
          <>
            {loadError ? (
              <div className="mx-4 mt-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</div>
            ) : null}
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-sm text-[#64748B]">Loading messages...</div>
            ) : (
              <ChatWindow
                workspace={workspace}
                messages={msgs}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onSend={handleSend}
                onTypingChange={handleTypingChange}
                typingUsers={typingUserNames}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onClearChat={isAdmin ? handleClearChat : undefined}
                clearChatLoading={clearChatLoading}
                onBack={handleBack}
              />
            )}
          </>
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
