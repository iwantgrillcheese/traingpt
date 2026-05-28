import { NextResponse } from 'next/server';
import {
  AuthError,
  assertSameUser,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type MarkDonePayload = {
  session_date?: string;
  session_title?: string;
  clientUserId?: string | null;
  undo?: boolean;
  session_id?: string | null;
  sessionId?: string | null;
  strava_id?: string | null;
  stravaId?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    const payload = (await req.json()) as MarkDonePayload;

    assertSameUser({
      authenticatedUserId: user.id,
      requestedUserId: payload.clientUserId,
      routeName: 'schedule/mark-done',
    });

    const sessionDate = payload.session_date?.trim();
    const sessionTitle = payload.session_title?.trim();

    if (!sessionDate || !sessionTitle) {
      return NextResponse.json(
        { error: 'Missing required fields: session_date and session_title are required.' },
        { status: 400 }
      );
    }

    const sessionId = payload.session_id ?? payload.sessionId ?? null;
    const stravaId = payload.strava_id ?? payload.stravaId ?? null;
    const shouldUndo = payload.undo === true;

    if (shouldUndo) {
      let deleteQuery = supabase
        .from('completed_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('date', sessionDate)
        .eq('session_title', sessionTitle);

      if (sessionId) {
        deleteQuery = deleteQuery.eq('session_id', sessionId);
      }

      const { error: deleteError } = await deleteQuery;

      if (deleteError) {
        console.error('[schedule/mark-done] delete failed:', deleteError);

        return NextResponse.json(
          { error: deleteError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, completed: false });
    }

    const upsertPayload: Record<string, unknown> = {
      user_id: user.id,
      date: sessionDate,
      session_title: sessionTitle,
      status: 'done',
    };

    if (sessionId) {
      upsertPayload.session_id = sessionId;
    }

    if (stravaId) {
      upsertPayload.strava_id = stravaId;
    }

    const { error: upsertError } = await supabase
      .from('completed_sessions')
      .upsert(upsertPayload, {
        onConflict: 'user_id,date,session_title',
      });

    if (upsertError) {
      console.error('[schedule/mark-done] upsert failed:', upsertError);

      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, completed: true });
  } catch (error) {
    console.error('[schedule/mark-done] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update completion status.' },
      { status: 500 }
    );
  }
}