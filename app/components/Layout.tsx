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

<button
  onClick={() => setSidebarOpen(!sidebarOpen)}
  aria-label="Toggle sidebar"
  className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
    sidebarOpen ? 'bg-indigo-500' : 'bg-gray-300'
  }`}
>
  <div
    className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
      sidebarOpen ? 'translate-x-6' : 'translate-x-0'
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
  className={`fixed top-0 left-0 z-20 h-full bg-white transition-all duration-300 ease-in-out 
    ${sidebarOpen ? 'w-48 px-6 pt-20' : 'w-0 px-0'} 
    overflow-hidden`}
>
<nav className="flex flex-col justify-center gap-6 text-sm h-full">
    <Link href="/" className="block hover:font-medium">Plan Generator</Link>
    <Link href="/schedule" className="block hover:font-medium">My Schedule</Link>
    <Link href="/coaching" className="block hover:font-medium">Coaching</Link>
    <Link href="/settings" className="block hover:font-medium">Settings</Link>
  </nav>
</aside>


      {/* Main content */}
      <main className="pt-24 px-4 max-w-7xl mx-auto transition-all duration-300">
  {children}
</main>
    </div>
  );
}
