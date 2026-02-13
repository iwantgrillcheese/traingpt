'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 px-6 py-16 text-sm text-gray-600 mt-24">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-4">TRAINGPT</h3>
          <ul className="space-y-2">
            <li>
              <Link href="/about" className="text-sm text-gray-400 hover:text-black transition">
                About this project
              </Link>
            </li>
            <li><Link href="/">Plan Generator</Link></li>
            <li><Link href="/schedule">My Schedule</Link></li>
            <li><Link href="/coaching">Coaching</Link></li>
            <li><Link href="/settings">Settings</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/terms">Terms</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-4">BLOG</h3>
          <ul className="space-y-2">
            <li><Link href="/blog/ai-triathlon-coach">AI Triathlon Coach</Link></li>
            <li><Link href="/blog/70-3-training-plan">70.3 Training Plan</Link></li>
            <li><Link href="/blog/best-triathlon-training-plan">Best Triathlon Training Plan</Link></li>
          </ul>
        </div>

        <div className="flex flex-col items-center justify-center md:items-end">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} TrainGPT. All rights reserved.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Questions or feedback?{' '}
            <a
              href="mailto:hello@traingpt.co"
              className="underline hover:text-black"
            >
              hello@traingpt.co
            </a>
          </p>
          <div className="flex space-x-4 mt-4 text-gray-400">
            <a href="https://www.strava.com/athletes/44311272" target="_blank" rel="noreferrer" aria-label="Strava" className="hover:text-black">Strava</a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube" className="hover:text-black">YouTube</a>
            <a href="https://www.linkedin.com/in/cameronmcdiarmid/" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="hover:text-black">LinkedIn</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub" className="hover:text-black">GitHub</a>
            <a href="https://tiktok.com/xxxstrikerxxx" target="_blank" rel="noreferrer" aria-label="TikTok" className="hover:text-black">TikTok</a>
            <a href="https://discord.com" target="_blank" rel="noreferrer" aria-label="Discord" className="hover:text-black">Discord</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
