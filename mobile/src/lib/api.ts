import { supabase } from './supabase';

const fallbackBaseUrl = 'https://traingpt.co';

function cleanBaseUrl(value?: string | null) {
  return String(value || fallbackBaseUrl).replace(/\/$/, '');
}

export function getApiBaseUrl() {
  return cleanBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL || fallbackBaseUrl);
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  const headers = new Headers(init.headers ?? {});
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  try {
    return await fetch(url, {
      ...init,
      headers,
    });
  } catch (error) {
    console.error('[apiFetch] Network request failed', {
      url,
      method: init.method ?? 'GET',
      hasAccessToken: Boolean(accessToken),
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
