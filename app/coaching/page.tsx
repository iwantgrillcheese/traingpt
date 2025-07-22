import { Suspense } from 'react';
import CoachingClient from './CoachingClient';
import Footer from '../components/footer';

export default function CoachingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        <Suspense fallback={<div>Loading coach...</div>}>
          <CoachingClient />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
