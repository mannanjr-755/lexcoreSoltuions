"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/axios";
import { isAxiosError } from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { User, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

const profileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  company: z.string().optional(),
  designation: z.string().optional(),
  address: z.string().optional(),
  profilePhoto: z.string().url().optional().or(z.literal(""))
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordErr, setPasswordErr] = useState("");

  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await api.get("/api/profile")).data
  });

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: data?.user
      ? {
          fullName: data.user.fullName,
          phone: data.user.phone ?? "",
          company: data.user.company ?? "",
          designation: data.user.designation ?? "",
          address: data.user.address ?? "",
          profilePhoto: data.user.profilePhoto ?? ""
        }
      : undefined
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema)
  });

  const updateProfile = useMutation({
    mutationFn: (values: z.infer<typeof profileSchema>) => api.patch("/api/profile", values),
    onSuccess: () => {
      setProfileMsg("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  });

  const changePassword = useMutation({
    mutationFn: (values: z.infer<typeof passwordSchema>) => api.post("/api/auth/change-password", values),
    onSuccess: () => {
      setPasswordMsg("Password changed successfully");
      setPasswordErr("");
      passwordForm.reset();
    },
    onError: (err) => {
      setPasswordErr(isAxiosError(err) ? (err.response?.data?.message ?? "Failed") : "Failed");
    }
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="font-[family-name:var(--font-space)] text-3xl font-bold brand-gradient-text">Profile</h1>
        <p className="text-[#64748B]">Manage your account settings</p>
      </motion.div>

      <Card className="premium-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="size-5 text-[#C9A227]" /> Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          {profileMsg && <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">{profileMsg}</div>}
          <form onSubmit={profileForm.handleSubmit((v) => updateProfile.mutate(v))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input {...profileForm.register("fullName")} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...profileForm.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input {...profileForm.register("company")} />
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input {...profileForm.register("designation")} />
              </div>
              <div className="col-span-full space-y-2">
                <Label>Address</Label>
                <Input {...profileForm.register("address")} />
              </div>
              <div className="col-span-full space-y-2">
                <Label>Profile Photo URL</Label>
                <Input {...profileForm.register("profilePhoto")} placeholder="https://..." />
              </div>
            </div>
            {data?.user && (
              <div className="rounded-lg border border-[#E2E8F0] p-3 text-sm text-[#64748B]">
                <p>Last login: {data.user.lastLoginAt ? formatDateTime(data.user.lastLoginAt) : "N/A"}</p>
                <p>IP: {data.user.lastLoginIp ?? "N/A"}</p>
              </div>
            )}
            <Button type="submit" loading={updateProfile.isPending}><Save className="size-4" /> Save Profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="premium-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="size-5 text-[#C9A227]" /> Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          {passwordMsg && <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">{passwordMsg}</div>}
          {passwordErr && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{passwordErr}</div>}
          <form onSubmit={passwordForm.handleSubmit((v) => changePassword.mutate(v))} className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" {...passwordForm.register("currentPassword")} />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" {...passwordForm.register("newPassword")} />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" {...passwordForm.register("confirmPassword")} />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-red-400">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" loading={changePassword.isPending}>Change Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
