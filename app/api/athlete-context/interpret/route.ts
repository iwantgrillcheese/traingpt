import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { ATHLETE_CONTEXT_PROMPT, ATHLETE_CONTEXT_SCHEMA, guardSportPreferences } from '@/utils/athleteContextExtraction';
import { validateAthleteContext } from '@/utils/athleteContext';

export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(req: Request) {
  try {
    await requireUser(await createRouteSupabaseClient(req));
    const { notes } = await req.json();
    if (typeof notes !== 'string' || notes.length > 6000) return NextResponse.json({ error: 'Enter comments of up to 6,000 characters.' }, { status: 400 });
    if (!notes.trim()) return NextResponse.json({ context: {} });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'Comment interpretation is temporarily unavailable. Please retry.' }, { status: 503 });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20000, maxRetries: 0 });
    const result = await client.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0, max_tokens: 2500,
      messages: [{ role: 'system', content: ATHLETE_CONTEXT_PROMPT }, { role: 'user', content: notes }],
      response_format: { type: 'json_schema', json_schema: { name: 'athlete_context_v1', strict: true, schema: ATHLETE_CONTEXT_SCHEMA } },
    });
    const choice = result.choices[0];
    if (choice?.finish_reason !== 'stop' || choice.message.refusal || !choice.message.content) return NextResponse.json({ error: 'We could not interpret these comments. Please retry or clarify the wording.' }, { status: 422 });
    return NextResponse.json({ context: guardSportPreferences(validateAthleteContext(JSON.parse(choice.message.content)), notes) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: error.status });
    // Do not log provider payloads containing personal athlete notes.
    return NextResponse.json({ error: 'Comment interpretation failed. Please retry.' }, { status: 503 });
  }
}
