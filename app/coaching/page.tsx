import { Suspense } from 'react';
import CoachingClient from './CoachingClient';

export const dynamic = 'force-dynamic';

function CoachingFallback() {
  return (
    <div className="p-6 text-sm text-zinc-500">
      Loading coaching dashboard…
    </div>
  );
}

export default function CoachingPage() {
  return (
    <Suspense fallback={<CoachingFallback />}>
      <CoachingClient />
    </Suspense>
  );
}
