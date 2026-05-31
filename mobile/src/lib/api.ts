import { supabase } from './supabase';

const fallbackBaseUrl = 'https://traingpt.co';

export function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL || fallbackBaseUrl;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  const headers = new Headers(init.headers ?? {});

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });
}
