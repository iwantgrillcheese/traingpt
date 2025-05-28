'use client';
import { useSearchParams } from 'next/navigation';
import CoachingDashboard from '../components/CoachingDashboard';

export default function CoachingClient() {
  const params = useSearchParams();
  const q = params.get('q') || '';

  return <CoachingDashboard prefill={q} />;
}
