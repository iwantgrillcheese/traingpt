'use client';

import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-gray-800">
    <h1 className="text-4xl font-bold mb-10">About This Project</h1>
  
    <section className="mb-12">
      <h2 className="text-xl font-semibold mb-2">Why This Exists</h2>
      <p className="text-gray-700 leading-relaxed">
      I’m a triathlete who was training for my fourth 70.3 and trying to get a bit faster. I wasn’t ready or training seriously enough to justify hiring a coach, so I used ChatGPT to help build my plan. It worked reasonably well but definitely not ideal.
      </p>
      <p className="text-gray-700 leading-relaxed mt-4">
        When I started training again for Santa Cruz 70.3, I figured I’d clean it up. That’s what this is:
      </p>
      <ul className="list-disc list-inside mt-4 text-gray-700">
        <li>Generate structured triathlon training plans based on your inputs </li>
        <li>Sync them into a schedule you can actually follow & track in one place</li>
        <li>Get feedback without re-explaining everything every time</li>
      </ul>
    </section>
  
    <section className="mb-12">
      <h2 className="text-xl font-semibold mb-2">Who This Is For</h2>
      <p className="text-gray-700 leading-relaxed">
        If you&apos;re training for a triathlon and don’t have a coach or don’t want to pay for one—this might help. It definitely won’t replace a great coach, but it should be more useful than a static PDF plan. You’ll get a personalized schedule, the ability to track your sessions, and that ability to get live feedback on specific sessions. 
      </p>
    </section>
  
    <section className="mb-12">
      <h2 className="text-xl font-semibold mb-2">What to Expect</h2>
      <p className="text-gray-700 leading-relaxed">
        I’m not a developer by trade and I&apos;ve never built a website. I used ChatGPT to write the code and spent about 50-ish hours after my day job over two weeks to get a V1 out. 
      </p>
      <p className="text-gray-700 leading-relaxed mt-4">
        I’ll probably keep making it better if people find it useful so if you do, let me know. If something’s broken, just email me at <a href="mailto:me@cameronmmcdiarmid.com" className="underline hover:text-black">me@cameronmmcdiarmid.com</a> or DM me on Strava.
      </p>
    </section>
  
    <div className="text-sm text-gray-500">
      <Link href="/" className="underline hover:text-black">← Back to homepage</Link>
    </div>
  </main>  
  );
}
