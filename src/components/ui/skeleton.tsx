import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-[#F1F5F9]", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 premium-shadow">
      <Skeleton className="mb-3 h-3.5 w-20" />
      <Skeleton className="h-8 w-28" />
      <Skeleton className="mt-3 h-3 w-16" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, col) => (
            <Skeleton key={col} className="h-8 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2563EB]/30 border-t-[#2563EB]" />
    </div>
  );
}
