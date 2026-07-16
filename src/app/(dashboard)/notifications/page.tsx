"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export default function NotificationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications-page"],
    queryFn: async () => (await api.get("/api/notifications")).data,
    refetchInterval: 30_000
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notifications-page"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      queryClient.refetchQueries({ queryKey: ["notifications-page"], type: "active" }),
      queryClient.refetchQueries({ queryKey: ["dashboard-stats"], type: "active" })
    ]);
  };

  const markAll = useMutation({
    mutationFn: async () => api.patch("/api/notifications", { markAllRead: true }),
    onSuccess: async () => {
      toast.success("All notifications marked as read");
      await refresh();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/notifications?id=${id}`),
    onSuccess: async () => {
      toast.success("Record deleted successfully.");
      setDeleteId(null);
      await refresh();
    },
    onError: (err) =>
      toast.error(isAxiosError(err) ? err.response?.data?.message ?? "Delete failed" : "Delete failed")
  });

  const notifications = data?.notifications ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold brand-gradient-text">Notifications</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {data?.unreadCount ?? 0} unread · live from MongoDB
          </p>
        </div>
        <Button variant="secondary" onClick={() => markAll.mutate()} loading={markAll.isPending}>
          <CheckCheck className="size-4" /> Mark all read
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-[18px] bg-[#F1F5F9]" />
          ))
        ) : notifications.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-3 p-12 text-center">
            <Bell className="size-8 text-[#C9A227]" />
            <p className="text-[#64748B]">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n: { _id: string; title: string; message: string; isRead: boolean; createdAt: string }) => (
            <motion.div
              key={n._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-card premium-shadow p-4 ${!n.isRead ? "border-[rgba(212,175,55,0.25)]" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-sm text-[#64748B]">{n.message}</p>
                  <p className="mt-2 text-xs text-[#94A3B8]">{formatDateTime(n.createdAt)}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Delete Permanently"
                  onClick={() => setDeleteId(n._id)}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete permanently?"
        description="Are you sure you want to permanently delete this record? This action cannot be undone."
        confirmLabel="Delete Permanently"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
