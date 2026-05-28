import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createRouteSupabaseClient();
    await requireUser(supabase);

    // This route used to bulk-upsert completed_sessions using columns/constraints
    // that do not exist in the current Supabase schema. Keep it safe for now.
    // Manual mark-done / mark-skip and Strava matching in the schedule page remain active.
    return NextResponse.json({
      status: 'ok',
      updated: 0,
      message: 'Legacy status sync is disabled for the current completed_sessions schema.',
    });
  } catch (error) {
    console.error('[schedule/status-sync] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Failed to sync schedule status.' },
      { status: 500 }
    );
  }
}
