'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen text-gray-900 font-sans antialiased overflow-hidden bg-white">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full bg-white transition-all duration-300 ease-in-out
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
              <Link href="/" className="block hover:font-medium">
                Plan Generator
              </Link>
              <Link href="/schedule" className="block hover:font-medium">
                My Schedule
              </Link>
              <Link href="/coaching" className="block hover:font-medium">
                Coaching
              </Link>
              <Link href="/settings" className="block hover:font-medium">
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Topbar */}
        <nav className="flex items-center justify-between px-4 py-4 bg-white z-30">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-md border border-gray-300 hover:border-gray-400 transition p-1 focus:outline-none"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <div className="h-4 w-0.5 bg-black rounded-sm"></div>
            </div>
          </button>
          <div className="ml-auto">
            <ProfileAvatar />
          </div>
        </nav>

        {/* Page content */}
        <main className="flex-1 px-4 py-8 sm:pl-56">{children}</main>
      </div>
    </div>
  );
}
