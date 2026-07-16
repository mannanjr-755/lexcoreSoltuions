import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090B] px-4 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-red-400">401</p>
      <h1 className="mt-3 font-[family-name:var(--font-space)] text-3xl font-bold text-white">Unauthorized</h1>
      <p className="mt-3 max-w-md text-sm text-gray-400">You must sign in as Super Admin to access this area.</p>
      <Link href="/login" className="mt-8">
        <Button>Sign in</Button>
      </Link>
    </div>
  );
}
