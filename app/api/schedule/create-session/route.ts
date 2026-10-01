import { NextResponse } from 'next/server';
import { sportAllowed } from '@/utils/sportAvailability';
import { resolveAthleteContext } from '@/utils/athleteContext';
import type { GeneratedPlan } from '@/types/plan';
import {
  AuthError,
  assertSameUser,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type CreateSessionPayload = {
  date?: string;
  sport?: string;
  title?: string;
  duration?: number | string | null;
  details?: string | null;
  clientUserId?: string | null;
  plan_id?: string | null;
  planId?: string | null;
};

function parseDuration(value: CreateSessionPayload['duration']) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    const payload = (await req.json()) as CreateSessionPayload;

    assertSameUser({
      authenticatedUserId: user.id,
      requestedUserId: payload.clientUserId,
      routeName: 'schedule/create-session',
    });

    const date = payload.date?.trim();
    const sport = payload.sport?.trim();
    const title = payload.title?.trim();

    if (!date || !sport || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: date, sport, and title are required.' },
        { status: 400 }
      );
    }

    const planId = payload.plan_id ?? payload.planId ?? null;
    const planQuery = supabase.from('plans').select('id,plan').eq('user_id', user.id);
    const { data: planRow, error: planError } = planId
      ? await planQuery.eq('id', planId).maybeSingle()
      : await planQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (planError) throw planError;
    if (planId && !planRow) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
    const params = (planRow?.plan as GeneratedPlan | null)?.params;
    const availability = params ? resolveAthleteContext(params).sportAvailability : undefined;
    if (!sportAllowed(date, sport, availability)) {
      return NextResponse.json({ error: 'That day is outside your sport availability.' }, { status: 422 });
    }

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      date,
      sport,
      title,
      duration: parseDuration(payload.duration),
      details: payload.details?.trim() || null,
    };

    if (planId) {
      insertPayload.plan_id = planId;
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[schedule/create-session] insert failed:', error);

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ session: data });
  } catch (error) {
    console.error('[schedule/create-session] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create session.' },
      { status: 500 }
    );
  }
}
