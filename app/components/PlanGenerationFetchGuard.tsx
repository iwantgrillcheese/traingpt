'use client';

import { useEffect } from 'react';

const PLAN_GENERATION_PATH = '/api/finalize-plan';
const USER_FACING_TIMEOUT_MESSAGE =
  'Plan generation timed out. Please try again in a minute.';
const INSTALL_MARKER = '__traingptPlanGenerationFetchGuardInstalled';

declare global {
  interface Window {
    [INSTALL_MARKER]?: boolean;
  }
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isPlanGenerationRequest(input: RequestInfo | URL): boolean {
  try {
    const url = new URL(getRequestUrl(input), window.location.origin);
    return url.pathname === PLAN_GENERATION_PATH;
  } catch {
    return getRequestUrl(input).includes(PLAN_GENERATION_PATH);
  }
}

function planGenerationErrorResponse(status = 500, statusText = 'Plan generation failed') {
  return new Response(
    JSON.stringify({ ok: false, error: USER_FACING_TIMEOUT_MESSAGE }),
    {
      status,
      statusText,
      headers: { 'content-type': 'application/json' },
    },
  );
}

export default function PlanGenerationFetchGuard() {
  useEffect(() => {
    if (window[INSTALL_MARKER]) return;

    const originalFetch = window.fetch.bind(window);
    window[INSTALL_MARKER] = true;

    window.fetch = async (input, init) => {
      if (!isPlanGenerationRequest(input)) {
        return originalFetch(input, init);
      }

      const startedAt = Date.now();

      try {
        const response = await originalFetch(input, init);
        const contentType = response.headers.get('content-type') ?? '';
        const durationMs = Date.now() - startedAt;

        if (!response.ok) {
          const upstreamPreview = await response
            .clone()
            .text()
            .then((text) => text.slice(0, 500))
            .catch(() => '');

          console.error('[plan] generation API returned a failed response', {
            status: response.status,
            statusText: response.statusText,
            contentType,
            durationMs,
            upstreamPreview,
          });

          return planGenerationErrorResponse(
            response.status || 500,
            response.statusText || 'Plan generation failed',
          );
        }

        if (!contentType.toLowerCase().includes('application/json')) {
          const upstreamPreview = await response
            .clone()
            .text()
            .then((text) => text.slice(0, 500))
            .catch(() => '');

          console.error('[plan] generation API returned non-JSON success', {
            status: response.status,
            contentType,
            durationMs,
            upstreamPreview,
          });

          return planGenerationErrorResponse(502, 'Unexpected plan response');
        }

        return response;
      } catch (error) {
        console.error('[plan] generation API request failed before JSON response', {
          durationMs: Date.now() - startedAt,
          error,
        });

        return planGenerationErrorResponse(504, 'Plan generation request failed');
      }
    };
  }, []);

  return null;
}
