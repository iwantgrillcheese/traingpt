export default function CoachingLoading() {
  return (
    <main className="min-h-[100dvh] bg-zinc-50 px-4 py-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-5 h-20 animate-pulse rounded-3xl bg-white shadow-sm" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="h-[420px] animate-pulse rounded-3xl bg-white shadow-sm" />
          <div className="space-y-4">
            <div className="h-36 animate-pulse rounded-3xl bg-white shadow-sm" />
            <div className="h-36 animate-pulse rounded-3xl bg-white shadow-sm" />
            <div className="h-36 animate-pulse rounded-3xl bg-white shadow-sm" />
          </div>
        </div>
      </div>
    </main>
  );
}
