// /app/api/backfill-sessions/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SERVICE ROLE client (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Sess = {
  user_id: string;
  plan_id: string | null;
  date: string;     // 'YYYY-MM-DD'
  title: string;
  sport: string | null;
  status: string;   // 'planned' in your table
  created_at?: string;
};

const asISODate = (s: string) => {
  const m = s?.match?.(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  return isNaN(d.valueOf()) ? '' : d.toISOString().slice(0, 10);
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

function extractSessionsFromPlan(plan: any, user_id: string, plan_id: string | null): Sess[] {
  const rows: Sess[] = [];
  const pushRow = (dateRaw: string, titleRaw: string) => {
    const date = asISODate(dateRaw);
    const title = (titleRaw || '').trim();
    if (!date || !title) return;
    rows.push({
      user_id,
      plan_id,
      date,
      title,
      sport: detectSport(title),
      status: 'planned',
      created_at: new Date().toISOString(),
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
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  const userIdFilter = url.searchParams.get('userId') ?? undefined;

  // 1) Get plan_ids that ALREADY have sessions (distinct, not null)
  const { data: sessionPlanIds, error: sessErr } = await supabase
    .from('sessions')
    .select('plan_id')
    .not('plan_id', 'is', null);

  if (sessErr) {
    return NextResponse.json({ ok: false, step: 'fetch_session_plan_ids', error: sessErr.message }, { status: 500 });
  }
  const planIdsWithSessions = new Set<string>(
    (sessionPlanIds ?? []).map((r: any) => r.plan_id).filter(Boolean)
  );

  // 2) Fetch candidate plans (optionally filter by user)
  let plansQuery = supabase.from('plans').select('id, user_id, plan');
  if (userIdFilter) plansQuery = plansQuery.eq('user_id', userIdFilter);
  const { data: plans, error: plansErr } = await plansQuery;
  if (plansErr) {
    return NextResponse.json({ ok: false, step: 'fetch_plans', error: plansErr.message }, { status: 500 });
  }

  // 3) Filter to "orphans": plans with NO sessions yet
  const orphanPlans = (plans ?? []).filter(
    (p) => p?.plan && !planIdsWithSessions.has(p.id)
  );

  // 4) Build rows to insert (dedupe by user_id|date|title)
  let totalCandidates = 0;
  const perPlan: Array<{ plan_id: string; user_id: string; candidates: number; inserted: number }> = [];

  const allRows: Sess[] = [];
  for (const row of orphanPlans) {
    const extracted = extractSessionsFromPlan(row.plan, row.user_id, row.id);
    // de-dupe within the plan
    const seen = new Set<string>();
    const unique = [];
    for (const s of extracted) {
      const key = `${s.user_id}|${s.date}|${s.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(s);
    }
    totalCandidates += unique.length;
    allRows.push(...unique);
    perPlan.push({ plan_id: row.id, user_id: row.user_id, candidates: unique.length, inserted: 0 });
  }

  if (dry || allRows.length === 0) {
    return NextResponse.json({
      ok: true,
      mode: 'dry-run',
      orphanPlans: orphanPlans.length,
      totalCandidates,
      perPlan,
      note: 'No writes performed.',
    });
  }

  // 5) Insert in chunks (we’ll try a straight insert first)
  // If you added a unique index on (user_id,"date",title), you can safely switch to upsert with onConflict.
  const CHUNK = 500;
  let totalInserted = 0;
  const errorsSample: Array<{ msg: string }> = [];

  for (let i = 0; i < allRows.length; i += CHUNK) {
    const chunk = allRows.slice(i, i + CHUNK);
    const { error: insErr, count, data } = await supabase
      .from('sessions')
      .insert(
        chunk.map((s) => ({
          user_id: s.user_id,
          plan_id: s.plan_id,
          date: s.date,
          title: s.title,
          sport: s.sport,
          status: s.status,
          created_at: s.created_at,
        })),
      )
      .select('id', { count: 'exact' });

    if (insErr) {
      if (errorsSample.length < 5) errorsSample.push({ msg: insErr.message });
      // If duplicate key errors appear, swap to UPSERT below:
      // .upsert(..., { onConflict: 'user_id,date,title', ignoreDuplicates: true }).select('id', { count: 'exact' })
    } else {
      const inserted = count ?? data?.length ?? 0;
      totalInserted += inserted;
    }
  }

  // 6) Compute per-plan inserted counts by querying what we just wrote
  //    (efficient enough at this scale)
  for (const p of perPlan) {
    const { data: cData } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', p.plan_id);
    // @ts-ignore count comes on response; supabase-js v2 returns it with head:true
    p.inserted = cData?.length ?? 0; // fallback if driver doesn’t return count here
  }

  return NextResponse.json({
    ok: true,
    mode: 'insert',
    orphanPlans: orphanPlans.length,
    totalCandidates,
    totalInserted,
    perPlan,
    errorsSample,
    tips: [
      'If you see duplicate key errors, add a unique index on (user_id,"date",title) and switch to UPSERT.',
      'Run with ?dry=1 first to preview.',
      'Use ?userId=<uuid> to backfill a single user.',
    ],
  });
}
