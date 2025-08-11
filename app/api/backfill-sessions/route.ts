import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role for admin backfill
);

type InsertRow = {
  user_id: string;
  date: string;      // 'YYYY-MM-DD'
  title: string;
  sport: string | null;
  status: 'planned';
  plan_id: string | null;
  source?: string | null;
};

// yyyy-mm-dd or bust
const asISODate = (s: string) => {
  // accept 'YYYY-MM-DD' or ISO timestamp; output 'YYYY-MM-DD'
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!isNaN(d.valueOf())) return d.toISOString().slice(0, 10);
  return ''; // invalid
};

const detectSport = (title: string): string => {
  const t = title.toLowerCase();
  if (title.includes('🏊') || t.includes('swim')) return 'Swim';
  if (title.includes('🚴') || t.includes('bike') || t.includes('ride')) return 'Bike';
  if (title.includes('🏃') || t.includes('run')) return 'Run';
  if (t.includes('strength')) return 'Strength';
  if (t.includes('rest')) return 'Rest';
  return 'Other';
};

function collectFromPlanShape(plan: any, user_id: string, plan_id: string | null): InsertRow[] {
  const pushRow = (rows: InsertRow[], dateRaw: string, titleRaw: string) => {
    const date = asISODate(dateRaw);
    const title = (titleRaw || '').trim();
    if (!date || !title) return;
    rows.push({
      user_id,
      date,
      title,
      sport: detectSport(title),
      status: 'planned',
      plan_id,
      source: 'plan_backfill',
    });
  };

  const rows: InsertRow[] = [];

  // Shape A: { days: { 'YYYY-MM-DD': string[] } }
  if (plan && plan.days && typeof plan.days === 'object') {
    for (const [date, arr] of Object.entries(plan.days as Record<string, string[] | undefined>)) {
      if (!Array.isArray(arr)) continue;
      for (const title of arr) pushRow(rows, date, title);
    }
  }

  // Shape B: array of weeks [{ days: {...} }, ...]
  if (Array.isArray(plan)) {
    for (const week of plan) {
      if (!week?.days) continue;
      for (const [date, arr] of Object.entries(week.days as Record<string, string[] | undefined>)) {
        if (!Array.isArray(arr)) continue;
        for (const title of arr) pushRow(rows, date, title);
      }
    }
  }

  return rows;
}

export async function GET(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get('dry') === '1';
  const onlyNoSessions = req.nextUrl.searchParams.get('onlyNoSessions') === '1';
  const userId = req.nextUrl.searchParams.get('userId') ?? undefined;
  const planIdsCSV = req.nextUrl.searchParams.get('planIds') ?? undefined;

  // Optional: limit to users with plan but no sessions
  let restrictUserIds: string[] | undefined;
  if (onlyNoSessions) {
    const { data: missing } = await supabase.rpc('users_with_plan_but_no_sessions');
    restrictUserIds = (missing ?? []).map((r: any) => r.user_id);
  }

  let q = supabase.from('plans').select('id, user_id, plan').order('created_at', { ascending: false });
  if (userId) q = q.eq('user_id', userId);
  if (planIdsCSV) q = q.in('id', planIdsCSV.split(',').map(s => s.trim()));
  if (restrictUserIds?.length) q = q.in('user_id', restrictUserIds);

  const { data: planRows, error } = await q;
  if (error) return NextResponse.json({ ok: false, step: 'fetch_plans', error: error.message }, { status: 500 });

  let totalCandidates = 0;
  let totalUpserts = 0;
  const perUser: Record<string, { candidates: number; upserts: number }> = {};

  for (const row of planRows ?? []) {
    const extracted = collectFromPlanShape(row.plan, row.user_id, row.id);
    if (!extracted.length) continue;

    // De-dupe within batch by (user_id, date, title)
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

    // Chunked upsert with actual count
    const CHUNK = 500;
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
            status: s.status,
            plan_id: s.plan_id,
            source: s.source ?? 'plan_backfill',
          })),
          { onConflict: 'user_id,date,title', ignoreDuplicates: true }
        )
        .select('user_id,date,title', { count: 'exact' });

      if (upErr) {
        console.error('Upsert error:', upErr.message);
        continue;
      }
      const inserted = count ?? upData?.length ?? 0;
      totalUpserts += inserted;
      perUser[row.user_id].upserts += inserted;
    }
  }

  return NextResponse.json({
    ok: true,
    mode: dryRun ? 'dry-run' : 'upsert',
    usersProcessed: Object.keys(perUser).length,
    totalCandidates,
    totalUpserts,
    perUser,
    note: "Uniqueness is (user_id, date, title). Re-run safe. Use ?onlyNoSessions=1 to target the 85 only.",
  });
}
