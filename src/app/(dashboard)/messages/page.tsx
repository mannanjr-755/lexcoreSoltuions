"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Hash } from "lucide-react";
import { ConversationList } from "@/components/chat/conversation-list";
import { ChatWindow } from "@/components/chat/chat-window";
import type { Attachment, Message, TeamMember, Workspace } from "@/components/chat/chat-types";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";
import { getAuthorizedUserByEmail } from "@/lib/authorized-users";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mergeMessages(existing: Message[], incoming: Message[]) {
  const map = new Map<string, Message>();
  for (const item of existing) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [chatOpen, setChatOpen] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace>({
    id: "lexcore-solutions",
    name: "Lexcore Solutions",
    members: []
  });
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [clearChatLoading, setClearChatLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const loadMoreLock = useRef(false);

  const currentMember = useMemo(
    () => getAuthorizedUserByEmail(user?.email ?? ""),
    [user?.email]
  );

  const currentUserId = user?.id ?? "";
  const currentUserEmail = user?.email ?? "";
  const isAdmin =
    user?.role === "super_admin" || normalizeEmail(currentUserEmail) === "admin@lexcore.com";

  const applyOnlineEmails = useCallback((onlineEmails: string[]) => {
    const online = new Set(onlineEmails.map(normalizeEmail));
    setWorkspace((prev) => ({
      ...prev,
      members: prev.members.map((member) => ({
        ...member,
        isOnline: online.has(normalizeEmail(member.email))
      }))
    }));
  }, []);

  const fetchPage = useCallback(async (before?: string) => {
    const response = await api.get("/api/messages", {
      params: { limit: 50, ...(before ? { before } : {}) }
    });
    return response.data as {
      workspace: { id: string; name: string };
      members: TeamMember[];
      messages: Message[];
      hasMore: boolean;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const payload = await fetchPage();
        if (!mounted) return;
        setWorkspace({ ...payload.workspace, members: payload.members });
        setMsgs(payload.messages);
        setHasMore(Boolean(payload.hasMore));
        void api.post("/api/messages/read").catch(() => undefined);
      } catch (error: unknown) {
        if (!mounted) return;
        const message =
          typeof error === "object" && error && "response" in error
            ? String(
                (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                  "Failed to load messages."
              )
            : "Failed to load messages.";
        toast.error("Unable to load chat", message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
    // toast helpers are stable via ToastProvider memo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage]);

  useEffect(() => {
    const source = new EventSource("/api/messages/stream");

    source.addEventListener("connected", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { onlineEmails?: string[] };
      if (payload.onlineEmails) applyOnlineEmails(payload.onlineEmails);
    });

    source.addEventListener("presence.snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { onlineEmails: string[] };
      applyOnlineEmails(payload.onlineEmails);
    });

    source.addEventListener("presence", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        onlineEmails: string[];
      };
      applyOnlineEmails(payload.onlineEmails);
    });

    source.addEventListener("message.created", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { message: Message };
      setMsgs((prev) => {
        if (prev.some((item) => item.id === payload.message.id)) return prev;
        const withoutTemp = prev.filter(
          (item) =>
            !(
              item.id.startsWith("temp-") &&
              normalizeEmail(item.senderEmail) === normalizeEmail(payload.message.senderEmail) &&
              item.text === payload.message.text &&
              item.attachments.length === payload.message.attachments.length
            )
        );
        return mergeMessages(withoutTemp, [payload.message]);
      });
      if (normalizeEmail(payload.message.senderEmail) !== normalizeEmail(currentUserEmail)) {
        void api.post("/api/messages/read").catch(() => undefined);
      }
    });

    source.addEventListener("message.updated", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        messageId: string;
        text: string;
        updatedAt: string;
      };
      setMsgs((prev) =>
        prev.map((item) =>
          item.id === payload.messageId
            ? { ...item, text: payload.text, updatedAt: payload.updatedAt, isEdited: true }
            : item
        )
      );
    });

    source.addEventListener("message.deleted", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { messageId: string };
      setMsgs((prev) => prev.filter((item) => item.id !== payload.messageId));
    });

    source.addEventListener("messages.cleared", () => {
      setMsgs([]);
      setHasMore(false);
    });

    source.addEventListener("message.status", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        messageIds: string[];
        status: Message["status"];
      };
      const ids = new Set(payload.messageIds);
      setMsgs((prev) =>
        prev.map((item) => (ids.has(item.id) ? { ...item, status: payload.status } : item))
      );
    });

    source.addEventListener("typing", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as {
        email: string;
        isTyping: boolean;
      };
      setTypingUsers((prev) => {
        if (payload.email === normalizeEmail(currentUserEmail)) return prev;
        if (payload.isTyping) return prev.includes(payload.email) ? prev : [...prev, payload.email];
        return prev.filter((email) => email !== payload.email);
      });
    });

    source.addEventListener("typing.snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { typingUsers: string[] };
      const self = normalizeEmail(currentUserEmail);
      setTypingUsers(payload.typingUsers.filter((email) => email !== self));
    });

    return () => source.close();
  }, [applyOnlineEmails, currentUserEmail]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loadMoreLock.current || msgs.length === 0) return;
    loadMoreLock.current = true;
    setLoadingMore(true);
    try {
      const oldest = msgs[0];
      const payload = await fetchPage(oldest.id);
      setWorkspace((prev) => ({ ...payload.workspace, members: payload.members.length ? payload.members : prev.members }));
      setMsgs((prev) => mergeMessages(payload.messages, prev));
      setHasMore(Boolean(payload.hasMore));
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error && "response" in error
          ? String(
              (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                "Failed to load earlier messages."
            )
          : "Failed to load earlier messages.";
      toast.error("Load failed", message);
    } finally {
      setLoadingMore(false);
      loadMoreLock.current = false;
    }
  }, [fetchPage, hasMore, loadingMore, msgs, toast]);

  const handleSelect = useCallback(() => {
    setChatOpen(true);
    setShowMobileList(false);
  }, []);

  const handleSend = useCallback(
    async (payload: { text: string; attachments: Attachment[]; replyToId?: string | null }) => {
      const optimisticId = `temp-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const optimistic: Message = {
        id: optimisticId,
        senderId: currentUserId,
        senderName: currentMember?.name ?? user?.fullName ?? "You",
        senderEmail: currentUserEmail,
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
          return mergeMessages(withoutOptimistic, [saved]);
        });
      } catch (error: unknown) {
        setMsgs((prev) => prev.filter((item) => item.id !== optimisticId));
        const message =
          typeof error === "object" && error && "response" in error
            ? String(
                (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                  "Failed to send message."
              )
            : "Failed to send message.";
        toast.error("Message not sent", message);
      }
    },
    [currentMember?.name, currentUserEmail, currentUserId, toast, user?.fullName]
  );

  const handleDelete = useCallback(
    async (msgId: string) => {
      setDeleteLoading(true);
      let snapshot: Message[] = [];
      setMsgs((prev) => {
        snapshot = prev;
        return prev.filter((m) => m.id !== msgId);
      });
      try {
        await api.delete(`/api/messages/${msgId}`);
        toast.success("Message deleted");
      } catch (error: unknown) {
        setMsgs(snapshot);
        const message =
          typeof error === "object" && error && "response" in error
            ? String(
                (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                  "Failed to delete message."
              )
            : "Failed to delete message.";
        toast.error("Delete failed", message);
      } finally {
        setDeleteLoading(false);
      }
    },
    [toast]
  );

  const handleEdit = useCallback(
    async (msgId: string, text: string) => {
      let snapshot: Message[] = [];
      setMsgs((prev) => {
        snapshot = prev;
        return prev.map((m) =>
          m.id === msgId ? { ...m, text, isEdited: true, updatedAt: new Date().toISOString() } : m
        );
      });
      try {
        await api.patch(`/api/messages/${msgId}`, { text });
        toast.success("Message updated");
      } catch (error: unknown) {
        setMsgs(snapshot);
        const message =
          typeof error === "object" && error && "response" in error
            ? String(
                (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                  "Failed to edit message."
              )
            : "Failed to edit message.";
        toast.error("Edit failed", message);
      }
    },
    [toast]
  );

  const handleClearChat = useCallback(async () => {
    setClearChatLoading(true);
    try {
      await api.delete("/api/messages/clear");
      setMsgs([]);
      setHasMore(false);
      toast.success("Chat cleared");
    } catch (error: unknown) {
      const message =
        typeof error === "object" && error && "response" in error
          ? String(
              (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                "Failed to clear chat."
            )
          : "Failed to clear chat.";
      toast.error("Clear failed", message);
    } finally {
      setClearChatLoading(false);
    }
  }, [toast]);

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
          currentUserEmail={currentUserEmail}
          onSelect={handleSelect}
        />
      </div>

      <div className={cn("flex flex-1 flex-col", !showMobileList ? "flex" : "hidden", "lg:flex")}>
        {chatOpen ? (
          loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[#64748B]">
              Loading messages...
            </div>
          ) : (
            <ChatWindow
              workspace={workspace}
              messages={msgs}
              currentUserId={currentUserId}
              currentUserEmail={currentUserEmail}
              isAdmin={isAdmin}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
              onSend={handleSend}
              onTypingChange={handleTypingChange}
              typingUsers={typingUserNames}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onClearChat={isAdmin ? handleClearChat : undefined}
              clearChatLoading={clearChatLoading}
              deleteLoading={deleteLoading}
              onBack={handleBack}
              onUploadError={(message) => toast.error("Upload failed", message)}
              onUploadSuccess={(name) => toast.success("Ready to send", name)}
            />
          )
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
