// /app/api/send-email/signup/route.ts
//
// One-time signup welcome. Triggered by the app shell on authenticated load;
// idempotent server-side: only the request that atomically flips
// profiles.welcome_email_sent_at from NULL claims the send, so tabs, reloads,
// and races can't double-send.

import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { sendSignupWelcomeEmail } from '@/lib/emails/send-signup-welcome-email';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    if (!user.email) {
      return NextResponse.json({ ok: true, skipped: 'no-email' });
    }

    const { data: claimed, error } = await supabase
      .from('profiles')
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('welcome_email_sent_at', null)
      .select('id');

    if (error) throw error;

    if (!claimed?.length) {
      return NextResponse.json({ ok: true, skipped: 'already-sent' });
    }

    await sendSignupWelcomeEmail({ email: user.email });
    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: error.status });
    }
    console.error('[send-email/signup] error', error);
    return NextResponse.json({ ok: false, error: 'Failed to send welcome email' }, { status: 500 });
  }
}
