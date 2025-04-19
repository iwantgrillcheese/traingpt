'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen text-gray-900 font-sans antialiased bg-white overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 h-full bg-white transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-48' : 'w-0 sm:w-48'} 
          overflow-hidden border-none`}
      >
        <div className="h-full flex flex-col justify-center gap-6 px-4 pt-10 sm:pt-20 text-sm">
          <Link href="/" className="block hover:font-medium">Plan Generator</Link>
          <Link href="/schedule" className="block hover:font-medium">My Schedule</Link>
          <Link href="/coaching" className="block hover:font-medium">Coaching</Link>
          <Link href="/settings" className="block hover:font-medium">Settings</Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Topbar */}
        <nav className="flex items-center justify-between px-4 py-4 bg-white z-30">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold">TrainGPT</Link>

            {/* Toggle Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-9 h-6 rounded-full border border-gray-500 flex items-center justify-center relative transition-colors duration-300"
              aria-label="Toggle sidebar"
            >
              <div
                className={`w-[2px] h-4 bg-black rounded-sm absolute transition-transform duration-300 ${
                  sidebarOpen ? 'translate-x-2' : '-translate-x-2'
                }`}
              />
            </button>
          </div>

          <ProfileAvatar />
        </nav>

        <main className="flex-1 px-4 py-8 sm:pl-56">{children}</main>
      </div>
    </div>
  );
}
