"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-sm",
        secondary:
          "border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F1F5F9] hover:border-[#CBD5E1]",
        ghost: "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
        danger: "bg-[#EF4444] text-white hover:bg-[#DC2626] shadow-sm",
        outline:
          "border border-[#2563EB] bg-white text-[#2563EB] hover:bg-[#EFF6FF]",
        accent:
          "bg-[#0F172A] text-white hover:bg-[#1E293B] shadow-sm"
      },
      size: {
        default: "h-10 px-5 text-sm",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
