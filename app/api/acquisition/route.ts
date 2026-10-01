import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { acquisitionAdmin, associateAccount, requestEnvironment } from '@/lib/analytics/acquisition-server';
import { DISCOVERY_OPTIONS } from '@/lib/analytics/attribution';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireUser(await createRouteSupabaseClient(request));
    const { data, error } = await acquisitionAdmin().from('profiles')
      .select('discovery_eligible,discovery_source,discovery_answered_at,discovery_skipped_at').eq('id', user.id).single();
    if (error) throw error;
    return NextResponse.json({ eligible: data.discovery_eligible && !data.discovery_answered_at && !data.discovery_skipped_at });
  } catch (error) {
    return NextResponse.json({ error: 'Discovery unavailable' }, { status: error instanceof AuthError ? 401 : 503 });
  }
}

export async function POST(request: Request) {
  try {
    // Cookie-authenticated writes must originate from this application.
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    if (Number(request.headers.get('content-length') || 0) > 10000) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    const user = await requireUser(await createRouteSupabaseClient(request));
    const body = await request.json();
    const consent = body.analytics_consent === true;
    if (body.action === 'associate') return NextResponse.json(await associateAccount(user, request, body.touch, consent));
    const admin = acquisitionAdmin();
    if (body.action === 'schedule') {
      if (consent && requestEnvironment(request) === 'production') {
        const { error } = await admin.from('acquisition_schedule_days').upsert({ user_id: user.id, used_on: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }, { onConflict: 'user_id,used_on', ignoreDuplicates: true });
        if (error) throw error;
      }
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'discovery' || body.action === 'skip_discovery') {
      const skip = body.action === 'skip_discovery';
      if (!skip && !DISCOVERY_OPTIONS.some(([value]) => value === body.source)) return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
      const detail = typeof body.detail === 'string' ? body.detail.trim().slice(0, 200) : null;
      const updates = skip ? { discovery_skipped_at: new Date().toISOString() } : {
        discovery_source: body.source, discovery_detail: detail || null, discovery_answered_at: new Date().toISOString(),
      };
      // One response per account; concurrent submissions return saved=false.
      const { data, error } = await admin.from('profiles').update(updates).eq('id', user.id)
        .eq('discovery_eligible', true).is('discovery_answered_at', null).is('discovery_skipped_at', null).select('id');
      if (error) throw error;
      return NextResponse.json({ saved: Boolean(data?.length), emit_event: !skip && consent && requestEnvironment(request) === 'production' && Boolean(data?.length) });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.warn('[acquisition] persistence failed');
    return NextResponse.json({ error: 'Acquisition unavailable' }, { status: error instanceof AuthError ? 401 : 503 });
  }
}
