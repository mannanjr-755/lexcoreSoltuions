"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Save, Building2, Mail, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const settingsSchema = z.object({
  companyName: z.string().min(2),
  companyLogo: z.string().optional(),
  companyAddress: z.string().optional(),
  companyEmail: z.string().email().optional().or(z.literal("")),
  companyPhone: z.string().optional(),
  companyWebsite: z.string().url().optional().or(z.literal("")),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().email().optional().or(z.literal("")),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  theme: z.enum(["dark", "light"]).optional(),
  sessionTimeoutMinutes: z.number().min(5).optional(),
  maxLoginAttempts: z.number().min(3).optional(),
  lockoutDurationMinutes: z.number().min(5).optional()
});

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/api/settings")).data
  });

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    values: data?.settings
  });

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof settingsSchema>) => api.patch("/api/settings", values),
    onSuccess: () => {
      setMessage("Settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    }
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="font-[family-name:var(--font-space)] text-3xl font-bold brand-gradient-text">System Settings</h1>
        <p className="text-[#64748B]">Configure company and system preferences</p>
      </motion.div>

      {message && <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">{message}</div>}

      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <Card className="premium-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="size-5 text-[#C9A227]" /> Company</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Company Name</Label><Input {...form.register("companyName")} /></div>
            <div className="space-y-2"><Label>Company Logo URL</Label><Input {...form.register("companyLogo")} /></div>
            <div className="space-y-2"><Label>Email</Label><Input {...form.register("companyEmail")} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input {...form.register("companyPhone")} /></div>
            <div className="space-y-2"><Label>Website</Label><Input {...form.register("companyWebsite")} /></div>
            <div className="col-span-full space-y-2"><Label>Address</Label><Input {...form.register("companyAddress")} /></div>
          </CardContent>
        </Card>

        <Card className="premium-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="size-5 text-[#C9A227]" /> SMTP Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>SMTP Host</Label><Input {...form.register("smtpHost")} placeholder="smtp.gmail.com" /></div>
            <div className="space-y-2"><Label>SMTP Port</Label><Input type="number" {...form.register("smtpPort")} /></div>
            <div className="space-y-2"><Label>SMTP User</Label><Input {...form.register("smtpUser")} /></div>
            <div className="space-y-2"><Label>SMTP Password</Label><Input type="password" {...form.register("smtpPass")} placeholder="********" /></div>
            <div className="space-y-2"><Label>From Email</Label><Input {...form.register("smtpFrom")} /></div>
          </CardContent>
        </Card>

        <Card className="premium-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="size-5 text-[#C9A227]" /> Preferences & Security</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Currency</Label><Input {...form.register("currency")} /></div>
            <div className="space-y-2"><Label>Timezone</Label><Input {...form.register("timezone")} /></div>
            <div className="space-y-2"><Label>Language</Label><Input {...form.register("language")} /></div>
            <div className="space-y-2">
              <Label>Theme</Label>
              <select {...form.register("theme")} className="flex h-11 w-full rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] px-4 text-sm">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Session Timeout (min)</Label><Input type="number" {...form.register("sessionTimeoutMinutes")} /></div>
            <div className="space-y-2"><Label>Max Login Attempts</Label><Input type="number" {...form.register("maxLoginAttempts")} /></div>
          </CardContent>
        </Card>

        <Button type="submit" loading={mutation.isPending}><Save className="size-4" /> Save Settings</Button>
      </form>
    </div>
  );
}
