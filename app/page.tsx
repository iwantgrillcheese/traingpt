'use client';

import Image from 'next/image';
import Link from 'next/link';

const authorityItems = [
  'Structured Plans',
  'Integrated Tracking',
  'Race-Aware Progression',
  'Performance Clarity',
];

const comparisonRows = [
  {
    label: 'Interface clarity',
    traingpt: 'Calm, modern workspace',
    traditional: 'Cluttered views and fragmented context',
  },
  {
    label: 'Planning + tracking workflow',
    traingpt: 'Unified planning and execution',
    traditional: 'Separate tools and manual stitching',
  },
  {
    label: 'Adaptability',
    traingpt: 'Structured progression that adapts with training reality',
    traditional: 'Static templates with limited flexibility',
  },
  {
    label: 'Decision visibility',
    traingpt: 'Clear signal on what to focus on next',
    traditional: 'Data-heavy, action-light dashboards',
  },
];

function ProductSection({
  id,
  eyebrow,
  headline,
  body,
  bullets,
  image,
  imageAlt,
  reverse,
}: {
  id: string;
  eyebrow: string;
  headline: string;
  body: string;
  bullets: string[];
  image: string;
  imageAlt: string;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="py-20 md:py-[120px]">
      <div className={`grid items-center gap-10 md:gap-14 lg:grid-cols-2 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6F746C]">{eyebrow}</p>
          <h2 className="mt-3 text-[34px] leading-[1.12] tracking-tight text-[#111214] md:text-[44px]">{headline}</h2>
          <p className="mt-5 max-w-[58ch] text-[16px] leading-relaxed text-[#4F544D]">{body}</p>
          <ul className="mt-6 space-y-3 text-[15px] leading-relaxed text-[#1F2320]">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#3F4E45]" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#D9DDD7] bg-[#EFEFED]">
          <Image src={image} alt={imageAlt} width={1400} height={900} className="h-auto w-full object-cover" priority={id === 'planning'} />
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F7F7F6] text-[#111214]">
      <main className="mx-auto w-full max-w-[1180px] px-6 pb-20 pt-10 md:px-8 md:pb-24 md:pt-14">
        <section className="grid items-center gap-12 py-16 md:py-[110px] lg:grid-cols-[1.02fr_1fr]">
          <div>
            <h1 className="text-[56px] leading-[0.98] tracking-[-0.03em] text-[#0E0F11] md:text-[64px] lg:text-[72px]">
              Train With Structure.
            </h1>
            <p className="mt-6 max-w-[62ch] text-[19px] leading-relaxed text-[#4F544D]">
              Generate structured plans, track every session, and stay aligned with your goal — all in one place.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/plan"
                className="inline-flex w-full items-center justify-center rounded-full bg-[#111214] px-7 py-3.5 text-[15px] font-medium text-[#F7F7F6] transition hover:bg-[#1D1F23] sm:w-auto"
              >
                Build My Plan
              </Link>
              <Link
                href="/schedule"
                className="inline-flex w-full items-center justify-center rounded-full border border-[#C9CEC7] bg-transparent px-7 py-3.5 text-[15px] font-medium text-[#14161A] transition hover:bg-[#ECEEEA] sm:w-auto"
              >
                See the Platform
              </Link>
            </div>

            <p className="mt-5 text-[14px] leading-relaxed text-[#646A63]">
              Built for runners, triathletes, and endurance athletes who train with intent.
            </p>
          </div>

          <div className="overflow-hidden rounded-[20px] border border-[#D8DDD6] bg-[#ECEEEA]">
            <Image
              src="/landing/dashboard.png"
              alt="TrainGPT platform overview"
              width={1600}
              height={1100}
              className="h-auto w-full object-cover"
              priority
            />
          </div>
        </section>

        <section className="border-y border-[#DEE2DC] py-5 md:py-6">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#5E645C] md:gap-3">
            {authorityItems.map((item, i) => (
              <div key={item} className="flex items-center gap-3">
                {i > 0 ? <span className="h-[1px] w-5 bg-[#C8CDC6]" /> : null}
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <ProductSection
          id="planning"
          eyebrow="Structured Planning"
          headline="Structured Plans That Progress."
          body="TrainGPT gives you a clear weekly structure that builds toward your race or performance goal. Every block is designed to balance progression, recovery, and consistency."
          bullets={[
            'Periodized training blocks with clear intent',
            'Sessions matched to your current load and target',
            'Weekly progression designed for sustainable improvement',
          ]}
          image="/landing/dashboard.png"
          imageAlt="Structured planning view"
        />

        <ProductSection
          id="execution"
          eyebrow="Clean Execution"
          headline="See Every Session. Clearly."
          body="Your training week is organized in one calm view. Know what to do today, what’s coming next, and where your focus should be."
          bullets={[
            'Calendar-based session layout',
            'Clear workout tags and priorities',
            'Fast visibility into planned vs completed work',
          ]}
          image="/landing/mobile-week.png"
          imageAlt="Clean session view"
          reverse
        />

        <ProductSection
          id="tracking"
          eyebrow="Automatic Tracking"
          headline="Everything in Sync."
          body="Connect Strava and keep your training data aligned automatically. See how your completed work compares to plan, week by week."
          bullets={[
            'Strava-connected session sync',
            'Planned vs completed visibility',
            'Weekly load trends in one place',
          ]}
          image="/landing/mobile-workout.png"
          imageAlt="Automatic tracking view"
        />

        <section className="py-20 md:py-[120px]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6F746C]">Comparison</p>
          <h2 className="mt-3 text-[34px] leading-[1.12] tracking-tight text-[#111214] md:text-[44px]">A More Structured Alternative.</h2>

          <div className="mt-8 overflow-x-auto rounded-[16px] border border-[#D9DDD7] bg-[#F9F9F8]">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#D9DDD7] text-[12px] uppercase tracking-[0.12em] text-[#666C64]">
                  <th className="px-5 py-4 font-medium">Category</th>
                  <th className="px-5 py-4 font-medium">TrainGPT</th>
                  <th className="px-5 py-4 font-medium">Traditional Training Tools</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-[#E2E5E0] last:border-b-0">
                    <td className="px-5 py-5 text-[15px] font-medium text-[#1A1D22]">{row.label}</td>
                    <td className="px-5 py-5 text-[15px] leading-relaxed text-[#2A2F2A]">{row.traingpt}</td>
                    <td className="px-5 py-5 text-[15px] leading-relaxed text-[#50554E]">{row.traditional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-t border-[#DEE2DC] py-20 text-center md:py-[120px]">
          <h2 className="text-[38px] leading-[1.1] tracking-tight text-[#111214] md:text-[54px]">
            Build Your Plan in Under 60 Seconds.
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[16px] text-[#596059]">Free to generate.</p>
          <div className="mt-8">
            <Link
              href="/plan"
              className="inline-flex w-full items-center justify-center rounded-full bg-[#111214] px-8 py-3.5 text-[15px] font-medium text-[#F7F7F6] transition hover:bg-[#1C1F22] sm:w-auto"
            >
              Start Now
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#DEE2DC] py-6">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-center gap-6 px-6 text-[13px] text-[#616860] md:justify-end md:px-8">
          <Link href="/terms" className="hover:text-[#111214]">Terms</Link>
          <Link href="/privacy" className="hover:text-[#111214]">Privacy</Link>
          <a href="mailto:support@traingpt.co" className="hover:text-[#111214]">Contact</a>
        </div>
      </footer>
    </div>
  );
}
