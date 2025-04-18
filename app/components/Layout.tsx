'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-30 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0 w-48 px-4 pt-6' : '-translate-x-full w-0 px-0 pt-0'}
        sm:translate-x-0 sm:w-48 sm:px-4 sm:pt-6`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="text-lg font-semibold hidden sm:block">
              TrainGPT
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="sm:hidden text-xl"
            >
              ☰
            </button>
          </div>
          <nav className="space-y-4 text-sm font-normal">
            <Link href="/" className="block hover:font-medium transition">Plan Generator</Link>
            <Link href="/schedule" className="block hover:font-medium transition">My Schedule</Link>
            <Link href="/coaching" className="block hover:font-medium transition">Coaching</Link>
            <Link href="/settings" className="block hover:font-medium transition">Settings</Link>
          </nav>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Nav */}
        <nav className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-white sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="sm:hidden text-xl"
          >
            ☰
          </button>
          <ProfileAvatar />
        </nav>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
