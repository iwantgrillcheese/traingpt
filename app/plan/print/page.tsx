import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createRouteSupabaseClient } from '@/lib/supabase/server';
import type { GeneratedPlan } from '@/types/plan';
import type { Session } from '@/types/session';
import { printableWeeks } from '@/utils/printablePlan';
import { resolveAthleteContext } from '@/utils/athleteContext';
import PrintButton from './PrintButton';
import './print.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Print training plan' };

export default async function PrintablePlanPage() {
  const supabase = await createRouteSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: row, error } = await supabase.from('plans').select('id,plan,race_type,race_date').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('Could not load printable plan.');
  if (!row?.plan) return <main className="p-6"><p>No plan to print yet.</p><Link href="/plan">Create a plan</Link></main>;
  const plan = row.plan as GeneratedPlan;
  const { data: sessions, error: sessionsError } = await supabase.from('sessions').select('*').eq('user_id', user.id).eq('plan_id', row.id).order('date');
  if (sessionsError) throw new Error('Could not load plan sessions.');
  const params = resolveAthleteContext(plan.params ?? {} as GeneratedPlan['params']);
  const weeks = printableWeeks(plan, (sessions ?? []) as Session[]);
  return <main className="brick-print mx-auto max-w-5xl bg-white px-4 py-6 text-[#101114] sm:px-8">
    <div className="print-actions mb-6 flex flex-wrap items-center justify-between gap-3"><Link href="/schedule" className="text-sm font-semibold">Back to calendar</Link><PrintButton /></div>
    <header className="mb-8 border-b border-[#101114] pb-4"><h1 className="text-3xl font-black tracking-tight">Brick</h1><p className="mt-1 text-lg font-semibold">Your training plan</p>
      <p className="mt-3">Primary: {params.raceType || row.race_type} · {params.raceDate || row.race_date}</p>
      {params.secondaryEvent ? <p>Secondary: {params.secondaryEvent.raceType} · {params.secondaryEvent.raceDate}</p> : null}
      <p className="mt-2 text-sm">Weekly training budget: {params.maxHours} hours · Experience: {params.experience || 'Not specified'} · Rest day: {params.restDay || 'Default'}</p>
      {params.sportAvailability ? <p className="mt-1 text-sm">Sport availability: {Object.entries(params.sportAvailability).map(([sport, days]) => `${sport}: ${days.join(', ')}`).join(' · ')}</p> : null}
    </header>
    {weeks.map(week => <section key={week.startDate} className="print-week mb-8"><h2 className="mb-3 text-xl font-bold">Week {week.number} · {week.phase}</h2><p className="mb-3 text-sm">{week.startDate} – {week.endDate}</p>
      <table className="w-full border-collapse text-left text-sm"><thead><tr><th>Date / sport</th><th>Workout / details</th><th>Duration</th></tr></thead><tbody>
        {week.sessions.map(session => <tr key={session.id}><td className="align-top"><div>{session.date}</div><div className="capitalize">{session.sport}</div></td><td className="align-top"><strong>{session.title}</strong><p className="mt-1 whitespace-pre-line leading-relaxed">{session.details || 'No additional workout details.'}</p></td><td className="align-top">{session.duration ? `${session.duration} min` : '—'}</td></tr>)}
        {!week.sessions.length ? <tr><td colSpan={3}>No sessions scheduled.</td></tr> : null}
      </tbody></table>
    </section>)}
  </main>;
}
