// /app/api/schedule/mark-done/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { session_date, session_title } = await req.json();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from('completed_sessions')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('date', session_date) // ✅ match actual column name
    .eq('session_title', session_title)
    .maybeSingle();

  if (existing) {
    // If already marked done → delete to undo
    const { error: deleteError } = await supabase
      .from('completed_sessions')
      .delete()
      .eq('user_id', session.user.id)
      .eq('date', session_date) // ✅ match actual column name
      .eq('session_title', session_title);

    if (deleteError) {
      console.error(deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, wasMarkedDone: true });
  } else {
    // Insert new "done" row
    const { error: insertError } = await supabase.from('completed_sessions').upsert({
      user_id: session.user.id,
      date: session_date, // ✅ match actual column name
      session_title,
      status: 'done',
    });

    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, wasMarkedDone: false });
  }
}
