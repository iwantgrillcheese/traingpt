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
        className={`fixed top-0 left-0 h-full z-30 bg-white transition-all duration-300 
        ${sidebarOpen ? 'w-48 px-4 pt-6' : 'w-0 px-0'} 
        sm:w-48 sm:px-4 sm:pt-6`}
      >
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-lg font-semibold">
            TrainGPT
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-xl sm:hidden"
          >
            ☰
          </button>
        </div>
        <nav className={`space-y-4 text-sm transition-opacity duration-300 ${sidebarOpen || 'sm:block'} ${sidebarOpen ? 'opacity-100' : 'opacity-0 sm:opacity-100'} ${sidebarOpen ? 'block' : 'hidden sm:block'}`}>
          <Link href="/" className="block hover:font-medium">Plan Generator</Link>
          <Link href="/schedule" className="block hover:font-medium">My Schedule</Link>
          <Link href="/coaching" className="block hover:font-medium">Coaching</Link>
          <Link href="/settings" className="block hover:font-medium">Settings</Link>
        </nav>
      </aside>

      {/* Top Nav */}
      <div className={`flex-1 ml-0 sm:ml-48`}>
        <nav className="flex justify-end items-center px-4 py-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-xl sm:hidden mr-auto"
          >
            ☰
          </button>
          <ProfileAvatar />
        </nav>

        {/* Page content */}
        <main className="px-4 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
