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
  className="ml-2 flex items-center justify-center w-8 h-5 rounded-full border border-gray-400 transition-colors duration-300 bg-white hover:border-gray-500"
>
  <div
    className={`w-0.5 h-3 bg-black transition-transform duration-300 ${
      sidebarOpen ? 'translate-x-[6px]' : 'translate-x-[-6px]'
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
  className={`fixed top-0 left-0 z-30 h-full bg-white transition-all duration-300 ease-in-out shadow-none ${
  sidebarOpen ? 'w-48 px-6' : 'w-0 px-0 overflow-hidden'
} sm:w-48 sm:px-6`}

      >
        <nav className="flex flex-col justify-center gap-6 text-sm h-full pt-10 sm:pt-20">
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
