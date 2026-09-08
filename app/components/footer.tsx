import Link from 'next/link';

const productLinks = [
  { href: '/preview', label: 'Plan preview' },
  { href: '/plan', label: 'Plan builder' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/coaching', label: 'Training review' },
];

const resourceLinks = [
  { href: '/free-triathlon-training-plan', label: 'Free triathlon plan' },
  { href: '/free-70-3-training-plan', label: 'Free 70.3 plan' },
  { href: '/free-ironman-training-plan', label: 'Free Ironman plan' },
  { href: '/blog', label: 'All articles' },
];

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-[#fbfaf8] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950 text-xs font-semibold text-white">B</span>
            <span className="text-sm font-semibold tracking-tight text-zinc-950">Brick</span>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-600">Adaptive triathlon training built around your race, your schedule, and the work you actually complete.</p>
          <p className="mt-6 text-xs text-zinc-400">© {new Date().getFullYear()} Brick.</p>
        </div>

        <div className="md:col-span-2 md:col-start-7">
          <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">Product</h3>
          <ul className="mt-4 space-y-3">{productLinks.map((link) => <li key={link.href}><Link href={link.href} className="text-sm text-zinc-600 transition hover:text-zinc-950">{link.label}</Link></li>)}</ul>
        </div>

        <div className="md:col-span-2">
          <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">Resources</h3>
          <ul className="mt-4 space-y-3">{resourceLinks.map((link) => <li key={link.href}><Link href={link.href} className="text-sm text-zinc-600 transition hover:text-zinc-950">{link.label}</Link></li>)}</ul>
        </div>

        <div className="md:col-span-2">
          <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">Company</h3>
          <ul className="mt-4 space-y-3">
            <li><Link href="/about" className="text-sm text-zinc-600 transition hover:text-zinc-950">About</Link></li>
            <li><Link href="/privacy" className="text-sm text-zinc-600 transition hover:text-zinc-950">Privacy</Link></li>
            <li><Link href="/terms" className="text-sm text-zinc-600 transition hover:text-zinc-950">Terms</Link></li>
            <li><a href="mailto:hello@traingpt.co" className="text-sm text-zinc-600 transition hover:text-zinc-950">Contact</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
