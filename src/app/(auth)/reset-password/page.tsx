"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/axios";
import { isAxiosError } from "axios";
import Link from "next/link";
import { motion } from "framer-motion";
import { KeyRound, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z
  .object({
    email: z.string().email(),
    otp: z.string().length(6, "OTP must be 6 digits"),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export default function ResetPasswordPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await api.post("/api/auth/verify-otp", { email: data.email, otp: data.otp });
      const res = await api.post("/api/auth/reset-password", data);
      setMessage(res.data.message);
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.message ?? "Reset failed") : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="premium-shadow">
        <CardHeader>
          <CardTitle className="brand-gradient-text">Reset Password</CardTitle>
          <p className="text-sm text-[#64748B]">Enter OTP and your new password</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {message && <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">{message}</div>}
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register("email")} />
            </div>
            <div className="space-y-2">
              <Label>OTP Code</Label>
              <Input placeholder="123456" maxLength={6} {...register("otp")} />
              {errors.otp && <p className="text-xs text-red-400">{errors.otp.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" {...register("newPassword")} />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" {...register("confirmPassword")} />
              {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              <KeyRound className="size-4" /> Reset Password
            </Button>
            <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A]">
              <ArrowLeft className="size-4" /> Back to login
            </Link>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
