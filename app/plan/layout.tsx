import type { ReactNode } from 'react';
import PlanBuilderTrustPanel from './PlanBuilderTrustPanel';

export default function PlanLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlanBuilderTrustPanel />
      {children}
    </>
  );
}
