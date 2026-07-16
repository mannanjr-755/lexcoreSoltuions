"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { AnimatedNumber } from "@/components/dashboard/animated-number";
import { cn } from "@/lib/utils";

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * 100;
      const y = 28 - ((v - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 32" className="mt-4 h-9 w-full overflow-visible opacity-90">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill={`url(#spark-${color.replace("#", "")})`}
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={`${points} 100,32 0,32`}
      />
    </svg>
  );
}

const toneMap = {
  gold: { card: "card-gradient-gold", spark: "#D4AF37", icon: "bg-[rgba(212,175,55,0.12)] text-[#C9A227]" },
  blue: { card: "card-gradient-blue", spark: "#1E3A8A", icon: "bg-[rgba(30,58,138,0.1)] text-[#1E3A8A]" },
  cyan: { card: "card-gradient-cyan", spark: "#102348", icon: "bg-[rgba(16,35,72,0.08)] text-[#102348]" },
  green: { card: "card-gradient-green", spark: "#22C55E", icon: "bg-emerald-50 text-emerald-600" },
  red: { card: "card-gradient-red", spark: "#EF4444", icon: "bg-red-50 text-red-600" },
  amber: { card: "card-gradient-amber", spark: "#F59E0B", icon: "bg-amber-50 text-amber-600" },
  purple: { card: "card-gradient-purple", spark: "#1E3A8A", icon: "bg-[rgba(30,58,138,0.08)] text-[#1E3A8A]" }
} as const;

export function PremiumStatCard({
  label,
  description,
  value,
  icon: Icon,
  growth,
  spark,
  href,
  tone = "gold",
  format = "number",
  delay = 0
}: {
  label: string;
  description?: string;
  value: number;
  icon: React.ElementType;
  growth?: number;
  spark?: number[];
  href?: string;
  tone?: keyof typeof toneMap;
  format?: "number" | "currency" | "percent";
  delay?: number;
}) {
  const router = useRouter();
  const styles = toneMap[tone];
  const prefix = format === "currency" ? "PKR " : "";
  const suffix = format === "percent" ? "%" : "";
  const decimals = format === "percent" ? 1 : 0;

  return (
    <motion.button
      type="button"
      title={description ?? label}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={() => href && router.push(href)}
      className={cn(
        "group relative w-full overflow-hidden rounded-[16px] border border-[#E2E8F0] p-5 text-left premium-shadow",
        styles.card,
        href && "cursor-pointer"
      )}
    >
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">{label}</p>
          <p className="mt-2 truncate font-display text-[1.65rem] font-bold leading-none tracking-tight text-[#0F172A]">
            <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          </p>
          {description && <p className="mt-2 text-xs text-[#64748B]">{description}</p>}
          {typeof growth === "number" && (
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                growth >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}
            >
              {growth >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {growth >= 0 ? "+" : ""}
              {growth.toFixed(1)}% MoM
            </p>
          )}
        </div>
        <div className={cn("rounded-2xl p-3 transition group-hover:scale-110", styles.icon)}>
          <Icon className="size-5" />
        </div>
      </div>
      {spark && spark.length > 0 && <MiniSpark data={spark} color={styles.spark} />}
    </motion.button>
  );
}

export function StatCardSkeleton() {
  return <div className="h-[168px] animate-pulse rounded-[16px] border border-[#E2E8F0] bg-[#F1F5F9]" />;
}
