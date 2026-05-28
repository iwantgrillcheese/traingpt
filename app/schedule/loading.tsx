export default function ScheduleLoading() {
  return (
    <main className="min-h-[100dvh] bg-zinc-50 px-4 py-6">
      <div className="mx-auto w-full max-w-[1800px]">
        <div className="mb-4 h-14 animate-pulse rounded-2xl bg-white shadow-sm" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="h-16 animate-pulse rounded-xl bg-white shadow-sm" />
          <div className="h-16 animate-pulse rounded-xl bg-white shadow-sm" />
          <div className="h-16 animate-pulse rounded-xl bg-white shadow-sm" />
        </div>

        <div className="mt-5 grid grid-cols-7 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          {Array.from({ length: 35 }).map((_, index) => (
            <div
              key={index}
              className="min-h-[120px] animate-pulse border-b border-r border-zinc-100 bg-zinc-50/60"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
