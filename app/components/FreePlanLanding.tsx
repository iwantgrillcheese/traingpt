import Link from 'next/link';
import PublicPlanPreview from './PublicPlanPreview';

type RaceType = 'Sprint' | 'Olympic' | 'Half Ironman (70.3)' | 'Ironman (140.6)';

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  raceType: RaceType;
  bullets: string[];
};

export default function FreePlanLanding({ eyebrow, title, description, raceType, bullets }: Props) {
  return (
    <main className="min-h-screen bg-[#FBFBFA] text-[#101114]">
      <header className="border-b border-[#E3E0D8] bg-white/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-black tracking-[-0.04em]">Brick</Link>
          <Link href="/login?next=/schedule" className="rounded-full border border-[#E3E0D8] px-4 py-2 text-sm font-black">Log in</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#6B7280]">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.075em] sm:text-7xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4B5563]">{description}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {bullets.map((item) => <div key={item} className="rounded-2xl border border-[#E3E0D8] bg-white p-4 text-sm font-bold leading-6 text-[#4B5563]">{item}</div>)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2 className="text-3xl font-black tracking-[-0.05em]">Preview a real training week</h2>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">Change the inputs and see how the week changes before creating an account.</p>
        </div>
        <PublicPlanPreview initialRaceType={raceType} />
      </section>

      <section className="border-t border-[#E3E0D8] bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
          <div><h2 className="font-black">Built around your week</h2><p className="mt-2 text-sm leading-6 text-[#6B7280]">Rest days, long-session preferences, available hours, and training history shape the saved plan.</p></div>
          <div><h2 className="font-black">Strava closes the loop</h2><p className="mt-2 text-sm leading-6 text-[#6B7280]">Completed rides, runs, and swims match back to the plan so the next adjustment is grounded in what happened.</p></div>
          <div><h2 className="font-black">Free to use today</h2><p className="mt-2 text-sm leading-6 text-[#6B7280]">No credit card is required. Brick is being built as a real training product with athletes, not a one-off plan PDF.</p></div>
        </div>
      </section>
    </main>
  );
}
