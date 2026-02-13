import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const ALLOWED_EMAILS = ['me@cameronmcdiarmid.com'];

function resetIsAllowedByEnv(): boolean {
  const forceAllow = process.env.ALLOW_DEV_RESET === 'true';
  if (forceAllow) return true;

  // Important: Next.js sets NODE_ENV=production on Vercel Preview too.
  // So we allow non-production when either runtime env is non-prod.
  const nodeNonProd = process.env.NODE_ENV !== 'production';
  const vercelNonProd = process.env.VERCEL_ENV !== 'production';
  return nodeNonProd || vercelNonProd;
}

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!resetIsAllowedByEnv()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Forbidden in production environment. Use a Preview/dev deployment or set ALLOW_DEV_RESET=true explicitly.',
        },
        { status: 403 }
      );
    }

    const email = (user.email || '').toLowerCase();
    if (!ALLOWED_EMAILS.includes(email)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: 'Server is missing Supabase service role configuration' },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userId = user.id;

    const countForUser = async (table: string) => {
      const { count, error } = await admin
        .from(table)
        .select('id', { head: true, count: 'exact' })
        .eq('user_id', userId);
      if (error) throw new Error(`${table}: ${error.message}`);
      return count ?? 0;
    };

    const deleted = {
      completed_sessions: await countForUser('completed_sessions'),
      strava_activities: await countForUser('strava_activities'),
      sessions: await countForUser('sessions'),
      plans: await countForUser('plans'),
    };

    const { error: completedErr } = await admin
      .from('completed_sessions')
      .delete()
      .eq('user_id', userId);
    if (completedErr) throw new Error(`completed_sessions: ${completedErr.message}`);

    const { error: stravaErr } = await admin
      .from('strava_activities')
      .delete()
      .eq('user_id', userId);
    if (stravaErr) throw new Error(`strava_activities: ${stravaErr.message}`);

    const { error: sessionsErr } = await admin.from('sessions').delete().eq('user_id', userId);
    if (sessionsErr) throw new Error(`sessions: ${sessionsErr.message}`);

    const { error: plansErr } = await admin.from('plans').delete().eq('user_id', userId);
    if (plansErr) throw new Error(`plans: ${plansErr.message}`);

    return NextResponse.json({
      ok: true,
      user_id: userId,
      deleted,
    });
  } catch (err: any) {
    console.error('[dev/reset-my-data] failed', err?.message, err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Reset failed' },
      { status: 500 }
    );
  }
}
