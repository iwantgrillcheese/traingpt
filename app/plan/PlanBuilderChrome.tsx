'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function PlanBuilderChrome({ children }: { children: ReactNode }) {
  return usePathname() === '/plan/print' ? null : <>{children}</>;
}
