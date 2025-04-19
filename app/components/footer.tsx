'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 px-6 py-16 text-sm text-gray-600 mt-24">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Left Column */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-4">TrainGPT</h3>
          <ul className="space-y-2">
            <li><Link href="/" className="hover:text-black transition">Plan Generator</Link></li>
            <li><Link href="/schedule" className="hover:text-black transition">My Schedule</Link></li>
            <li><Link href="/coaching" className="hover:text-black transition">Coaching</Link></li>
            <li><Link href="/settings" className="hover:text-black transition">Settings</Link></li>
            <li><Link href="/about" className="hover:text-black transition">About this project</Link></li>
          </ul>
        </div>

        {/* Middle Column */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-4">Blog</h3>
          <ul className="space-y-2">
            <li><Link href="/blog/brick-workouts" className="hover:text-black transition">Brick Workouts</Link></li>
            <li><Link href="/blog/consistency-vs-motivation" className="hover:text-black transition">Consistency vs Motivation</Link></li>
            <li><Link href="/blog/ai-training-engine" className="hover:text-black transition">AI Coaching Engine</Link></li>
          </ul>
        </div>

        {/* Right Column */}
        <div className="flex flex-col items-center justify-center md:items-end">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} TrainGPT. All rights reserved.</p>
          <div className="flex space-x-4 mt-4 text-gray-400">
            <Link href="https://twitter.com" aria-label="Twitter" className="hover:text-black transition">X</Link>
            <Link href="https://youtube.com" aria-label="YouTube" className="hover:text-black transition">YouTube</Link>
            <Link href="https://linkedin.com" aria-label="LinkedIn" className="hover:text-black transition">LinkedIn</Link>
            <Link href="https://github.com" aria-label="GitHub" className="hover:text-black transition">GitHub</Link>
            <Link href="https://tiktok.com" aria-label="TikTok" className="hover:text-black transition">TikTok</Link>
            <Link href="https://discord.com" aria-label="Discord" className="hover:text-black transition">Discord</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
