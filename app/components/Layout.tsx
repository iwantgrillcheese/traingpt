'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-white text-gray-900 font-sans antialiased">
      {/* Sidebar */}
      <aside
        className={`fixed sm:relative top-0 left-0 z-30 h-screen sm:h-auto bg-white border-r transition-all duration-300 ${
          sidebarOpen ? 'w-48 px-4 pt-6' : 'w-0 px-0 pt-6'
        } sm:w-48 sm:px-4`}
      >
        <div className="flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-8">
              <span
                className={`text-lg font-semibold transition-opacity duration-300 ${
                  sidebarOpen || 'sm:block'
                } ${sidebarOpen ? 'opacity-100' : 'opacity-0 sm:opacity-100'} ${
                  sidebarOpen ? 'block' : 'hidden sm:block'
                }`}
              >
                TrainGPT
              </span>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-2xl focus:outline-none sm:hidden"
              >
                ☰
              </button>
            </div>
            <nav
              className={`space-y-4 text-sm font-normal transition-opacity duration-300 ${
                sidebarOpen ? 'opacity-100 block' : 'opacity-0 hidden'
              } sm:opacity-100 sm:block`}
            >
              <Link href="/" className="block hover:font-medium transition">Plan Generator</Link>
              <Link href="/schedule" className="block hover:font-medium transition">My Schedule</Link>
              <Link href="/coaching" className="block hover:font-medium transition">Coaching</Link>
              <Link href="/settings" className="block hover:font-medium transition">Settings</Link>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`flex-1 transition-all duration-300 ${
          sidebarOpen ? 'sm:ml-48' : ''
        }`}
      >
        {/* Top nav bar */}
        <nav className="fixed sm:static top-0 left-0 w-full px-4 py-4 flex justify-between items-center bg-white border-b z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-2xl focus:outline-none sm:hidden"
          >
            ☰
          </button>
          <div className="ml-auto">
            <ProfileAvatar />
          </div>
        </nav>

        {/* Page content */}
        <main className="max-w-7xl mx-auto px-4 py-6 mt-16 sm:mt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
