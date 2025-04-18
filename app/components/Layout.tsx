'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-white text-gray-900 font-sans antialiased overflow-x-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 h-screen bg-white transition-all duration-300
          ${sidebarOpen ? 'w-48 px-4 pt-6' : 'w-0 px-0 pt-0'}
          sm:w-48 sm:relative sm:px-4 sm:pt-6 sm:border-r sm:block`}
      >
        <div className="flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-8">
              <Link
                href="/"
                className={`text-lg font-semibold transition-opacity duration-300 
                  ${sidebarOpen ? 'opacity-100' : 'opacity-0'} 
                  sm:opacity-100 sm:block hidden`}
              >
                TrainGPT
              </Link>
              {/* Hamburger for sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-2xl focus:outline-none sm:hidden"
              >
                ☰
              </button>
            </div>
            <nav
              className={`space-y-4 text-sm font-normal transition-opacity duration-300 
                ${sidebarOpen ? 'opacity-100 block' : 'opacity-0 hidden'} 
                sm:opacity-100 sm:block`}
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
      <div className={`flex-1 min-h-screen transition-all duration-300 ${sidebarOpen ? 'ml-48' : 'ml-0'} sm:ml-48`}>
        <nav className="fixed top-0 left-0 w-full flex justify-between items-center bg-white px-4 py-4 z-20 sm:justify-end">
          {/* Desktop toggle hamburger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-2xl focus:outline-none sm:block"
          >
            ☰
          </button>
          <ProfileAvatar />
        </nav>

        <main className="pt-20 px-4 sm:pt-8 max-w-7xl mx-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
