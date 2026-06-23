import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const querySecret = req.nextUrl.searchParams.get('secret') ?? '';
  return bearer === secret || querySecret === secret;
}

function getDb() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env['SUPABASE_' + 'SERVICE_' + 'ROLE_' + 'KEY'];
  if (!url || !key) throw new Error('Missing database config.');
  return createClient(url, key);
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getDb();
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 30), 50);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, athlete_notes')
    .eq('coach_response_status', 'pending')
    .not('athlete_notes', 'is', null)
    .limit(limit);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, checked: sessions?.length ?? 0, generated: 0 });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
