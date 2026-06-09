// /app/api/enrich-week/route.ts
//
// Enriches a single week of an already-saved (scaffold-first) triathlon plan.
// The scaffold is the source of truth for structure, dates, durations, and
// zone targets. This route asks the LLM to upgrade ONLY the `details` text of
// each session — adding concrete prescriptions and week-over-week continuity
// ("last week 3x8' at threshold, this week 3x10'") — then writes the enriched
// details back to both the plan JSON and the sessions table.
//
// Design constraints:
// - One week per call (fast, fits serverless budgets, client drives sequencing).
// - Idempotent: re-running a week simply re-enriches it.
// - Fail-safe: if the model output is invalid, the scaffold details stay.

import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { AuthError, assertSameUser, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { stripUnsupportedParams } from '@/utils/openaiSafeParams';
import type { GeneratedPlan, WeekJson } from '@/types/plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type StructuredSession = {
  sport?: string;
  title?: string;
  details?: string;
  type?: string;
  durationMinutes?: number;
  priority?: string;
  purpose?: string;
  intensity?: string;
  coachNote?: string;
};

type EnrichedSessionOut = {
  date: string;
  sport: string;
  title: string;
  details: string;
};

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.trim()) throw new Error('OPENAI_API_KEY is missing');
  return new OpenAI({ apiKey: key });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asStructuredSessions(items: unknown): StructuredSession[] {
  return Array.isArray(items) ? items.filter(isPlainRecord) as StructuredSession[] : [];
}

/** Compact summary of the previous week's key sessions for progression context. */
function summarizePrevWeek(prev: WeekJson | undefined): string {
  if (!prev || !isPlainRecord(prev.days)) return 'This is the first week of the plan. Establish baselines; do not reference a previous week.';

  const lines: string[] = [];
  for (const [date, items] of Object.entries(prev.days)) {
    for (const item of asStructuredSessions(items)) {
      const priority = String(item.priority ?? '');
      const isKey = priority === 'anchor' || priority === 'key';
      const title = String(item.title ?? '');
      if (!isKey && !/long ride|long run|brick|threshold|quality/i.test(title)) continue;
      const dur = Number(item.durationMinutes ?? 0);
      const firstDetail = String(item.details ?? '').split('\n').find((l) => /workout:/i.test(l)) ?? '';
      lines.push(`- ${date} ${title}${dur ? ` (${dur}min)` : ''}${firstDetail ? ` — ${firstDetail.replace(/workout:\s*/i, '').slice(0, 140)}` : ''}`);
    }
  }

  return lines.length
    ? `Previous week (${prev.label}, ${prev.phase}${prev.deload ? ', deload' : ''}) key sessions:\n${lines.join('\n')}`
    : `Previous week was ${prev.label} (${prev.phase}${prev.deload ? ', deload' : ''}).`;
}

const ENRICH_SYSTEM_PROMPT = `
You are a world-class triathlon coach refining an already-structured training week.

The week's structure is FINAL: dates, sports, titles, session types, and durations must not change.
Your only job is to rewrite each session's "details" so it reads like a real coach wrote it.

Each details value MUST:
- Keep this exact four-line structure:
Purpose: <one sentence on why this session exists in this phase>
Workout: <executable prescription: warmup, main set, cooldown, with durations/distances>
Intensity: <concrete targets using the athlete's numbers: watts ranges, pace ranges, swim send-offs; include RPE as fallback>
Coach note: <one or two sentences; when a previous-week key session is provided, reference the progression from it>
- Use the athlete's FTP / threshold pace / swim pace to write NUMERIC targets. Never write only "easy" or "moderate" when numbers are available.
- Write swim main sets as actual sets (e.g. 8x100 @ 1:45 send-off, r15) — never "45min endurance swim".
- Fit the prescribed durationMinutes. Do not make sessions harder or longer than prescribed.
- No motivational filler. No markdown. Plain text with the four labeled lines.

Return ONLY valid JSON:
{"sessions":[{"date":"YYYY-MM-DD","sport":"...","title":"...","details":"..."}]}
Return exactly one entry per session slot you were given, with date/sport/title copied verbatim.
`.trim();

function buildEnrichUserPrompt({
  plan,
  week,
  weekIndex,
  prevSummary,
}: {
  plan: GeneratedPlan;
  week: WeekJson;
  weekIndex: number;
  prevSummary: string;
}) {
  const p = plan.params ?? ({} as GeneratedPlan['params']);
  const slots: Array<Record<string, unknown>> = [];

  for (const [date, items] of Object.entries(week.days ?? {})) {
    for (const item of asStructuredSessions(items)) {
      slots.push({
        date,
        sport: item.sport ?? '',
        title: item.title ?? '',
        type: item.type ?? '',
        priority: item.priority ?? '',
        durationMinutes: item.durationMinutes ?? null,
        currentDetails: item.details ?? '',
      });
    }
  }

  return `
## Athlete
- Race: ${p.raceType} on ${p.raceDate}
- Experience: ${p.experience ?? 'unknown'}
- Max weekly hours: ${p.maxHours}
- Bike FTP: ${p.bikeFTP ?? p.bikeFtp ?? 'unknown'} watts
- Run threshold pace: ${p.runPace ?? 'unknown'}
- Swim threshold pace: ${p.swimPace ?? 'unknown'} per 100m
- Athlete notes: ${p.athleteNotes?.trim() || 'none'}

## Week being enriched
- ${week.label} (${week.phase}${week.deload ? ', deload' : ''}), week ${weekIndex + 1} of ${plan.weeks?.length ?? '?'}
- Start date: ${week.startDate}

## ${prevSummary}

## Session slots (structure is final — rewrite "details" only)
${JSON.stringify(slots, null, 2)}
`.trim();
}

