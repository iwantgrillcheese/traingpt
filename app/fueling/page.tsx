import Link from 'next/link';

const feedItems = [
  {
    title: 'Training Day Carbs',
    detail: 'Choose gels, chews, or drink mix that match your target carbs per hour.',
  },
  {
    title: 'Hydration + Electrolytes',
    detail: 'Select sodium and fluid products based on sweat rate and weather.',
  },
  {
    title: 'Recovery Stack',
    detail: 'Include post-workout carbs + protein to improve next-session readiness.',
  },
];

export default function FuelingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fueling Hub</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Order fueling products for your training block
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Use your detailed workout fueling targets to build a product list before key sessions.
          Feed.com can handle fulfillment while TrainGPT handles the recommendations.
        </p>

        <ul className="mt-6 space-y-3">
          {feedItems.map((item) => (
            <li key={item.title} className="rounded-xl border border-black/5 bg-zinc-50/70 p-4">
              <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{item.detail}</p>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href="https://feed.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition"
          >
            Shop on Feed.com
          </a>
          <Link
            href="/settings"
            className="inline-flex rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition"
          >
            Back to settings
          </Link>
        </div>
      </div>
    </main>
  );
}
