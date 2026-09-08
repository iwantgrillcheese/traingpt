import type { ReactNode } from 'react';
import StravaFreshnessBanner from './StravaFreshnessBanner';

export default function ScheduleLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StravaFreshnessBanner />
      {children}
    </>
  );
}
