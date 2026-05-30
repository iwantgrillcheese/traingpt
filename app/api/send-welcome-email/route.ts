import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail } from '@/lib/emails/send-welcome-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PlanRow = {
  id: string;
  user_id: string;
  race_type: string | null;
  race_date: string | null;
  plan: any;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name?: string | null;
  name?: string | null;
};

function getAthleteName(profile: ProfileRow | null | undefined) {
  return profile?.full_name || profile?.name || 'Athlete';
}

function getPlanLabel(planRow: PlanRow | null | undefined) {
  const raceType = planRow?.race_type || planRow?.plan?.params?.raceType;
  const raceDate = planRow?.race_date || planRow?.plan?.params?.raceDate;

  if (raceType && raceDate) return `${raceType} plan for ${raceDate}`;
  if (raceType) return `${raceType} training plan`;
  return 'your custom training plan';
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: 'SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured' },
        { status: 500 }
      );
    }

    const { userId, planId } = await req.json();

    if (!userId || !planId) {
      return NextResponse.json({ success: false, error: 'Missing userId or planId' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile?.email) {
      return NextResponse.json({ success: false, error: 'Profile has no email' }, { status: 400 });
    }

    const { data: planRow, error: planError } = await supabase
      .from('plans')
      .select('id, user_id, race_type, race_date, plan')
      .eq('id', planId)
      .eq('user_id', userId)
      .maybeSingle();

    if (planError) throw planError;

    if (!planRow) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    await sendWelcomeEmail({
      to: profile.email,
      name: getAthleteName(profile),
      plan: getPlanLabel(planRow),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-welcome-email] error', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
