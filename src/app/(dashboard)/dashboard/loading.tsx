export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-[#F1F5F9]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[128px] rounded-[16px] border border-[#E2E8F0] bg-white" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[128px] rounded-[16px] border border-[#E2E8F0] bg-white" />
        ))}
      </div>
      <div className="h-[280px] rounded-[16px] border border-[#E2E8F0] bg-white" />
    </div>
  );
}
