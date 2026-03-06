import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { session_date, session_title, clientUserId, undo } = await req.json();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (typeof clientUserId === 'string' && clientUserId && clientUserId !== session.user.id) {
    return NextResponse.json({ error: 'Authentication session mismatch. Please sign in again.' }, { status: 401 });
  }

  if (!session_date || !session_title) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  if (undo === true) {
    const { error: deleteError } = await supabase
      .from('completed_sessions')
      .delete()
      .eq('user_id', session.user.id)
      .eq('date', session_date)
      .eq('session_title', session_title);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, skipped: false });
  }

  const { error: upsertError } = await supabase.from('completed_sessions').upsert(
    {
      user_id: session.user.id,
      date: session_date,
      session_title,
      status: 'skipped',
    },
    { onConflict: 'user_id,date,session_title' }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, skipped: true });
}
