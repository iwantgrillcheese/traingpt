import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { OURA_PROVIDER } from '@/lib/oura';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);

    const { error: scoresError } = await supabase
      .from('daily_recovery_scores')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', OURA_PROVIDER);

    if (scoresError) throw scoresError;

    const { error: connectionError } = await supabase
      .from('wearable_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', OURA_PROVIDER);

    if (connectionError) throw connectionError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[oura/disconnect] failed:', error);
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Oura disconnect failed.' }, { status: 500 });
  }
}
