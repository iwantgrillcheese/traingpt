import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role to bypass RLS for admin task
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
  const rows: InsertRow[] = [];

  // Shape A: { days: { 'YYYY-MM-DD': string[] } }
  if (plan && plan.days && typeof plan.days === 'object') {
    for (const [date, arr] of Object.entries(plan.days as Record<string, string[] | undefined>)) {
      if (!Array.isArray(arr)) continue;
      for (const title of arr) {
        if (!title || !date) continue;
        rows.push({
          user_id,
          date,
          title,
          sport: detectSport(title),
          status: 'planned',
          plan_id,
          source: 'plan_backfill',
        });
      }
    }
  }

  // Shape B: array of weeks [{ days: {...} }, ...]
  if (Array.isArray(plan)) {
    for (const week of plan) {
      if (!week?.days) continue;
      for (const [date, arr] of Object.entries(week.days as Record<string, string[] | undefined>)) {
        if (!Array.isArray(arr)) continue;
        for (const title of arr) {
          if (!title || !date) continue;
          rows.push({
            user_id,
            date,
            title,
            sport: detectSport(title),
            status: 'planned',
            plan_id,
            source: 'plan_backfill',
          });
        }
      }
    }
  }

  return rows;
}

export async function GET(req: NextRequest) {
  // Filters
  const dryRun = req.nextUrl.searchParams.get('dry') === '1';
  const userId = req.nextUrl.searchParams.get('userId') ?? undefined;
  const planIdsCSV = req.nextUrl.searchParams.get('planIds') ?? undefined; // comma-separated
  const onlyNoSessions = req.nextUrl.searchParams.get('onlyNoSessions') === '1';

  // If onlyNoSessions, fetch the list of user_ids with plans but no sessions
  let limitToUserIds: string[] | undefined;
  if (onlyNoSessions) {
    const { data: missing } = await supabase.rpc('users_with_plan_but_no_sessions'); // optional helper RPC
    limitToUserIds = (missing ?? []).map((r: any) => r.user_id);
  }

  // Build the base query for plans
  let q = supabase.from('plans').select('id, user_id, plan').order('created_at', { ascending: false });

  if (userId) q = q.eq('user_id', userId);
  if (planIdsCSV) q = q.in('id', planIdsCSV.split(',').map(s => s.trim()));
  if (limitToUserIds?.length) q = q.in('user_id', limitToUserIds);

  const { data: planRows, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, step: 'fetch_plans', error: error.message }, { status: 500 });
  }

  let totalCandidates = 0;
  let totalUpserts = 0;
  const perUser: Record<string, { candidates: number; upserts: number }> = {};

  for (const row of planRows ?? []) {
    const extracted = collectFromPlanShape(row.plan, row.user_id, row.id);
    if (!extracted.length) continue;

    // De-dupe within the batch by (user_id, date, title)
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

    // Chunked upsert
    const CHUNK = 500;
    for (let i = 0; i < batch.length; i += CHUNK) {
      const chunk = batch.slice(i, i + CHUNK);
      const { error: upErr, count } = await supabase
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
          { onConflict: 'user_id,date,title', ignoreDuplicates: true, count: 'exact' }
        );
      if (upErr) {
        // keep going; report error inline
        console.error('Upsert error:', upErr.message);
      } else {
        totalUpserts += (count ?? 0);
        perUser[row.user_id].upserts += (count ?? 0);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    mode: dryRun ? 'dry-run' : 'upsert',
    usersProcessed: Object.keys(perUser).length,
    totalCandidates,
    totalUpserts,
    perUser,
    tips: [
      "Add unique constraint on (user_id, date, title) to keep this idempotent.",
      "Use ?onlyNoSessions=1 to target just users with plans but no sessions.",
      "Use ?planIds=csv or ?userId=<uuid> to narrow scope.",
      "Add &dry=1 to preview without writing."
    ],
  });
}
