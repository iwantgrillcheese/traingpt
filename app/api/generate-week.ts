import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { COACH_SYSTEM_PROMPT } from '@/lib/coachPrompt';
import { format } from 'date-fns';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json();
  const { planId, weekIndex } = body;

  if (!planId || weekIndex === undefined) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const supabase = createServerComponentClient({ cookies });

  // Step 1: Get the plan
  const { data: planRow, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (planError || !planRow) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  const {
    race_type,
    race_date,
    experience,
    max_hours,
    rest_day,
    note,
    total_weeks,
    plan,
  } = planRow;

  const startDate = new Date(planRow.start_date);
  const currentWeekStart = new Date(startDate);
  currentWeekStart.setDate(currentWeekStart.getDate() + weekIndex * 7);
  const currentWeekLabel = `Week ${weekIndex + 1} (${format(currentWeekStart, 'MMM d')})`;

  // Step 2: Build prompt
  const userContext = `
Race: ${race_type}
Race Date: ${format(new Date(race_date), 'MMMM d, yyyy')}
Athlete Experience: ${experience}
Max Weekly Hours: ${max_hours}
Preferred Rest Day: ${rest_day}
${note ? `Notes: ${note}` : ''}
`;

  const prompt = `${COACH_SYSTEM_PROMPT}

You are generating week ${weekIndex + 1} out of ${total_weeks}. The date range for this week starts on ${format(currentWeekStart, 'yyyy-MM-dd')}.

Only return a single structured week. Title the week and include 6–7 sessions with clear formatting.

${userContext}
`;

  // Step 3: Call GPT
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'system', content: prompt }],
  });

  const generatedWeek = completion.choices[0].message.content;

  // Step 4: Append to plan array
  const updatedPlan = Array.isArray(plan) ? [...plan, generatedWeek] : [generatedWeek];

  const isFinal = weekIndex + 1 === total_weeks;

  const { error: updateError } = await supabase
    .from('plans')
    .update({
      plan: updatedPlan,
      status: isFinal ? 'ready' : 'pending',
    })
    .eq('id', planId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to save week' }, { status: 500 });
  }

  return NextResponse.json({ weekIndex, success: true, isFinal });
}
