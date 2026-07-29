import { cn } from "@/lib/utils";

export function LexcoreLogo({
  className,
  size = "md",
  showWordmark = false
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}) {
  const box = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const icon = size === "sm" ? "text-xs" : size === "lg" ? "text-lg" : "text-sm";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-[10px] bg-[#2563EB]",
          box
        )}
      >
        <span className={cn("font-bold tracking-tight text-white", icon)}>L</span>
      </div>
      {showWordmark && (
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight tracking-tight text-[#0F172A]">Lexcore</p>
          <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#64748B]">Solutions</p>
        </div>
      )}
    </div>
  );
}
