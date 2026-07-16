"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/axios";
import { isAxiosError } from "axios";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({ email: z.string().email() });

export default function ForgotPasswordPage() {
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
      const res = await api.post("/api/auth/forgot-password", data);
      setMessage(res.data.message);
    } catch (err) {
      setError(isAxiosError(err) ? (err.response?.data?.message ?? "Failed") : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="premium-shadow">
        <CardHeader>
          <CardTitle className="brand-gradient-text">Forgot Password</CardTitle>
          <p className="text-sm text-[#64748B]">Enter your email to receive an OTP</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {message && <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">{message}</div>}
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
                <Input type="email" className="pl-10" placeholder="admin@lexcore.com" {...register("email")} />
              </div>
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full" loading={loading}>Send OTP</Button>
            <Link href="/reset-password" className="block text-center text-sm text-[#C9A227] hover:text-[#D4AF37]">
              Already have an OTP? Reset password
            </Link>
            <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-[#64748B] hover:text-[#0F172A]">
              <ArrowLeft className="size-4" /> Back to login
            </Link>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
