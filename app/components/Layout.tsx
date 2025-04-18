'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-white text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-40 h-full bg-white border-r border-gray-200 transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0 w-48 px-4 pt-6' : '-translate-x-full'}
        sm:translate-x-0 sm:relative sm:w-48 sm:px-4 sm:pt-6`}
      >
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-lg font-semibold hidden sm:block">TrainGPT</Link>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-xl sm:hidden">☰</button>
        </div>
        <nav className="space-y-4 text-sm">
          <Link href="/" className="block hover:font-medium">Plan Generator</Link>
          <Link href="/schedule" className="block hover:font-medium">My Schedule</Link>
          <Link href="/coaching" className="block hover:font-medium">Coaching</Link>
          <Link href="/settings" className="block hover:font-medium">Settings</Link>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top bar */}
        <nav className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-white sticky top-0 z-20">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-2xl sm:hidden"
          >
            ☰
          </button>
          <ProfileAvatar />
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
