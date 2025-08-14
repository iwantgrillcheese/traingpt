// app/api/backfill-sessions/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Service role client (required to bypass RLS for admin backfills)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type InsertRow = {
  user_id: string;
  date: string;      // 'YYYY-MM-DD'
  title: string;
  sport: string | null;
  status: string;    // keep as string; your table may be text or enum
  plan_id: string | null;
  source?: string | null;
};

// Normalize to 'YYYY-MM-DD'
const asISODate = (s: string) => {
  const m = s?.match?.(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!isNaN(d.valueOf())) return d.toISOString().slice(0, 10);
  return '';
};

const detectSport = (title: string): string => {
  const t = (title || '').toLowerCase();
  if (title?.includes('🏊') || t.includes('swim')) return 'Swim';
  if (title?.includes('🚴') || t.includes('bike') || t.includes('ride')) return 'Bike';
  if (title?.includes('🏃') || t.includes('run')) return 'Run';
  if (t.includes('strength')) return 'Strength';
  if (t.includes('rest')) return 'Rest';
  return 'Other';
};

function collectFromPlanShape(plan: any, user_id: string, plan_id: string | null): InsertRow[] {
  const rows: InsertRow[] = [];
  const pushRow = (dateRaw: string, titleRaw: string) => {
    const date = asISODate(dateRaw);
    const title = (titleRaw || '').trim();
    if (!date || !title) return;
    rows.push({
      user_id,
      date,
      title,
      sport: detectSport(title),
      status: 'planned',          // if you use an enum, ensure 'planned' exists or change this value
      plan_id,
      source: 'plan_backfill',
    });
  };

  // Shape A: { days: { 'YYYY-MM-DD': string[] } }
  if (plan && plan.days && typeof plan.days === 'object') {
    for (const [date, arr] of Object.entries(plan.days as Record<string, string[] | undefined>)) {
      if (!Array.isArray(arr)) continue;
      for (const title of arr) pushRow(date, title);
    }
  }

  // Shape B: array of weeks [{ days: {...} }, ...]
  if (Array.isArray(plan)) {
    for (const week of plan) {
      if (!week?.days) continue;
      for (const [date, arr] of Object.entries(week.days as Record<string, string[] | undefined>)) {
        if (!Array.isArray(arr)) continue;
        for (const title of arr) pushRow(date, title);
      }
    }
  }

  return rows;
}

export async function GET(req: NextRequest) {
  // ---- Debug surface: env checks ----
  const envCheck = {
    urlSet: !!process.env.SUPABASE_URL,
    serviceKeySet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // ---- Query params / filters ----
  const dryRun = req.nextUrl.searchParams.get('dry') === '1';
  const onlyNoSessions = req.nextUrl.searchParams.get('onlyNoSessions') === '1';
  const userId = req.nextUrl.searchParams.get('userId') ?? undefined;
  const planIdsCSV = req.nextUrl.searchParams.get('planIds') ?? undefined;

  // Optionally limit to users that have a plan but no sessions (requires helper RPC)
  // See SQL at bottom of this file comment to create the RPC if you don't have it yet.
  let restrictUserIds: string[] | undefined;
  if (onlyNoSessions) {
    const { data: missing, error: rpcErr } = await supabase.rpc('users_with_plan_but_no_sessions');
    if (rpcErr) {
      return NextResponse.json(
        { ok: false, step: 'rpc_users_with_plan_but_no_sessions', error: rpcErr.message, envCheck },
        { status: 500 }
      );
    }
    restrictUserIds = (missing ?? []).map((r: any) => r.user_id);
  }

  // ---- Fetch candidate plans ----
  let q = supabase.from('plans').select('id, user_id, plan').order('created_at', { ascending: false });
  if (userId) q = q.eq('user_id', userId);
  if (planIdsCSV) q = q.in('id', planIdsCSV.split(',').map(s => s.trim()));
  if (restrictUserIds?.length) q = q.in('user_id', restrictUserIds);

  const { data: planRows, error: fetchErr } = await q;
  if (fetchErr) {
    return NextResponse.json({ ok: false, step: 'fetch_plans', error: fetchErr.message, envCheck }, { status: 500 });
  }

  // ---- Backfill loop with detailed debug ----
  let totalCandidates = 0;
  let totalUpserts = 0;
  const perUser: Record<string, { candidates: number; upserts: number }> = {};
  const errorsSample: Array<{ user_id: string; plan_id: string | null; msg: string }> = [];
  const usersWithZeroInserts: Array<{ user_id: string; plan_id: string | null; hint: string }> = [];

  for (const row of planRows ?? []) {
    const extracted = collectFromPlanShape(row.plan, row.user_id, row.id);
    if (!extracted.length) continue;

    // De-dupe within this batch by (user_id, date, title)
    const seen = new Set<string>();
    const batch: InsertRow[] = [];
    for (const s of extracted) {
      const key = `${s.user_id}|${s.date}|${s.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      batch.push(s);
    }

    totalCandidates += batch.length;
    perUser[row.user_id] ??= { candidates: 0, upserts: 0 };
    perUser[row.user_id].candidates += batch.length;

    if (dryRun) continue;

    // Chunked upsert with count + data to ensure we see real numbers
    const CHUNK = 500;
    let userInserted = 0;

    for (let i = 0; i < batch.length; i += CHUNK) {
      const chunk = batch.slice(i, i + CHUNK);
      const { data: upData, error: upErr, count } = await supabase
        .from('sessions')
        .upsert(
          chunk.map(s => ({
            user_id: s.user_id,
            date: s.date,
            title: s.title,
            sport: s.sport,
            status: s.status,           // ensure this matches your enum if using one
            plan_id: s.plan_id,
            source: s.source ?? 'plan_backfill',
          })),
          { onConflict: 'user_id,date,title', ignoreDuplicates: true }
        )
        .select('user_id,date,title', { count: 'exact' });

      if (upErr) {
        if (errorsSample.length < 10) {
          errorsSample.push({ user_id: row.user_id, plan_id: row.id, msg: upErr.message });
        }
        continue;
      }

      const inserted = count ?? upData?.length ?? 0;
      userInserted += inserted;
      totalUpserts += inserted;
      perUser[row.user_id].upserts += inserted;
    }

    if (userInserted === 0 && batch.length > 0 && usersWithZeroInserts.length < 20) {
      usersWithZeroInserts.push({
        user_id: row.user_id,
        plan_id: row.id,
        hint:
          'No new rows inserted. Either all duplicates by (user_id,date,title), RLS blocked (missing service role), or a column constraint (enum/status) failed silently.',
      });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: dryRun ? 'dry-run' : 'upsert',
    usersProcessed: Object.keys(perUser).length,
    totalCandidates,
    totalUpserts,
    perUser,
    envCheck,
    errorsSample,
    usersWithZeroInserts,
    notes: [
      "Upserts use onConflict('user_id,date,title') — ensure a unique index exists on those columns.",
      "If totalUpserts stays 0, check errorsSample and envCheck.serviceKeySet (RLS will block without service role).",
      "If your 'status' column is an enum, verify that 'planned' is a valid value or change it to one that is.",
    ],
  });
}
