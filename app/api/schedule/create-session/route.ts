import { NextResponse } from 'next/server';
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