function validDetails(text: unknown): text is string {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 60) return false;
  if (!/purpose:/i.test(t) || !/workout:/i.test(t)) return false;
  if (!/\d/.test(t)) return false; // must contain at least one concrete number
  return true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const planId = typeof body?.planId === 'string' ? body.planId : '';
    const weekIndex = Number.isInteger(body?.weekIndex) ? Number(body.weekIndex) : -1;
    const clientUserId = typeof body?.clientUserId === 'string' ? body.clientUserId : '';

    if (!planId || weekIndex < 0) {
      return NextResponse.json({ ok: false, error: 'planId and weekIndex are required' }, { status: 400 });
    }

    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    assertSameUser({ authenticatedUserId: user.id, requestedUserId: clientUserId || null, routeName: 'enrich-week' });

    const { data: planRow, error: planError } = await supabase
      .from('plans')
      .select('id, user_id, plan')
      .eq('id', planId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (planError || !planRow?.plan) {
      return NextResponse.json({ ok: false, error: 'Plan not found' }, { status: 404 });
    }

    const plan = planRow.plan as GeneratedPlan;

    if (plan.planType !== 'triathlon') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Only triathlon plans use post-generation enrichment.' });
    }

    const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];
    const week = weeks[weekIndex];
    if (!week || !isPlainRecord(week.days)) {
      return NextResponse.json({ ok: false, error: `Week ${weekIndex} not found` }, { status: 404 });
    }

    const prevSummary = summarizePrevWeek(weeks[weekIndex - 1]);
    const model = process.env.ENRICH_MODEL ?? process.env.PLAN_MODEL ?? 'gpt-4o';
    const openai = getOpenAI();

    let enriched: EnrichedSessionOut[] = [];
    try {
      const resp = await openai.chat.completions.create(
        stripUnsupportedParams({
          model,
          top_p: 1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: ENRICH_SYSTEM_PROMPT },
            { role: 'user', content: buildEnrichUserPrompt({ plan, week, weekIndex, prevSummary }) },
          ],
        })
      );
      const parsed = JSON.parse(resp.choices[0]?.message?.content ?? '{}');
      enriched = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    } catch (error) {
      console.error('[enrich-week] LLM call failed; keeping scaffold details', {
        planId,
        weekIndex,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ ok: true, enrichedCount: 0, kept: 'scaffold' });
    }

    // Apply enriched details onto matching slots only. Anything unmatched or
    // invalid keeps its deterministic scaffold details.
    const updates: Array<{ date: string; sport: string; title: string; details: string }> = [];
    let enrichedCount = 0;

    for (const [date, items] of Object.entries(week.days)) {
      const sessions = asStructuredSessions(items);
      for (const session of sessions) {
        const match = enriched.find(
          (e) =>
            isPlainRecord(e) &&
            String(e.date) === date &&
            String(e.sport ?? '').toLowerCase() === String(session.sport ?? '').toLowerCase() &&
            String(e.title ?? '').trim().toLowerCase() === String(session.title ?? '').trim().toLowerCase()
        );
        if (match && validDetails(match.details)) {
          session.details = match.details.trim();
          updates.push({ date, sport: String(session.sport ?? ''), title: String(session.title ?? ''), details: session.details });
          enrichedCount += 1;
        }
      }
      week.days[date] = sessions as any;
    }

    // Persist plan JSON with enrichment progress metadata.
    const metadata = isPlainRecord(plan.metadata) ? plan.metadata : {};
    const enrichment = isPlainRecord(metadata.enrichment) ? metadata.enrichment : {};
    const enrichedWeeks = Array.isArray((enrichment as any).enrichedWeeks) ? (enrichment as any).enrichedWeeks : [];
    if (!enrichedWeeks.includes(weekIndex)) enrichedWeeks.push(weekIndex);

    plan.weeks = weeks;
    plan.metadata = {
      ...metadata,
      enrichment: {
        ...(enrichment as Record<string, unknown>),
        enrichedWeeks,
        pending: enrichedWeeks.length < weeks.length,
        updatedAt: new Date().toISOString(),
      },
    } as GeneratedPlan['metadata'];

    // Rebuild the flattened days map for the enriched week's dates.
    if (isPlainRecord(plan.days)) {
      for (const [date, items] of Object.entries(week.days)) {
        (plan.days as Record<string, unknown[]>)[date] = items as unknown[];
      }
    }

    const { error: saveError } = await supabase
      .from('plans')
      .update({ plan })
      .eq('id', planId)
      .eq('user_id', user.id);

    if (saveError) {
      console.error('[enrich-week] failed to save plan JSON', saveError);
      return NextResponse.json({ ok: false, error: 'Failed to save enriched week' }, { status: 500 });
    }

    // Mirror enriched details onto sessions rows so calendar/Today views update.
    for (const update of updates) {
      const { data: rows } = await supabase
        .from('sessions')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('plan_id', planId)
        .eq('date', update.date)
        .eq('sport', update.sport.toLowerCase());

      const candidates = Array.isArray(rows) ? rows : [];
      const target =
        candidates.length === 1
          ? candidates[0]
          : candidates.find((r) => String(r.title ?? '').trim().toLowerCase() === update.title.trim().toLowerCase());

      if (target?.id) {
        await supabase.from('sessions').update({ details: update.details }).eq('id', target.id);
      }
    }

    return NextResponse.json({
      ok: true,
      weekIndex,
      enrichedCount,
      totalSlots: updates.length,
      pendingWeeks: weeks.length - enrichedWeeks.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: error.status });
    }
    console.error('[enrich-week] unexpected error', error);
    return NextResponse.json({ ok: false, error: 'Failed to enrich week' }, { status: 500 });
  }
}
