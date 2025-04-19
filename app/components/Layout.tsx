'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen font-sans text-gray-900 bg-white">
      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-4 bg-white border-b border-white sm:justify-start">
        {/* Logo */}
        <Link href="/" className="text-lg font-semibold mr-3">
          TrainGPT
        </Link>

        {/* Toggle Button */}
      <button
  onClick={() => setSidebarOpen(!sidebarOpen)}
  className="relative w-8 h-8 rounded-full border border-gray-300 hover:border-gray-500 transition-all bg-white flex items-center justify-center"
>
  <span className="sr-only">Toggle Sidebar</span>
  <div
    className={`absolute w-0.5 h-4 bg-gray-900 transition-all duration-300 ${
      sidebarOpen ? 'translate-x-1.5' : '-translate-x-1.5'
    }`}
  />
</button>

        {/* Profile (pushed right on desktop) */}
        <div className="ml-auto">
          <ProfileAvatar />
        </div>
      </nav>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-20 h-full bg-white shadow-lg transition-all duration-300 ease-in-out 
          ${sidebarOpen ? 'w-48 px-4 pt-20' : 'w-0 px-0'} 
          overflow-hidden`}
      >
        <nav className="space-y-4 text-sm mt-4">
          <Link href="/" className="block hover:font-medium">Plan Generator</Link>
          <Link href="/schedule" className="block hover:font-medium">My Schedule</Link>
          <Link href="/coaching" className="block hover:font-medium">Coaching</Link>
          <Link href="/settings" className="block hover:font-medium">Settings</Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="pt-20 px-4 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
