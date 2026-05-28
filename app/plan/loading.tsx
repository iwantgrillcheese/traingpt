export default function PlanLoading() {
  return (
    <main className="min-h-[100dvh] bg-white px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mx-auto mb-8 h-10 w-64 animate-pulse rounded-full bg-zinc-100" />

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-zinc-100" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-zinc-100" />
          <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-zinc-100" />

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
          </div>

          <div className="mt-8 h-12 animate-pulse rounded-full bg-zinc-950/10" />
        </section>
      </div>
    </main>
  );
}
