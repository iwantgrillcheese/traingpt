import { NextResponse } from 'next/server';
import { isSameDay, parseISO } from 'date-fns';
import {
  AuthError,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type PlanWeek = {
  days?: Record<string, string[]>;
};

type StravaActivityRow = {
  sport_type?: string | null;
  moving_time?: number | null;
  start_date_local?: string | null;
};

type CompletedSyncRow = {
  user_id: string;
  plan_id: string;
  date: string;
  sport: string;
  status: 'done' | 'missed';
};

function normalizeStravaType(value?: string | null) {
  const normalized = String(value ?? '').toLowerCase();

  if (normalized === 'swim') return 'swim';
  if (normalized === 'run') return 'run';
  if (normalized === 'ride' || normalized === 'virtualride') return 'bike';

  return normalized;
}

function inferSessionType(sessionTitle: string) {
  const normalized = sessionTitle.toLowerCase();

  if (normalized.includes('swim')) return 'swim';
  if (normalized.includes('run')) return 'run';
  if (
    normalized.includes('bike') ||
    normalized.includes('ride') ||
    normalized.includes('cycle')
  ) {
    return 'bike';
  }

  return null;
}

export async function POST() {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    const { data: planData, error: planError } = await supabase
      .from('plans')
      .select('id, plan')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (planError || !planData) {
      console.error('[schedule/status-sync] missing plan:', planError);

      return NextResponse.json(
        { error: 'Missing plan data.' },
        { status: 400 }
      );
    }

    const { data: activities, error: activitiesError } = await supabase
      .from('strava_activities')
      .select('sport_type, moving_time, start_date_local')
      .eq('user_id', user.id);

    if (activitiesError || !activities) {
      console.error('[schedule/status-sync] missing activities:', activitiesError);

      return NextResponse.json(
        { error: 'Missing activity data.' },
        { status: 400 }
      );
    }

    const completedRows: CompletedSyncRow[] = [];
    const planId = String(planData.id);
    const weeks = Array.isArray((planData as any).plan)
      ? ((planData as any).plan as PlanWeek[])
      : [];

    for (const week of weeks) {
      const days = week.days ?? {};

      for (const [date, sessions] of Object.entries(days)) {
        const parsedDate = parseISO(date);

        const dayActivities = (activities as StravaActivityRow[]).filter((activity) => {
          if (!activity.start_date_local) return false;

          try {
            return isSameDay(parsedDate, parseISO(activity.start_date_local));
          } catch {
            return false;
          }
        });

        for (const sessionTitle of sessions) {
          const sessionType = inferSessionType(sessionTitle);
          if (!sessionType) continue;

          const matched = dayActivities.find(
            (activity) => normalizeStravaType(activity.sport_type) === sessionType
          );

          completedRows.push({
            user_id: user.id,
            plan_id: planId,
            date,
            sport: sessionTitle,
            status: matched ? 'done' : 'missed',
          });
        }
      }
    }

    if (completedRows.length === 0) {
      return NextResponse.json({ status: 'ok', updated: 0 });
    }

    const { error } = await supabase
      .from('completed_sessions')
      .upsert(completedRows, {
        onConflict: 'user_id,date,sport',
      });

    if (error) {
      console.error('[schedule/status-sync] upsert failed:', error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: 'ok', updated: completedRows.length });
  } catch (error) {
    console.error('[schedule/status-sync] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to sync schedule status.' },
      { status: 500 }
    );
  }
}