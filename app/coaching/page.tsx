import { Suspense } from 'react';
import CoachingClient from './CoachingClient';

export default function CoachingPage() {
  return (
    <Suspense fallback={<div>Loading coach...</div>}>
      <CoachingClient />
    </Suspense>
  );
}
