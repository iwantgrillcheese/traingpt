import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import CalendarShell from './CalendarShell';
import { groupSessionsByDate } from '@/utils/calendar';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: sessions,
    error,
  } = await supabase
    .from('sessions')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching sessions:', error.message);
    return <div className="p-6 text-red-600">Failed to load training sessions.</div>;
  }

  const sessionsByDate = groupSessionsByDate(sessions || []);

  return (
    <main className="max-w-screen-xl mx-auto px-4 pt-8">
      <CalendarShell sessionsByDate={sessionsByDate} />
    </main>
  );
}
