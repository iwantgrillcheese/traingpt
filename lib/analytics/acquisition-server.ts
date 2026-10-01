import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { analyticsEnvironment, sourceOf, validateTouch } from './attribution';

export function acquisitionAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Acquisition persistence unavailable');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
  });
}
export function requestEnvironment(request: Request) {
  return analyticsEnvironment(new URL(request.url).hostname, process.env.VERCEL_ENV);
}

export async function associateAccount(user: User, request: Request, input: unknown, consent: boolean) {
  const admin = acquisitionAdmin();
  const environment = requestEnvironment(request);
  const { data: config, error: configError } = await admin.from('acquisition_config').select('started_at').eq('id', true).single();
  if (configError) throw configError;
  const newAccount = Date.parse(user.created_at) >= Date.parse(config.started_at);
  const touch = consent && environment === 'production' && newAccount ? validateTouch(input, user.created_at) : null;
  // INSERT-only: concurrent logins, other devices, and later campaigns cannot
  // replace existing first touch. Historical accounts remain explicitly unknown.
  const { error } = await admin.from('account_acquisition').upsert({
    user_id: user.id, account_created_at: user.created_at, environment,
    first_touch: touch, source: sourceOf(touch),
  }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) throw error;
  const { data: row, error: readError } = await admin.from('account_acquisition').select('*').eq('user_id', user.id).single();
  if (readError) throw readError;
  let emitSignup = false;
  if (consent && newAccount && environment === 'production' && row.environment === 'production') {
    // Persistent atomic claim, across tabs/devices/reloads, not a time heuristic.
    const { data: claimed, error: claimError } = await admin.from('account_acquisition')
      .update({ signup_emitted_at: new Date().toISOString() }).eq('user_id', user.id).is('signup_emitted_at', null).select('user_id');
    if (claimError) throw claimError;
    emitSignup = Boolean(claimed?.length);
  }
  return { first_touch: row.first_touch, source: row.source, emit_signup: emitSignup };
}

export async function recordSavedPlan(user: User, request: Request, planId: string, sessionsCreated: number, hadPlan: boolean) {
  if (requestEnvironment(request) !== 'production') return;
  const admin = acquisitionAdmin();
  const at = new Date().toISOString();
  const { error } = await admin.from('acquisition_saved_plans').insert({ user_id: user.id, plan_id: planId, sessions_created: sessionsCreated, saved_at: at });
  if (error) throw error;
  // Plan save is a product fact, independent of analytics consent. No acquisition
  // source is guessed here, and no failure can undo/block a valid training plan.
  const { error: profileError } = await admin.from('profiles').update({
    first_plan_saved_at: at, discovery_eligible: !hadPlan,
  }).eq('id', user.id).is('first_plan_saved_at', null);
  if (profileError) throw profileError;
}
