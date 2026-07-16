"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090B] px-4 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-[#C9A227]">Error</p>
      <h1 className="mt-3 font-[family-name:var(--font-space)] text-3xl font-bold text-[#0F172A]">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm text-[#64748B]">{error.message || "An unexpected error occurred."}</p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
