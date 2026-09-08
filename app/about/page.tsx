import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#FBFBFA] text-[#101114]">
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        <Link href="/" className="text-sm font-black text-[#6B7280]">← Brick</Link>
        <p className="mt-16 text-[11px] font-black uppercase tracking-[0.2em] text-[#6B7280]">About Brick</p>
        <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.075em] sm:text-7xl">Built because training should not require rebuilding context every week.</h1>

        <div className="mt-14 grid gap-12 text-base leading-8 text-[#4B5563]">
          <section>
            <h2 className="text-2xl font-black tracking-[-0.04em] text-[#101114]">Why it exists</h2>
            <p className="mt-4">I am a triathlete who used ChatGPT to help build race plans. The plans could be useful, but the workflow was not: paste in the race, explain my schedule, re-explain my zones, copy sessions into a calendar, then start over when training did not go exactly to plan.</p>
            <p className="mt-4">Brick is the product I wanted instead. Build the race plan once, keep the sessions in one place, connect Strava so completed training comes back automatically, and let future weeks adapt from what actually happened.</p>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E3E0D8] bg-white p-5"><h3 className="font-black text-[#101114]">Plan</h3><p className="mt-2 text-sm leading-6">Structured race builds from Sprint through Ironman, based on your actual availability.</p></div>
            <div className="rounded-2xl border border-[#E3E0D8] bg-white p-5"><h3 className="font-black text-[#101114]">Track</h3><p className="mt-2 text-sm leading-6">Strava activities match back to the schedule so planned and completed work stay connected.</p></div>
            <div className="rounded-2xl border border-[#E3E0D8] bg-white p-5"><h3 className="font-black text-[#101114]">Adapt</h3><p className="mt-2 text-sm leading-6">The next week can respond to missed and completed training instead of treating the original plan as sacred.</p></div>
          </section>

          <section>
            <h2 className="text-2xl font-black tracking-[-0.04em] text-[#101114]">What it is not</h2>
            <p className="mt-4">Brick is not pretending to replace a great human coach. A good coach brings judgment, relationship, observation, and context that software will not fully reproduce. Brick is for athletes who want more structure and adaptation than a static plan without needing a full coaching relationship.</p>
          </section>

          <section className="rounded-3xl bg-[#101114] p-7 text-white sm:p-9">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Built in public, held to a real product standard.</h2>
            <p className="mt-4 text-white/65">The useful part of the story is not how quickly the first version was coded. It is that Brick comes from the exact annoyance it is trying to remove, and it keeps getting better as athletes use it through real training blocks.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link href="/preview" className="rounded-full bg-white px-5 py-3 text-sm font-black text-[#101114]">Preview a plan</Link><a href="mailto:me@cameronmmcdiarmid.com" className="rounded-full border border-white/20 px-5 py-3 text-sm font-black">Send feedback</a></div>
          </section>
        </div>
      </div>
    </main>
  );
}
