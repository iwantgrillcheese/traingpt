'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-white text-gray-900 font-sans antialiased">
      <aside
        className={`fixed top-0 left-0 h-full transition-all duration-300 z-30 bg-white px-4 pt-6 border-r border-transparent ${sidebarOpen ? 'w-48' : 'w-16'}`}
      >
        <div className="flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-8">
              <span className={`text-lg font-semibold transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'} ${sidebarOpen ? 'block' : 'hidden'}`}>
                TrainGPT
              </span>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-2xl focus:outline-none"
              >
                ☰
              </button>
            </div>
            <nav className={`space-y-4 text-sm font-normal transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'} ${sidebarOpen ? 'block' : 'hidden'}`}>
              <Link href="/" className="block hover:font-medium transition">Plan Generator</Link>
              <Link href="/schedule" className="block hover:font-medium transition">My Schedule</Link>
              <Link href="/coaching" className="block hover:font-medium transition">Coaching</Link>
              <Link href="/settings" className="block hover:font-medium transition">Settings</Link>
            </nav>
          </div>
        </div>
      </aside>

      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-48' : 'ml-16'}`}>        
        <nav className="w-full px-6 py-4 flex justify-end bg-white">
<ProfileAvatar />
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </div>
    </div>
  );
}