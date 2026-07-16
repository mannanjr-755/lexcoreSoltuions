import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-[12px] border border-[#E2E8F0] bg-white px-4 text-sm text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
