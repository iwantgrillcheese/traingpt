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

type UpdateSessionPayload = {
  sessionId?: string;
  newDate?: string;
  clientUserId?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    const payload = (await req.json()) as UpdateSessionPayload;

    assertSameUser({
      authenticatedUserId: user.id,
      requestedUserId: payload.clientUserId,
      routeName: 'schedule/update-session',
    });

    const sessionId = payload.sessionId?.trim();
    const newDate = payload.newDate?.trim();

    if (!sessionId || !newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate) || !Number.isFinite(Date.parse(newDate)) || new Date(newDate).toISOString().slice(0,10) !== newDate) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId and newDate are required.' },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabase.from('sessions').select('id,plan_id,sport').eq('id', sessionId).eq('user_id', user.id).single();
    if (sessionError || !session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    if (session.plan_id) {
      const { data: planRow, error: planError } = await supabase.from('plans').select('plan').eq('id', session.plan_id).eq('user_id', user.id).single();
      if (planError) throw planError;
      const params = (planRow?.plan as GeneratedPlan | null)?.params;
      const availability = params ? resolveAthleteContext(params).sportAvailability : undefined;
      if (!sportAllowed(newDate, session.sport ?? '', availability)) return NextResponse.json({ error: 'That day is outside your sport availability.' }, { status: 422 });
    }

    const { error } = await supabase.rpc('move_training_session', { p_session_id: sessionId, p_date: newDate });

    if (error) {
      console.error('[schedule/update-session] update failed:', error);

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[schedule/update-session] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update session.' },
      { status: 500 }
    );
  }
}
