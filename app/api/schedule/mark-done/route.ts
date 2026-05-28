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

    const { error: deleteError } = await supabase
      .from('completed_sessions')
      .delete()
      .eq('user_id', user.id)
      .eq('date', sessionDate)
      .eq('session_title', sessionTitle);

    if (deleteError) {
      console.error('[schedule/mark-done] delete existing failed:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (payload.undo === true) {
      return NextResponse.json({ success: true, completed: false });
    }

    const { error: insertError } = await supabase.from('completed_sessions').insert({
      user_id: user.id,
      date: sessionDate,
      session_title: sessionTitle,
      status: 'done',
    });

    if (insertError) {
      console.error('[schedule/mark-done] insert failed:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, completed: true });
  } catch (error) {
    console.error('[schedule/mark-done] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to update completion status.' },
      { status: 500 }
    );
  }
}
