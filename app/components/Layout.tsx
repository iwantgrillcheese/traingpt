'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen text-gray-900 font-sans antialiased bg-white relative">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full bg-white transition-all duration-300 ease-in-out shadow-none
        ${sidebarOpen ? 'w-48 px-4 pt-6' : 'w-0 px-0 overflow-hidden'}
        sm:w-48 sm:px-4 sm:pt-6`}
      >
        <nav className="flex flex-col justify-center gap-6 text-sm h-full pt-10 sm:pt-20">
          <Link href="/" className="block hover:font-medium">Plan Generator</Link>
          <Link href="/schedule" className="block hover:font-medium">My Schedule</Link>
          <Link href="/coaching" className="block hover:font-medium">Coaching</Link>
          <Link href="/settings" className="block hover:font-medium">Settings</Link>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Topbar */}
        <nav className="flex items-center justify-between px-4 py-4 bg-white z-30">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-semibold">TrainGPT</Link>

            {/* Toggle Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
              className="w-9 h-6 rounded-full border border-gray-400 flex items-center justify-center relative bg-white"
            >
              <span
                className={`block w-1 h-4 bg-black transition-transform duration-300 ${
                  sidebarOpen ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <ProfileAvatar />
        </nav>

        {/* Page Content */}
        <main className="flex-1 px-4 py-8 sm:pl-56">{children}</main>
      </div>
    </div>
  );
}
