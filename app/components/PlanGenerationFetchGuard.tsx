'use client';

import { useEffect } from 'react';

const PLAN_GENERATION_PATH = '/api/finalize-plan';
const DEFAULT_FAILURE_MESSAGE =
  'We could not generate your plan. Your current plan was not replaced. Please try again.';
const TIMEOUT_MESSAGE =
  'Plan generation took too long. Your current plan was not replaced. Please try again.';
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

function planGenerationErrorResponse(
  message: string,
  status = 500,
  statusText = 'Plan generation failed',
) {
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    {
      status,
      statusText,
      headers: { 'content-type': 'application/json' },
    },
  );
}

async function upstreamErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) return null;

  try {
    const json = await response.clone().json();
    if (typeof json?.error === 'string' && json.error.trim()) return json.error.trim();
    if (typeof json?.message === 'string' && json.message.trim()) return json.message.trim();
  } catch {
    // Fall through to the safe user-facing message.
  }

  return null;
}

function timeoutLikeStatus(status: number) {
  return status === 408 || status === 504 || status === 524;
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
          const upstreamMessage = await upstreamErrorMessage(response);
          const message =
            upstreamMessage ??
            (timeoutLikeStatus(response.status) ? TIMEOUT_MESSAGE : DEFAULT_FAILURE_MESSAGE);

          console.error('[plan] generation API returned a failed response', {
            status: response.status,
            statusText: response.statusText,
            contentType,
            durationMs,
            upstreamPreview,
          });

          return planGenerationErrorResponse(
            message,
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

          return planGenerationErrorResponse(
            DEFAULT_FAILURE_MESSAGE,
            502,
            'Unexpected plan response',
          );
        }

        return response;
      } catch (error) {
        console.error('[plan] generation API request failed before JSON response', {
          durationMs: Date.now() - startedAt,
          error,
        });

        return planGenerationErrorResponse(
          TIMEOUT_MESSAGE,
          504,
          'Plan generation request failed',
        );
      }
    };
  }, []);

  return null;
}
