// /app/api/get-session/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function GET(req: Request) {
  const supabase = createServerComponentClient({ cookies });
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('structured_workout')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('❌ Error fetching session:', error);
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
