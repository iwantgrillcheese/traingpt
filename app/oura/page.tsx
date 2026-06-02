"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type OuraStatus = {
  connected: boolean;
  connection?: {
    connected_at?: string | null;
    last_synced_at?: string | null;
    scope?: string | null;
  } | null;
  latest?: {
    date?: string | null;
    readiness_score?: number | null;
    sleep_score?: number | null;
    activity_score?: number | null;
    hrv?: number | null;
    resting_hr?: number | null;
  } | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function scoreLabel(score?: number | null) {
  if (score == null) return "No score yet";
  if (score >= 85) return "Excellent recovery";
  if (score >= 75) return "Ready to train";
  if (score >= 60) return "Manage intensity";
  return "Prioritize recovery";
}

export default function OuraPage() {
  const [status, setStatus] = useState<OuraStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/oura/status", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not load Oura status.");
      setStatus(payload as OuraStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Oura status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("oura_success");
    const syncNeeded = params.get("oura_sync") === "needed";
    const returnedError = params.get("oura_error");

    if (success === "connected") {
      setMessage("Oura connected. Syncing recovery data now…");
    }

    if (returnedError) {
      setError(returnedError);
    }

    loadStatus().then(() => {
      if (syncNeeded) {
        syncOura();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadStatus]);

  const syncOura = async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/oura/sync", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not sync Oura.");
      setMessage(`Oura synced. ${payload?.synced ?? 0} daily recovery scores imported.`);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync Oura.");
    } finally {
      setSyncing(false);
    }
  };

  const disconnectOura = async () => {
    const confirmed = window.confirm("Disconnect Oura and delete synced recovery scores from TrainGPT?");
    if (!confirmed) return;

    setDisconnecting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/oura/disconnect", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not disconnect Oura.");
      setMessage("Oura disconnected.");
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect Oura.");
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = Boolean(status?.connected);
  const latest = status?.latest;
  const readiness = typeof latest?.readiness_score === "number" ? latest.readiness_score : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">Recovery connection</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-zinc-950 sm:text-5xl">Oura</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
            Connect Oura to pull daily readiness, sleep, and activity signals into TrainGPT.
          </p>
        </div>
        <Link href="/settings" className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50">
          Settings
        </Link>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-sm">
        <div className="bg-zinc-950 p-7 text-white sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Status</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">{connected ? "Oura connected" : "Connect your Oura Ring"}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">
                {connected
                  ? `Last sync: ${formatDateTime(status?.connection?.last_synced_at)}`
                  : "Use your real recovery data to make Race Readiness smarter."}
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 p-5 text-center min-w-[138px]">
              <p className="text-5xl font-black tracking-[-0.06em]">{readiness ?? "—"}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Readiness</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <p className="text-sm font-semibold text-zinc-500">Checking Oura connection…</p>
          ) : connected ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Date</p>
                  <p className="mt-2 text-xl font-black text-zinc-950">{formatDate(latest?.date)}</p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Sleep</p>
                  <p className="mt-2 text-xl font-black text-zinc-950">{latest?.sleep_score ?? "—"}</p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Activity</p>
                  <p className="mt-2 text-xl font-black text-zinc-950">{latest?.activity_score ?? "—"}</p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Signal</p>
                  <p className="mt-2 text-xl font-black text-zinc-950">{scoreLabel(readiness)}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={syncOura}
                  disabled={syncing}
                  className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  {syncing ? "Syncing…" : "Sync Oura now"}
                </button>
                <button
                  type="button"
                  onClick={disconnectOura}
                  disabled={disconnecting}
                  className="rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect Oura"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">What this unlocks</p>
                <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-zinc-950">Recovery-aware training</p>
                <p className="mt-2 text-sm leading-6 text-zinc-700">
                  TrainGPT will import Oura readiness, sleep, and activity summaries so your daily view can reflect how recovered you are.
                </p>
              </div>
              <a
                href="/api/oura/connect?returnTo=/oura"
                className="inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
              >
                Connect Oura
              </a>
            </div>
          )}

          {message ? <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</p> : null}
          {error ? <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-black/10 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-black tracking-[-0.03em] text-zinc-950">How this will feed Race Readiness</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Version one stores daily readiness, sleep, activity, HRV, and resting heart rate. Next, Today and Race Readiness can use these signals to recommend whether to train as planned, reduce intensity, or prioritize recovery.
        </p>
      </section>
    </main>
  );
}
