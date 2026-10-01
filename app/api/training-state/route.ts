import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { adaptNextWeek } from '@/utils/adaptNextWeek';
import { sessionIsComplete } from '@/utils/sessionCompletion';
import mergeSessionsWithStrava from '@/utils/mergeSessionWithStrava';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import type { GeneratedPlan } from '@/types/plan';
import type { TrainingPause } from '@/utils/trainingPause';

export const dynamic = 'force-dynamic';
const isoDate = (date: unknown): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date;

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);
    const body = await req.json();
    if (!isoDate(body.date)) return NextResponse.json({ error: 'Choose a valid local date.' }, { status: 400 });
    const { data: planRow, error: planError } = await supabase.from('plans').select('id, plan').eq('user_id', user.id).eq('id', body.plan_id).single();
    if (planError || !planRow) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
    if (body.action === 'pause') {
      if (!['sick', 'injured', 'travel', 'life'].includes(body.reason)) return NextResponse.json({ error: 'Choose a pause reason.' }, { status: 400 });
      if (body.expected_return_date && (!isoDate(body.expected_return_date) || body.expected_return_date < body.date)) return NextResponse.json({ error: 'Return date must be on or after the pause date.' }, { status: 400 });
      const { error } = await supabase.from('training_pauses').insert({ user_id: user.id, plan_id: planRow.id,
        reason: body.reason, started_date: body.date, expected_return_date: body.expected_return_date || null });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }
    if (body.action !== 'resume' || !['normal', 'ease'].includes(body.mode)) return NextResponse.json({ error: 'Choose how to resume.' }, { status: 400 });
    const { data: pause, error: pauseError } = await supabase.from('training_pauses').select('*').eq('plan_id', planRow.id).eq('user_id', user.id).eq('status', 'paused').single();
    if (pauseError || !pause) return NextResponse.json({ error: 'No active pause found.' }, { status: 409 });
    const original = planRow.plan as GeneratedPlan;
    const plan = JSON.parse(JSON.stringify(original)) as GeneratedPlan;
    const updates: Array<{ id: string; expected_date: string; expected_title: string; title: string; duration?: number; details?: string; raw: unknown }> = [];
    if (body.mode === 'ease') {
      const [{ data: sessions, error: sessionsError }, { data: completions, error: completionError }, { data: activities, error: activityError }] = await Promise.all([
        supabase.from('sessions').select('*').eq('plan_id', planRow.id).eq('user_id', user.id),
        supabase.from('completed_sessions').select('*').eq('user_id', user.id),
        supabase.from('strava_activities').select('id,strava_id,sport_type,start_date,start_date_local,moving_time,distance').eq('user_id', user.id).gte('start_date', body.date),
      ]);
      if (sessionsError || completionError || activityError) throw sessionsError ?? completionError ?? activityError;
      const { merged } = mergeSessionsWithStrava((sessions ?? []) as Session[], (activities ?? []) as StravaActivity[], 'America/Los_Angeles', completions ?? []);
      const daysSince = (date: string) => Math.round((Date.parse(date + 'T12:00:00Z') - Date.parse(body.date + 'T12:00:00Z')) / 86400000);
      for (const row of merged) {
        const offset = daysSince(row.date);
        const raw = (sessions ?? []).find(s => s.id === row.id)?.raw ?? {};
        if (offset < 0 || offset >= 14 || row.strava_id || sessionIsComplete(row, completions ?? [])
          || !['swim','bike','run','strength'].includes(row.sport.toLowerCase()) || raw.type === 'race_day') continue;
        const result = adaptNextWeek({ nextWeek: { label: 'Return', phase: 'Recovery', startDate: row.date, deload: false,
          days: { [row.date]: [{ ...raw, sport: row.sport.toLowerCase(), title: row.title, durationMinutes: row.duration ?? raw.durationMinutes, details: row.details ?? undefined }] } },
          inputs: { plannedCount: 0, completedCount: 0, complianceRatio: 1, missedAnchors: [], nextWeekIsRaceWeek: false,
            nextWeekDeload: false, easeBackIn: true, easeVolumeFactor: offset < 7 ? 0.75 : 0.9 } });
        const item = result.week.days[row.date][0];
        if (typeof item === 'string') continue;
        updates.push({ id: row.id, expected_date: row.date, expected_title: row.title, title: item.title ?? row.title, duration: item.durationMinutes, details: item.details, raw: item });
      }
      // Session rows own moved dates. Mirror them rather than restoring stale
      // plan-JSON dates during a return adjustment; completed history is intact.
      const byId = new Map(updates.map(update => [update.id, update]));
      for (const week of plan.weeks) for (const date of Object.keys(week.days)) {
        week.days[date] = (sessions ?? []).filter(row => row.date === date).map(row => {
          const update = byId.get(row.id);
          return update ? update.raw as Exclude<typeof week.days[string][number], string> : {
            ...row.raw, sport: row.sport, title: row.title, durationMinutes: row.duration, details: row.details,
          };
        });
        if (plan.days) plan.days[date] = week.days[date];
      }
    }
    const { error } = await supabase.rpc('resume_training', { p_pause_id: (pause as TrainingPause).id, p_date: body.date, p_mode: body.mode,
      p_original_plan: original, p_plan: plan, p_session_updates: updates });
    if (error) throw error;
    return NextResponse.json({ success: true, adjusted_sessions: updates.length });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[training-state]', error);
    return NextResponse.json({ error: 'Could not update training state. Refresh and try again.' }, { status: 409 });
  }
}
