"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { forwardRef, type MouseEvent } from "react";

const buttonVariants = cva(
  "btn-ripple inline-flex items-center justify-center gap-2 rounded-[12px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[#C9A227] to-[#D4AF37] text-white shadow-md shadow-amber-600/20 hover:from-[#D4AF37] hover:to-[#E6C86E] hover:shadow-lg",
        secondary:
          "border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F1F5F9]",
        ghost: "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
        danger: "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100",
        outline:
          "border border-[#D4AF37]/50 bg-white text-[#C9A227] hover:bg-[rgba(212,175,55,0.08)]",
        accent:
          "bg-gradient-to-r from-[#08142D] to-[#1E3A8A] text-white shadow-md shadow-slate-900/15 hover:brightness-110"
      },
      size: {
        default: "h-11 px-5 text-sm",
        sm: "h-9 px-4 text-xs",
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
  ({ className, variant, size, loading, children, disabled, onClick, type = "button", ...props }, ref) => {
    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty("--x", `${e.clientX - rect.left}px`);
      e.currentTarget.style.setProperty("--y", `${e.clientY - rect.top}px`);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
