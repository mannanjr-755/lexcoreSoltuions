import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
