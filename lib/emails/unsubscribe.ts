import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EmailCategory = 'daily' | 'weekly';
export const preferenceColumns = { daily: 'daily_email_opt_in', weekly: 'weekly_email_opt_in' } as const;
const lifetime = 365 * 24 * 60 * 60;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function sign(payload: string) {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('EMAIL_UNSUBSCRIBE_SECRET must contain at least 32 bytes');
  return createHmac('sha256', secret).update(payload).digest();
}
export function createUnsubscribeToken(userId: string, category: EmailCategory, now = Math.floor(Date.now() / 1000)) {
  if (!uuid.test(userId) || (category !== 'daily' && category !== 'weekly')) throw new Error('Invalid unsubscribe recipient/category');
  const payload = Buffer.from(JSON.stringify({ v: 1, sub: userId, category, exp: now + lifetime })).toString('base64url');
  return `${payload}.${sign(payload).toString('base64url')}`;
}
export function verifyUnsubscribeToken(token: string, now = Math.floor(Date.now() / 1000)): { userId: string; category: EmailCategory } | null {
  if (token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
  const expected = sign(parts[0]);
  const signature = Buffer.from(parts[1], 'base64url');
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (data.v !== 1 || typeof data.sub !== 'string' || !uuid.test(data.sub) ||
        (data.category !== 'daily' && data.category !== 'weekly') || !Number.isSafeInteger(data.exp) || data.exp <= now) return null;
    return { userId: data.sub, category: data.category };
  } catch { return null; }
}
export function createUnsubscribeUrl(userId: string, category: EmailCategory) {
  const url = new URL('/unsubscribe', process.env.EMAIL_SITE_URL || 'https://traingpt.co');
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('EMAIL_SITE_URL must use HTTPS');
  url.searchParams.set('token', createUnsubscribeToken(userId, category));
  return url.toString();
}
export async function unsubscribe(supabase: SupabaseClient, token: string) {
  const recipient = verifyUnsubscribeToken(token);
  if (!recipient) return null;
  const { data, error } = await supabase.from('profiles')
    .update({ [preferenceColumns[recipient.category]]: false }).eq('id', recipient.userId).select('id').maybeSingle();
  if (error) throw new Error('Unable to save email preference');
  return data ? recipient.category : null;
}
export async function isTrainingEmailEnabled(supabase: SupabaseClient, userId: string, email: string, category: EmailCategory) {
  const { data, error } = await supabase.from('profiles').select('id').eq('id', userId).eq('email', email)
    .eq(preferenceColumns[category], true).maybeSingle();
  if (error) throw new Error('Unable to check email preference');
  return Boolean(data);
}
