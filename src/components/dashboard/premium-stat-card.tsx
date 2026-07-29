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
    <svg viewBox="0 0 100 32" className="mt-3 h-8 w-full overflow-visible opacity-80">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill={`url(#spark-${color.replace("#", "")})`}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={`${points} 100,32 0,32`}
      />
    </svg>
  );
}

const iconColors = [
  "bg-[#EFF6FF] text-[#2563EB]",
  "bg-[#F0FDF4] text-[#22C55E]",
  "bg-[#FEF3C7] text-[#F59E0B]",
  "bg-[#FEF2F2] text-[#EF4444]",
  "bg-[#F5F3FF] text-[#8B5CF6]",
  "bg-[#ECFEFF] text-[#06B6D4]"
];

export function PremiumStatCard({
  label,
  description,
  value,
  icon: Icon,
  growth,
  spark,
  href,
  tone = 0,
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
  tone?: number;
  format?: "number" | "currency" | "percent";
  delay?: number;
}) {
  const router = useRouter();
  const iconStyle = iconColors[tone % iconColors.length];
  const suffix = format === "percent" ? "%" : "";
  const decimals = format === "percent" ? 1 : 0;

  return (
    <motion.button
      type="button"
      title={description ?? label}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      onClick={() => href && router.push(href)}
      className={cn(
        "group relative w-full overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white p-5 text-left premium-shadow transition-all duration-200",
        href && "cursor-pointer hover:border-[#CBD5E1] hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#64748B]">{label}</p>
          <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-[#0F172A]">
            {format === "currency" ? (
              <span>
                {value < 0 ? "-" : ""}PKR{" "}
                <AnimatedNumber value={Math.abs(value)} decimals={0} />
              </span>
            ) : (
              <AnimatedNumber value={value} suffix={suffix} decimals={decimals} />
            )}
          </p>
          {description && <p className="mt-1 text-xs text-[#94A3B8]">{description}</p>}
          {typeof growth === "number" && (
            <p
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-medium",
                growth >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
              )}
            >
              {growth >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {growth >= 0 ? "+" : ""}
              {growth.toFixed(1)}%
            </p>
          )}
        </div>
        <div className={cn("rounded-[10px] p-2.5 transition group-hover:scale-105 shrink-0", iconStyle)}>
          <Icon className="size-4" />
        </div>
      </div>
      {spark && spark.length > 0 && <MiniSpark data={spark} color="#2563EB" />}
    </motion.button>
  );
}

export function StatCardSkeleton() {
  return <div className="h-[128px] animate-pulse rounded-[16px] border border-[#E2E8F0] bg-white premium-shadow" />;
}
