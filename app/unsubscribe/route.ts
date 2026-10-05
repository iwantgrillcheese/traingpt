import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { unsubscribe } from '@/lib/emails/unsubscribe';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function confirmation(message: string, status: number) {
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Email preferences | TrainGPT</title></head><body style="font-family:Arial,sans-serif;color:#202124;margin:0"><main style="max-width:560px;margin:80px auto;padding:24px"><h1>Email preferences</h1><p>${message}</p><a href="/settings" style="color:#202124">Manage email settings</a></main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" } });
}
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return confirmation('This unsubscribe link is invalid or expired. Please manage your preferences in Settings.', 400);
  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Email preferences are not configured');
    const category = await unsubscribe(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), token);
    if (!category) return confirmation('This unsubscribe link is invalid or expired. Please manage your preferences in Settings.', 400);
    return confirmation(`You are unsubscribed from ${category === 'daily' ? 'daily workout emails' : 'weekly training briefs'}. You can re-enable them in Settings.`, 200);
  } catch {
    return confirmation('We could not save your preference. Please try this link again shortly.', 503);
  }
}
