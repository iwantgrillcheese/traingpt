'use client';

type WeeklyIntentCardProps = {
  weekRangeLabel: string;
  phase?: string | null;
  bullets: string[];
  ctaHref?: string;
  ctaLabel?: string;
  checkInHref?: string;
  checkInLabel?: string;
};

export default function WeeklyIntentCard({
  weekRangeLabel,
  phase,
  bullets,
  ctaHref = '#',
  ctaLabel = 'Open weekly coaching',
  checkInHref,
  checkInLabel = 'Start weekly check-in',
}: WeeklyIntentCardProps) {
  return (
    <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">This Week</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">Weekly Intent</h3>
          <p className="mt-1 text-sm text-gray-600">{weekRangeLabel}</p>
        </div>
        <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700">
          {phase || 'Phase loading...'}
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-sm text-gray-700">
        {bullets.slice(0, 3).map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={ctaHref}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {ctaLabel}
        </a>

        {checkInHref && (
          <a
            href={checkInHref}
            className="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            {checkInLabel}
          </a>
        )}
      </div>
    </section>
  );
}
