'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

const PLAN_GENERATION_PATH = '/api/finalize-plan';
const DEFAULT_FAILURE_MESSAGE =
  'We could not finish generating your plan. Please try again.';
const TIMEOUT_MESSAGE =
  'Plan generation took too long to confirm. Check your schedule before trying again.';
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

function jsonResponse(payload: Record<string, unknown>, status = 200, statusText = 'OK') {
  return new Response(JSON.stringify(payload), {
    status,
    statusText,
    headers: { 'content-type': 'application/json' },
  });
}

function planGenerationErrorResponse(
  message: string,
  status = 500,
  statusText = 'Plan generation failed',
) {
  return jsonResponse({ ok: false, error: message }, status, statusText);
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

async function recoverSavedPlan(startedAt: number) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.id) return null;

    const { data, error } = await supabase
      .from('plans')
      .select('id,plan')
      .eq('user_id', auth.user.id)
      .limit(1)
      .maybeSingle();

    if (error || !data?.id) return null;
    const plan = (data as any).plan ?? {};
    const generatedAt = new Date(plan?.metadata?.generatedAt ?? 0).getTime();

    // Allow a small clock skew between the browser and server. An older active
    // plan is not a checkpoint for this request and must never be mistaken for one.
    if (!Number.isFinite(generatedAt) || generatedAt < startedAt - 15_000) return null;

    return jsonResponse({
      ok: true,
      planId: String(data.id),
      plan,
      totalWeeks: Number(plan?.metadata?.totalWeeks ?? plan?.weeks?.length ?? 0),
      enrichmentPending: Boolean(plan?.metadata?.enrichment?.pending),
      recoveredFromCheckpoint: true,
    });
  } catch (error) {
    console.warn('[plan] checkpoint recovery failed', error);
    return null;
  }
}

async function validateSuccessResponse(response: Response, startedAt: number) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('application/json')) return response;

  const upstreamPreview = await response
    .clone()
    .text()
    .then((text) => text.slice(0, 500))
    .catch(() => '');

  console.error('[plan] generation API returned non-JSON success', {
    status: response.status,
    contentType,
    durationMs: Date.now() - startedAt,
    upstreamPreview,
  });

  return planGenerationErrorResponse(DEFAULT_FAILURE_MESSAGE, 502, 'Unexpected plan response');
}

export default function PlanGenerationFetchGuard() {
  useEffect(() => {
    if (window[INSTALL_MARKER]) return;

    const originalFetch = window.fetch.bind(window);
    window[INSTALL_MARKER] = true;

    window.fetch = async (input, init) => {
      if (!isPlanGenerationRequest(input)) return originalFetch(input, init);

      const startedAt = Date.now();
      const retryInput = input instanceof Request ? input.clone() : input;

      const runAttempt = async (attemptInput: RequestInfo | URL) => {
        const response = await originalFetch(attemptInput, init);
        if (response.ok) return validateSuccessResponse(response, startedAt);

        const upstreamPreview = await response
          .clone()
          .text()
          .then((text) => text.slice(0, 500))
          .catch(() => '');
        const upstreamMessage = await upstreamErrorMessage(response);

        console.error('[plan] generation API returned a failed response', {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type') ?? '',
          durationMs: Date.now() - startedAt,
          upstreamPreview,
        });

        if (!timeoutLikeStatus(response.status)) {
          return planGenerationErrorResponse(
            upstreamMessage ?? DEFAULT_FAILURE_MESSAGE,
            response.status || 500,
            response.statusText || 'Plan generation failed',
          );
        }

        return null;
      };

      try {
        const firstResult = await runAttempt(input);
        if (firstResult) return firstResult;
      } catch (error) {
        console.error('[plan] generation request lost before confirmation', {
          durationMs: Date.now() - startedAt,
          error,
        });
      }

      // A proxy/browser timeout does not prove the server stopped. Check the
      // canonical plan row first; if it was saved, resume from that checkpoint
      // instead of regenerating and accidentally archiving the successful plan.
      const recovered = await recoverSavedPlan(startedAt);
      if (recovered) return recovered;

      console.warn('[plan] no saved checkpoint found; retrying generation once');

      try {
        const retryResult = await runAttempt(retryInput);
        if (retryResult) return retryResult;
      } catch (error) {
        console.error('[plan] generation retry lost before confirmation', {
          durationMs: Date.now() - startedAt,
          error,
        });
      }

      // One final checkpoint read catches a server that completed while the
      // retry response was being dropped.
      const recoveredAfterRetry = await recoverSavedPlan(startedAt);
      if (recoveredAfterRetry) return recoveredAfterRetry;

      return planGenerationErrorResponse(
        TIMEOUT_MESSAGE,
        504,
        'Plan generation request failed',
      );
    };
  }, []);

  return null;
}
