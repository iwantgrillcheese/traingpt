"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

function formatDateTime(value?: string | null) {
  if (!value) return "Never synced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently synced";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function readinessCopy(score?: number | null) {
  if (score == null) return "No recovery score yet";
  if (score >= 85) return "Excellent recovery";
  if (score >= 75) return "Ready to train";
  if (score >= 60) return "Manage intensity";
  return "Prioritize recovery";
}

export function OuraConnectionCard() {
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
      const res = await fetch("/api/oura/status", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not load Oura status.");
      setStatus(json as OuraStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Oura status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const syncOura = async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/oura/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not sync Oura.");
      setMessage(`Oura synced. ${json?.synced ?? 0} recovery scores imported.`);
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
      const res = await fetch("/api/oura/disconnect", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not disconnect Oura.");
      setMessage("Oura disconnected.");
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect Oura.");
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = Boolean(status?.connected);
  const readiness = status?.latest?.readiness_score ?? null;

  return (
    <div className="rounded-xl border border-black/10 bg-zinc-50/70 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-800">Oura</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                connected ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"
              }`}
            >
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {loading
              ? "Checking Oura connection…"
              : connected
                ? `Readiness ${readiness ?? "—"} · ${readinessCopy(readiness)} · ${formatDateTime(status?.connection?.last_synced_at)}`
                : "Connect daily readiness, sleep, and activity signals."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <button
                type="button"
                onClick={syncOura}
                disabled={syncing || loading}
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync"}
              </button>
              <Link
                href="/oura"
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-white"
              >
                View
              </Link>
              <button
                type="button"
                onClick={disconnectOura}
                disabled={disconnecting || loading}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          ) : (
            <a
              href="/api/oura/connect?returnTo=/settings"
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Connect
            </a>
          )}
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
