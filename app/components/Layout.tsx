'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on escape or click outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div className="relative flex min-h-screen text-gray-900 font-sans antialiased bg-white">
      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full bg-white transform transition-transform duration-300 ease-in-out 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        sm:translate-x-0 sm:relative sm:w-48 sm:border-r sm:border-gray-200`}
      >
        <div className="h-full flex flex-col px-4 pt-6">
          <Link href="/" className="text-lg font-semibold mb-8">TrainGPT</Link>
          <nav className="space-y-4 text-sm">
            <Link href="/" className="block hover:font-medium">Plan Generator</Link>
            <Link href="/schedule" className="block hover:font-medium">My Schedule</Link>
            <Link href="/coaching" className="block hover:font-medium">Coaching</Link>
            <Link href="/settings" className="block hover:font-medium">Settings</Link>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Top bar */}
        <nav className="flex items-center justify-between px-4 py-4 sm:justify-end border-b border-white bg-white z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-md p-2 transition sm:hidden focus:outline-none border border-gray-300 hover:border-gray-400"
          >
            <div className="w-5 h-0.5 bg-black mb-1" />
            <div className="w-5 h-0.5 bg-black" />
          </button>
          <div className="ml-auto sm:ml-0">
            <ProfileAvatar />
          </div>
        </nav>

        <main className="flex-1 px-4 py-8 sm:pl-56">{children}</main>
      </div>
    </div>
  );
}
