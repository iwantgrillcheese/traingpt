import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '');

  if (!accessToken) {
    console.log('[SAVE_PLAN] Missing token');
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.log('[SAVE_PLAN] No user found or error:', userError);
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json();
  const { plan, raceType, raceDate, userNote } = body;

  // 🔍 Debug logs BEFORE the insert
  console.log('[SAVE_PLAN] Incoming data:', {
    user_id: user.id,
    plan,
    race_type: raceType,
    race_date: raceDate,
    note: userNote,
  });

  const { error } = await supabase.from('plans').insert({
    user_id: user.id,
    created_at: new Date().toISOString(),
    plan,
    race_type: raceType,
    race_date: raceDate,
    note: userNote || null,
  });

  if (error) {
    console.error('[SAVE_PLAN_ERROR]', error);
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
