import type { ReactNode } from 'react';
import Link from 'next/link';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <nav className="flex w-fit gap-1 rounded-full border border-[#E3E0D8] bg-white p-1 text-sm font-bold text-[#6B7280]">
          <Link href="/settings" className="rounded-full px-4 py-2 hover:bg-[#F7F6F2] hover:text-[#101114]">
            Account
          </Link>
          <Link href="/settings/history" className="rounded-full px-4 py-2 hover:bg-[#F7F6F2] hover:text-[#101114]">
            Plan history
          </Link>
        </nav>
      </div>
      {children}
    </>
  );
}
