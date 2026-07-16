import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090B] px-4 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-[#C9A227]">404</p>
      <h1 className="mt-3 font-[family-name:var(--font-space)] text-3xl font-bold text-[#0F172A]">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-[#64748B]">The page you requested does not exist or was moved.</p>
      <Link href="/dashboard" className="mt-8">
        <Button>Go to dashboard</Button>
      </Link>
    </div>
  );
}
