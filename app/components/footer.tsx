'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 px-6 py-16 text-sm text-gray-600 mt-24">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-4">TRAINGPT</h3>
          <ul className="space-y-2">
            <li><Link href="/">Plan Generator</Link></li>
            <li><Link href="/schedule">My Schedule</Link></li>
            <li><Link href="/coaching">Coaching</Link></li>
            <li><Link href="/settings">Settings</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-4">BLOG</h3>
          <ul className="space-y-2">
            <li><Link href="/blog/brick-workouts">Brick Workouts</Link></li>
            <li><Link href="/blog/consistency-vs-motivation">Consistency vs Motivation</Link></li>
            <li><Link href="/blog/ai-training-engine">AI Coaching Engine</Link></li>
          </ul>
        </div>

        <div className="flex flex-col items-center justify-center md:items-end">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} TrainGPT. All rights reserved.</p>
          <div className="flex space-x-4 mt-4 text-gray-400">
            <Link href="https://twitter.com" aria-label="Twitter"><span className="hover:text-black">X</span></Link>
            <Link href="https://youtube.com" aria-label="YouTube"><span className="hover:text-black">YouTube</span></Link>
            <Link href="https://linkedin.com" aria-label="LinkedIn"><span className="hover:text-black">LinkedIn</span></Link>
            <Link href="https://github.com" aria-label="GitHub"><span className="hover:text-black">GitHub</span></Link>
            <Link href="https://tiktok.com" aria-label="TikTok"><span className="hover:text-black">TikTok</span></Link>
            <Link href="https://discord.com" aria-label="Discord"><span className="hover:text-black">Discord</span></Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
