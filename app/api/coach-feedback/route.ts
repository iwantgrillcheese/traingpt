import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { startOfWeek, endOfWeek, formatISO } from 'date-fns';
import { OpenAI } from 'openai';

import { computeCompliance } from '@/utils/computeCompliance';
import { buildWeeklyComparison } from '@/utils/buildWeeklyComparison';
import { buildWeeklyCoachPrompt } from '@/utils/buildWeeklyCoachPrompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user_id = user.id;
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekStartStr = formatISO(weekStart, { representation: 'date' });
  const weekEndStr = formatISO(weekEnd, { representation: 'date' });

  const [{ data: sessions = [] }, { data: strava = [] }, { data: profile }] = await Promise.all([
    supabase.from('sessions')
      .select('*')
      .eq('user_id', user_id)
      .gte('date', weekStartStr)
      .lte('date', weekEndStr),
    supabase.from('strava_activities')
      .select('*')
      .eq('user_id', user_id)
      .gte('start_date', weekStartStr)
      .lte('start_date', weekEndStr),
    supabase.from('profiles')
      .select('bike_ftp, run_threshold, swim_css, pace_units')
      .eq('id', user_id)
      .single(),
  ]);

  const baseline = {
    bike_ftp: profile?.bike_ftp,
    run_threshold: profile?.run_threshold,
    swim_css: profile?.swim_css,
    pace_units: profile?.pace_units || 'mile',
  };

  // ✅ Correct args passed
  const comparisons = buildWeeklyComparison(sessions ?? [], strava ?? [], baseline);
  const prompt = buildWeeklyCoachPrompt(comparisons, baseline, weekStartStr);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a world-class triathlon coach who writes detailed, helpful weekly summaries.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    if (!summary) return NextResponse.json({ error: 'No summary returned' }, { status: 500 });

    const { error } = await supabase.from('weekly_summaries').insert([
      {
        user_id,
        week_start_date: weekStartStr,
        summary_text: summary,
      },
    ]);

    if (error) console.error('⚠️ Could not insert weekly summary:', error.message);

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('❌ GPT error:', err);
    return NextResponse.json({ error: 'GPT failed' }, { status: 500 });
  }
}
