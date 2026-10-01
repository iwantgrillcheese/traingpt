import { NextResponse } from 'next/server';
import { AuthError, assertSameUser, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export async function setSessionCompletion(req: Request, status: 'done' | 'skipped') {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);
    const payload = await req.json();
    assertSameUser({ authenticatedUserId: user.id, requestedUserId: payload.clientUserId, routeName: 'schedule/completion' });
    let query = supabase.from('sessions').select('id, date, title').eq('user_id', user.id);
    if (typeof payload.session_id === 'string' && payload.session_id) query = query.eq('id', payload.session_id);
    else if (typeof payload.session_date === 'string' && typeof payload.session_title === 'string') {
      query = query.eq('date', payload.session_date).eq('title', payload.session_title);
    } else return NextResponse.json({ error: 'Choose a session to complete.' }, { status: 400 });
    const { data: sessions, error } = await query;
    if (error) throw error;
    if (sessions?.length !== 1) return NextResponse.json({ error: 'Session not found or ambiguous. Refresh the schedule.' }, { status: 404 });
    const session = sessions[0];
    const { data: completedAt, error: saveError } = await supabase.rpc('set_session_completion', {
      p_session_id: session.id, p_status: status, p_undo: payload.undo === true,
    });
    if (saveError) throw saveError;
    return NextResponse.json({ success: true, completed: status === 'done' && payload.undo !== true,
      skipped: status === 'skipped' && payload.undo !== true, session_id: session.id, completed_at: completedAt });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[schedule/completion]', error);
    return NextResponse.json({ error: 'Could not save session status.' }, { status: 500 });
  }
}
