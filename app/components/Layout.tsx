'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-white text-gray-900 font-sans antialiased relative">
      {/* Sidebar */}
      <aside
        className={`fixed sm:relative top-0 left-0 z-30 bg-white transition-all duration-300 border-r border-gray-200
          ${sidebarOpen ? 'w-48 px-4 pt-6' : 'w-0 px-0 pt-0 overflow-hidden'} 
          sm:w-48 sm:px-4 sm:pt-6 sm:block`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="text-lg font-semibold hidden sm:block">
              TrainGPT
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-2xl sm:hidden"
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

      {/* Main Content */}
      <div className={`flex-1 sm:ml-48`}>
        {/* Top Nav */}
        <nav className="fixed top-0 left-0 w-full flex justify-between items-center px-4 py-4 bg-white border-b z-20 sm:justify-end">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-2xl sm:hidden"
          >
            ☰
          </button>
          <ProfileAvatar />
        </nav>

        {/* Page Content */}
        <main className="max-w-7xl mx-auto px-4 py-6 pt-20 sm:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
