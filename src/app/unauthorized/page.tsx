import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#EF4444]">401</p>
      <h1 className="mt-3 text-3xl font-bold text-[#0F172A]">Unauthorized</h1>
      <p className="mt-3 max-w-md text-sm text-[#64748B]">You do not have permission to access this area.</p>
      <Link href="/login" className="mt-8">
        <Button>Sign in</Button>
      </Link>
    </div>
  );
}
