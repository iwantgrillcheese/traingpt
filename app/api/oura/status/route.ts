import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { OURA_PROVIDER } from '@/lib/oura';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);

    const [{ data: connection, error: connectionError }, { data: latest, error: latestError }] = await Promise.all([
      supabase
        .from('wearable_connections')
        .select('provider,provider_user_id,connected_at,last_synced_at,scope')
        .eq('user_id', user.id)
        .eq('provider', OURA_PROVIDER)
        .maybeSingle(),
      supabase
        .from('daily_recovery_scores')
        .select('date,readiness_score,sleep_score,activity_score,hrv,resting_hr,updated_at')
        .eq('user_id', user.id)
        .eq('provider', OURA_PROVIDER)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (connectionError) throw connectionError;
    if (latestError) throw latestError;

    return NextResponse.json({
      connected: Boolean(connection),
      connection: connection ?? null,
      latest: latest ?? null,
    });
  } catch (error) {
    console.error('[oura/status] failed:', error);
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Oura status failed.' }, { status: 500 });
  }
}
