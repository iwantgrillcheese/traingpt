'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true); // always user controlled

  return (
    <div className="flex min-h-screen bg-white text-gray-900 font-sans antialiased">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 h-full bg-white border-r border-gray-200 transition-all duration-300 
        ${sidebarOpen ? 'w-48 px-4 pt-6' : 'w-16 px-2 pt-6'} 
        sm:relative`}
      >
        <div className="flex flex-col justify-between h-full">
          <div>
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
                className="text-2xl focus:outline-none"
              >
                ☰
              </button>
            </div>
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
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 min-h-screen transition-all duration-300 ${sidebarOpen ? 'sm:ml-48' : 'sm:ml-16'}`}>
        <nav className="fixed top-0 left-0 w-full px-4 py-4 flex justify-between items-center bg-white z-20 border-b sm:justify-end sm:static">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-2xl focus:outline-none"
          >
            ☰
          </button>
          <ProfileAvatar />
        </nav>

        <main className="max-w-7xl mx-auto px-4 py-6 pt-20 sm:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
