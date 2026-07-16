"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/axios";
import { isAxiosError } from "axios";
import { motion } from "framer-motion";
import { Lock, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional()
});

type LoginForm = z.infer<typeof loginSchema>;

function getSafeRedirect(raw: string | null) {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw.startsWith("/login") || raw.startsWith("/api")) return "/dashboard";
  return raw;
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false
    }
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/api/auth/login", {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        rememberMe: Boolean(data.rememberMe)
      });

      if (!response.data?.success && !response.data?.user) {
        setError("Login failed. Please try again.");
        setLoading(false);
        return;
      }

      // Hard navigation ensures HTTP-only cookies are included on the next request.
      // Soft router.replace() often leaves the user on /login because middleware
      // may run before the browser commits Set-Cookie from the XHR response.
      const redirectTo = getSafeRedirect(searchParams.get("redirect"));
      window.location.assign(redirectTo);
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message ?? "Login failed. Please try again.");
      } else {
        setError("Login failed. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
      <Card className="premium-shadow overflow-hidden border-[#E2E8F0] bg-white">
        <div className="h-1 w-full bg-gradient-to-r from-[#08142D] via-[#D4AF37] to-[#08142D]" />
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#08142D] to-[#1E3A8A] shadow-lg shadow-[#08142D]/25">
            <ShieldCheck className="size-7 text-[#E6C86E]" />
          </div>
          <CardTitle className="font-display text-2xl brand-gradient-text">
            Lexcore ERP
          </CardTitle>
          <p className="mt-2 text-sm text-[#64748B]">Super Admin secure portal</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="admin@lexcore.com"
                  className="pl-10"
                  {...register("email")}
                />
              </div>
              {errors.email ? <p className="text-xs text-red-400">{errors.email.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password ? <p className="text-xs text-red-400">{errors.password.message}</p> : null}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" className="rounded border-white/20 bg-white/5" {...register("rememberMe")} />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-sm text-[#C9A227] hover:text-[#D4AF37]">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" loading={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
