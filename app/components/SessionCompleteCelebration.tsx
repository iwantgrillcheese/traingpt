'use client';

import { useEffect, useRef, useState } from 'react';

type CelebrationState = {
  id: number;
  label: string;
};

function isMarkDoneRequest(input: RequestInfo | URL, init?: RequestInit) {
  const method = String(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'POST') return false;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  return url.includes('/api/schedule/mark-done');
}

function isUndoRequest(init?: RequestInit) {
  if (!init?.body || typeof init.body !== 'string') return false;
  try {
    const parsed = JSON.parse(init.body);
    return parsed?.undo === true;
  } catch {
    return false;
  }
}

export default function SessionCompleteCelebration() {
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const shouldWatch = isMarkDoneRequest(input, init) && !isUndoRequest(init);
      const response = await originalFetch(input, init);

      if (shouldWatch && response.ok) {
        response
          .clone()
          .json()
          .then((payload) => {
            if (payload?.completed === true) {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setCelebration({ id: Date.now(), label: 'Session banked' });
              timeoutRef.current = setTimeout(() => setCelebration(null), 1700);
            }
          })
          .catch(() => undefined);
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!celebration) return null;

  return (
    <div key={celebration.id} className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center px-6">
      <style jsx>{`
        @keyframes tg-complete-card {
          0% { opacity: 0; transform: translateY(18px) scale(0.92); }
          18% { opacity: 1; transform: translateY(0) scale(1.035); }
          36% { transform: translateY(0) scale(1); }
          78% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-10px) scale(0.98); }
        }
        @keyframes tg-complete-ring {
          0% { transform: scale(0.62); opacity: 0.7; }
          70% { transform: scale(1.85); opacity: 0; }
          100% { transform: scale(1.85); opacity: 0; }
        }
        @keyframes tg-complete-check {
          0% { stroke-dashoffset: 34; }
          38% { stroke-dashoffset: 34; }
          70% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes tg-complete-spark {
          0% { opacity: 0; transform: translate3d(0, 0, 0) scale(0.4); }
          22% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(var(--tx), var(--ty), 0) scale(1); }
        }
        .tg-complete-card { animation: tg-complete-card 1.65s cubic-bezier(0.2, 0.9, 0.2, 1) both; }
        .tg-complete-ring { animation: tg-complete-ring 1.2s ease-out both; }
        .tg-complete-check { stroke-dasharray: 34; animation: tg-complete-check 0.72s ease-out 0.05s both; }
        .tg-complete-spark { animation: tg-complete-spark 0.95s ease-out both; }
      `}</style>

      <div className="tg-complete-card relative w-full max-w-[340px] overflow-hidden rounded-[2rem] border border-emerald-100 bg-white/95 p-6 text-center shadow-[0_24px_90px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:max-w-[380px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(22,163,74,0.16),transparent_62%)]" />
        <span className="tg-complete-spark absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-lime-300" style={{ '--tx': '-112px', '--ty': '-82px' } as React.CSSProperties} />
        <span className="tg-complete-spark absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-emerald-300" style={{ '--tx': '120px', '--ty': '-72px', animationDelay: '70ms' } as React.CSSProperties} />
        <span className="tg-complete-spark absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-lime-200" style={{ '--tx': '-92px', '--ty': '78px', animationDelay: '110ms' } as React.CSSProperties} />
        <span className="tg-complete-spark absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-emerald-200" style={{ '--tx': '102px', '--ty': '82px', animationDelay: '150ms' } as React.CSSProperties} />

        <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-700 text-white shadow-[0_18px_44px_rgba(21,128,61,0.34)]">
          <div className="tg-complete-ring absolute inset-0 rounded-full border-4 border-emerald-500" />
          <svg viewBox="0 0 52 52" className="relative h-14 w-14" aria-hidden="true">
            <path className="tg-complete-check" d="M15 27.5 23 35l15-18" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="relative mt-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Work complete</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-zinc-950">{celebration.label}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">Points earned. Readiness moves when the work gets done.</p>
        </div>
      </div>
    </div>
  );
}
