import type { ReactNode } from 'react';
import PlanBuilderTrustPanel from './PlanBuilderTrustPanel';
import PlanBuilderChrome from './PlanBuilderChrome';

export default function PlanLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PlanBuilderChrome><PlanBuilderTrustPanel /></PlanBuilderChrome>
      {children}
    </>
  );
}
