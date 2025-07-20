"use client";

import { useState } from "react";
import { Dialog } from "@headlessui/react";
import { format } from "date-fns";
import type { Session } from "@/types/session";
import type { StravaActivity } from "@/types/strava";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Props = {
  session: Session | null;
  stravaActivity?: StravaActivity | null;
  open: boolean;
  onClose: () => void;
};

export default function SessionModal({ session, stravaActivity, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(session?.details || null);

  const supabase = createClientComponentClient();

  const handleGenerate = async () => {
    if (!session) return;
    setLoading(true);

    const res = await fetch("/api/generate-detailed-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: session.id,
        title: session.title,
        sport: session.sport,
        date: session.date,
      }),
    });

    const { details } = await res.json();
    setOutput(details);

    await supabase.from("sessions").update({ details }).eq("id", session.id);
    setLoading(false);
  };

  if (!session) return null;

  const formattedDate = format(new Date(session.date), "EEE, MMM d");

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white w-full max-w-2xl rounded-xl shadow-xl p-6 space-y-6 animate-fade-in">
          {/* Top Section */}
          <div>
            <Dialog.Title className="text-xl font-semibold text-zinc-900">
              {session.title}
            </Dialog.Title>
            <p className="text-sm text-zinc-500 mt-1">
              {formattedDate} • {session.sport}
            </p>
          </div>

          {/* Middle Section */}
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-zinc-600">📋 Detailed Workout</h4>
            <div className="bg-zinc-100 text-sm rounded-md p-3 whitespace-pre-wrap min-h-[80px]">
              {loading ? "Generating..." : output || "No details generated yet."}
            </div>
          </div>

          {/* Strava Metrics */}
          {stravaActivity && (
            <div className="bg-zinc-100 rounded-md p-4 grid grid-cols-2 gap-4 text-sm">
              {stravaActivity.distance_km && (
                <Metric label="Distance" value={`${stravaActivity.distance_km} km`} />
              )}
              {stravaActivity.avg_pace && (
                <Metric label="Avg Pace" value={stravaActivity.avg_pace} />
              )}
              {stravaActivity.avg_hr && (
                <Metric label="Heart Rate" value={`${stravaActivity.avg_hr} bpm`} />
              )}
              {stravaActivity.avg_power && (
                <Metric label="Power" value={`${stravaActivity.avg_power}w`} />
              )}
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex justify-between items-center pt-2">
            <p className="text-xs text-zinc-400">Generated using TrainGPT</p>
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="bg-black text-white text-sm px-4 py-2 rounded-md disabled:opacity-50"
              >
                {loading ? "Generating..." : "Generate Detailed Workout"}
              </button>
              <button
                onClick={onClose}
                className="text-sm text-zinc-500 hover:text-black underline"
              >
                Close
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="font-medium text-zinc-900">{value}</p>
    </div>
  );
}
