'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-white text-gray-900 font-sans antialiased">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 h-full bg-white border-r border-gray-200 transition-all duration-300
        ${sidebarOpen ? 'w-48 px-4' : 'w-16 px-2'}
        sm:relative`}
      >
        <div className="flex flex-col h-full pt-6">
          {/* Top logo + toggle */}
          <div className="flex items-center justify-between mb-8">
            <Link href="/">
              <span className={`text-lg font-semibold transition-opacity duration-300
                ${sidebarOpen ? 'opacity-100' : 'opacity-0'}
                sm:block hidden`}>
                TrainGPT
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-2xl sm:block"
            >
              ☰
            </button>
          </div>

          {/* Nav items */}
          <nav className={`space-y-4 text-sm font-normal transition-opacity duration-300
            ${sidebarOpen ? 'opacity-100 block' : 'opacity-0 hidden'}
            sm:block`}
          >
            <Link href="/" className="block hover:font-medium transition">Plan Generator</Link>
            <Link href="/schedule" className="block hover:font-medium transition">My Schedule</Link>
            <Link href="/coaching" className="block hover:font-medium transition">Coaching</Link>
            <Link href="/settings" className="block hover:font-medium transition">Settings</Link>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 min-h-screen transition-all duration-300 ${sidebarOpen ? 'sm:ml-48' : 'sm:ml-16'}`}>
        <nav className="fixed top-0 left-0 w-full px-4 py-4 flex justify-end items-center bg-white z-20 border-b">
          <ProfileAvatar />
        </nav>

        <main className="max-w-7xl mx-auto px-4 py-6 pt-20 sm:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
