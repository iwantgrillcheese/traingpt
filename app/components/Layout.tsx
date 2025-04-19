'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans antialiased overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 h-full bg-white transition-all duration-300 ease-in-out 
        ${sidebarOpen ? 'w-48 px-4 pt-6' : 'w-0 px-0'} 
        sm:w-48 sm:px-4 sm:pt-6`}
      >
        <div className="flex flex-col justify-between h-full">
          <div>
            <Link
              href="/"
              className={`text-lg font-semibold mb-8 block transition-opacity duration-200 ${
                sidebarOpen ? 'opacity-100' : 'opacity-0 sm:opacity-100'
              }`}
            >
              TrainGPT
            </Link>

            <nav
              className={`space-y-4 text-sm transition-opacity duration-200 ${
                sidebarOpen ? 'opacity-100' : 'opacity-0 sm:opacity-100'
              }`}
            >
              <Link href="/" className="block hover:font-medium">Plan Generator</Link>
              <Link href="/schedule" className="block hover:font-medium">My Schedule</Link>
              <Link href="/coaching" className="block hover:font-medium">Coaching</Link>
              <Link href="/settings" className="block hover:font-medium">Settings</Link>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Top bar */}
        <nav className="flex items-center justify-between px-4 py-4 bg-white z-30">
          {/* Toggle Button – shows on all screen sizes */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-md w-8 h-8 border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition"
          >
            <div className="w-4 h-[2px] bg-black relative before:content-[''] before:absolute before:-top-1.5 before:w-4 before:h-[2px] before:bg-black after:content-[''] after:absolute after:top-1.5 after:w-4 after:h-[2px] after:bg-black" />
          </button>

          <div className="ml-auto">
            <ProfileAvatar />
          </div>
        </nav>

        <main className="flex-1 px-4 py-8 sm:pl-56">{children}</main>
      </div>
    </div>
  );
}
