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
        className={`fixed top-0 left-0 z-40 h-full bg-white transition-all duration-300
          ${sidebarOpen ? 'w-48 border-r px-4 pt-6' : 'w-0'} 
          sm:w-48 sm:border-r sm:px-4 sm:pt-6`}
      >
        <div className="flex flex-col justify-between h-full">
          <div>
            {/* Only show site name when sidebar is visible */}
            <Link href="/" className={`text-lg font-semibold block mb-6 transition-opacity duration-200 
              ${sidebarOpen ? 'opacity-100' : 'hidden sm:block'}`}>
              TrainGPT
            </Link>

            <nav className="space-y-4 text-sm">
              <Link href="/" className="block hover:font-medium">Plan Generator</Link>
              <Link href="/schedule" className="block hover:font-medium">My Schedule</Link>
              <Link href="/coaching" className="block hover:font-medium">Coaching</Link>
              <Link href="/settings" className="block hover:font-medium">Settings</Link>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Top Bar */}
        <nav className="flex items-center justify-between px-4 py-4 border-b sm:border-none z-30 bg-white sm:pl-56">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-2xl sm:hidden"
          >
            ☰
          </button>
          <div className="ml-auto">
            <ProfileAvatar />
          </div>
        </nav>

        {/* Page Content */}
        <main className="flex-1 px-4 py-8 sm:pl-56">
          {children}
        </main>
      </div>
    </div>
  );
}
