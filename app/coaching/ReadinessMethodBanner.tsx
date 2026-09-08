export default function ReadinessMethodBanner() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-10">
      <details className="rounded-2xl border border-[#E3E0D8] bg-white px-4 py-3 text-sm text-[#4B5563]">
        <summary className="cursor-pointer font-black text-[#101114]">How Race Readiness moves</summary>
        <div className="mt-3 grid gap-3 border-t border-[#E3E0D8] pt-3 sm:grid-cols-3">
          <div><strong className="text-[#101114]">50% plan-to-date</strong><p className="mt-1 leading-5">Complete the sessions that were actually prescribed. Extra volume does not buy a better score.</p></div>
          <div><strong className="text-[#101114]">25% recent consistency</strong><p className="mt-1 leading-5">The last four weeks matter more than an old perfect week.</p></div>
          <div><strong className="text-[#101114]">25% last seven days</strong><p className="mt-1 leading-5">Recent execution moves the score. In race week, follow the taper instead of chasing points.</p></div>
        </div>
      </details>
    </div>
  );
}
