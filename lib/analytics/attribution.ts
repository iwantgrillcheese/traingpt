export const TOUCH_COOKIE = 'brick_first_touch_v1';
export const TOUCH_KEY = 'brick:first-touch:v1';
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
export const DISCOVERY_OPTIONS = [
  ['search', 'Google/search'], ['reddit', 'Reddit'], ['strava', 'Strava'],
  ['social', 'Instagram/social'], ['friend_coach', 'Friend/coach'],
  ['ai', 'ChatGPT/another AI tool'], ['other', 'Other'],
] as const;
export type DiscoverySource = typeof DISCOVERY_OPTIONS[number][0];
export type FirstTouch = {
  version: 1;
  landing_url: string;
  landing_path: string;
  captured_at: string;
  external_referrer: string | null;
  referring_domain: string | null;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

export function ownDomain(host: string) {
  return ['traingpt.co'].some(domain => host === domain || host.endsWith(`.${domain}`)) || host.endsWith('.vercel.app') || host.endsWith('.supabase.co');
}
export function excludedReferrer(host: string) {
  return ownDomain(host) || ['accounts.google.com', 'oauth.googleusercontent.com', 'login.microsoftonline.com', 'appleid.apple.com'].includes(host);
}
export function productionHost(host: string) {
  return host === 'traingpt.co' || host === 'www.traingpt.co';
}
export function analyticsEnvironment(host: string, deployment?: string) {
  return productionHost(host) && deployment !== 'preview' && deployment !== 'development' ? 'production' : 'test';
}
// URLs are an allowlist: never retain arbitrary query strings, fragments, credentials,
// OAuth callback paths, or user-specific path segments.
export function safePath(path: string) {
  if (/^\/(auth|api)(\/|$)/.test(path)) return '/';
  return path.split('/').map(segment => /^[a-z][a-z0-9-]{0,70}$/i.test(segment) ? segment : segment ? ':id' : '').join('/').slice(0, 300) || '/';
}
export function safeUrl(raw: string, keepUtm = false): string | null {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const safe = new URL(safePath(url.pathname), url.origin);
    if (keepUtm) for (const key of UTM_KEYS) {
      const value = url.searchParams.get(key)?.trim().slice(0, 150);
      if (value && !/[\u0000-\u001f]/.test(value)) safe.searchParams.set(key, value);
    }
    return safe.toString();
  } catch { return null; }
}
export function captureTouch(rawUrl: string, rawReferrer: string, now = new Date()): FirstTouch | null {
  const url = new URL(rawUrl);
  // Auth, login and private product routes cannot establish a new acquisition touch.
  if (/^\/(auth|api|login|schedule|settings|coaching|payment)(\/|$)/.test(url.pathname)) return null;
  const landing = safeUrl(rawUrl, true);
  if (!landing) return null;
  let referrer: string | null = null;
  let domain: string | null = null;
  try {
    const ref = new URL(rawReferrer);
    if (!excludedReferrer(ref.hostname)) {
      domain = ref.hostname;
      // Origin alone is sufficient evidence and avoids personal referrer paths.
      referrer = ref.origin + '/';
    }
  } catch { /* Direct or browser-suppressed referrer. */ }
  const touch: FirstTouch = { version: 1, landing_url: landing, landing_path: safePath(url.pathname), captured_at: now.toISOString(), external_referrer: referrer, referring_domain: domain };
  const clean = new URL(landing);
  for (const key of UTM_KEYS) {
    const value = clean.searchParams.get(key);
    if (value && !(key === 'utm_source' && excludedReferrer(value.toLowerCase()))) touch[key] = value;
  }
  // Rebuild from the accepted UTM values, including provider-source exclusion.
  clean.search = '';
  for (const key of UTM_KEYS) if (touch[key]) clean.searchParams.set(key, touch[key]!);
  touch.landing_url = clean.toString();
  return touch;
}
export function validateTouch(input: unknown, accountCreatedAt: string): FirstTouch | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<FirstTouch>;
  if (value.version !== 1 || typeof value.landing_url !== 'string' || typeof value.captured_at !== 'string') return null;
  const at = Date.parse(value.captured_at);
  const created = Date.parse(accountCreatedAt);
  if (!Number.isFinite(at) || at > created || at < created - 90 * 86400000) return null;
  try {
    if (!productionHost(new URL(value.landing_url).hostname)) return null;
    // Sanitize again at the trust boundary; client data is never accepted verbatim.
    return captureTouch(value.landing_url, typeof value.external_referrer === 'string' ? value.external_referrer : '', new Date(at));
  } catch { return null; }
}
export function sourceOf(touch: FirstTouch | null) {
  return touch?.utm_source ? `utm:${touch.utm_source.toLowerCase()}` : touch?.referring_domain ? `referrer:${touch.referring_domain}` : 'unknown/direct';
}

export function readTouch(): FirstTouch | null {
  if (typeof window === 'undefined') return null;
  try {
    const cookie = document.cookie.split('; ').find(part => part.startsWith(`${TOUCH_COOKIE}=`));
    const raw = cookie ? decodeURIComponent(cookie.slice(TOUCH_COOKIE.length + 1)) : window.localStorage.getItem(TOUCH_KEY);
    if (!raw) return null;
    const touch = JSON.parse(raw) as FirstTouch;
    if (touch.version !== 1 || !Number.isFinite(Date.parse(touch.captured_at))) return null;
    if (Date.now() - Date.parse(touch.captured_at) > 90 * 86400000) return null;
    return captureTouch(touch.landing_url, touch.external_referrer || '', new Date(touch.captured_at));
  } catch { return null; }
}
export function rememberTouch(touch: FirstTouch) {
  const raw = JSON.stringify(touch);
  try { window.localStorage.setItem(TOUCH_KEY, raw); } catch { /* Cookie can still persist. */ }
  const domain = productionHost(window.location.hostname) ? '; Domain=traingpt.co' : '';
  document.cookie = `${TOUCH_COOKIE}=${encodeURIComponent(raw)}; Path=/; Max-Age=7776000; SameSite=Lax${domain}${window.location.protocol === 'https:' ? '; Secure' : ''}`;
}
export function clearTouch() {
  try { window.localStorage.removeItem(TOUCH_KEY); } catch { /* Storage unavailable. */ }
  document.cookie = `${TOUCH_COOKIE}=; Path=/; Max-Age=0${productionHost(window.location.hostname) ? '; Domain=traingpt.co' : ''}`;
}
