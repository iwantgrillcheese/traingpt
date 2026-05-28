import { NextResponse } from 'next/server';
import {
  AuthError,
  assertSameUser,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type MarkSkipPayload = {
  session_date?: string;
  session_title?: string;
  clientUserId?: string | null;
  undo?: boolean;
  session_id?: string | null;
  sessionId?: string | null;
};

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    const payload = (await req.json()) as MarkSkipPayload;

    assertSameUser({
      authenticatedUserId: user.id,
      requestedUserId: payload.clientUserId,
      routeName: 'schedule/mark-skip',
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

    if (payload.undo === true) {
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
        console.error('[schedule/mark-skip] delete failed:', deleteError);

        return NextResponse.json(
          { error: deleteError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, skipped: false });
    }

    const upsertPayload: Record<string, unknown> = {
      user_id: user.id,
      date: sessionDate,
      session_title: sessionTitle,
      status: 'skipped',
    };

    if (sessionId) {
      upsertPayload.session_id = sessionId;
    }

    const { error: upsertError } = await supabase
      .from('completed_sessions')
      .upsert(upsertPayload, {
        onConflict: 'user_id,date,session_title',
      });

    if (upsertError) {
      console.error('[schedule/mark-skip] upsert failed:', upsertError);

      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, skipped: true });
  } catch (error) {
    console.error('[schedule/mark-skip] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update skipped status.' },
      { status: 500 }
    );
  }
}