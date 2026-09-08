import type { ReactNode } from 'react';
import ReadinessMethodBanner from './ReadinessMethodBanner';

export default function CoachingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ReadinessMethodBanner />
      {children}
    </>
  );
}
