export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#2563EB]" style={{ animationDelay: "0ms" }} />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#2563EB]" style={{ animationDelay: "150ms" }} />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#2563EB]" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-xs text-[#64748B]">typing...</span>
    </div>
  );
}
