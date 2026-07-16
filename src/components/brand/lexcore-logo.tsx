import { cn } from "@/lib/utils";

/** Lexcore brand mark — gold crest on navy, inspired by company identity */
export function LexcoreLogo({
  className,
  size = "md",
  showWordmark = false
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}) {
  const box = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const icon = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#08142D] to-[#1E3A8A] shadow-lg shadow-[#08142D]/20",
          box
        )}
      >
        <span
          className={cn(
            "font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-[#E6C86E] to-[#D4AF37]",
            icon
          )}
        >
          L
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#D4AF37]" />
      </div>
      {showWordmark && (
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight tracking-tight brand-gradient-text">Lexcore</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Solutions</p>
        </div>
      )}
    </div>
  );
}
