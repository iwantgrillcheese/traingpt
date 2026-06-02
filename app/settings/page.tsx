"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useStravaAutoSync } from "../hooks/useStravaAutoSync";
import { OuraConnectionCard } from "./OuraConnectionCard";
import {
  DEFAULT_FUELING_PREFERENCES,
  loadFuelingPreferences,
  saveFuelingPreferences,
} from "@/lib/fueling-preferences";

export default function ProfilePage() {
  const { user, loading: authLoading, refresh: refreshAuth } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [optIn, setOptIn] = useState<boolean>(true);
  const [fuelingPreferences, setFuelingPreferences] = useState(
    DEFAULT_FUELING_PREFERENCES,
  );
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [stravaConnectUrl, setStravaConnectUrl] = useState<string | null>(null);
  const [stravaActionLoading, setStravaActionLoading] = useState(false);
  const [stravaMessage, setStravaMessage] = useState<string | null>(null);

  const stravaSync = useStravaAutoSync({
    enabled: Boolean(profile?.strava_access_token) && !authLoading && !profileLoading,
    authReady: !authLoading && !profileLoading,
    isAuthenticated: Boolean(user?.id),
    onSyncComplete: () => setStravaMessage("Strava connected and synced."),
  });

  const canShowResetDataButton =
    (profile?.email || "").toLowerCase() === "me@cameronmcdiarmid.com";

  const secondsToTimeString = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const timeStringToSeconds = (input: string) => {
    const [min, sec] = input.split(":").map(Number);
    return min * 60 + (sec || 0);
  };

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (authLoading) return;

      if (!user) {
        if (!cancelled) {
          setProfile(null);
          setProfileLoading(false);
          setProfileError("Please sign in to view settings.");
        }
        return;
      }

      try {
        setProfileLoading(true);
        setProfileError(null);

        const baseProfile = {
          name: user.user_metadata?.full_name || "Anonymous",
          email: user.email || "",
          avatar: user.user_metadata?.avatar_url || "",
        };

        const [
          { data: userData, error: userErr },
          { data: profileData, error: profileErr },
        ] = await Promise.all([
          supabase
            .from("users")
            .select("marketing_opt_in")
            .eq("id", user.id)
            .maybeSingle(),
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        ]);

        if (userErr) {
          console.error("Error loading user marketing_opt_in:", userErr);
        }

        if (profileErr) {
          console.error("Error loading profile:", profileErr);
        }

        const typedUserData = userData as {
          marketing_opt_in: boolean | null;
        } | null;

        if (!cancelled) {
          setOptIn(typedUserData?.marketing_opt_in === true);
          setProfile({ ...baseProfile, ...(profileData ?? {}) });
        }
      } catch (error: any) {
        console.error("[settings] load profile failed:", error);
        if (!cancelled) {
          setProfileError(error?.message || "Failed to load profile.");
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    setFuelingPreferences(loadFuelingPreferences());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedFromStrava = params.get("success") === "strava_connected" || params.get("sync") === "needed";

    if (returnedFromStrava) {
      refreshAuth().catch((error) => {
        console.error("[settings] auth refresh after Strava return failed:", error);
      });
    }
  }, [refreshAuth]);

  useEffect(() => {
    if (stravaSync.message) {
      setStravaMessage(stravaSync.message);
    }
  }, [stravaSync.message]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || "145662";
    const origin = window.location.origin;
    const redirectUri = `${origin}/api/strava/callback`;

    const url = new URL("https://www.strava.com/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "activity:read_all,profile:read_all");
    url.searchParams.set("approval_prompt", "auto");
    const returnTo = `${window.location.pathname}`;
    url.searchParams.set("state", returnTo);

    setStravaConnectUrl(url.toString());
  }, []);

  const handleFuelingPreferenceUpdate = (
    field: "enabled" | "bodyWeightKg" | "bodyFatPct" | "sweatRateLPerHour",
    value: boolean | string,
  ) => {
    setFuelingPreferences((prev) => {
      const next = { ...prev, [field]: value } as typeof prev;
      saveFuelingPreferences(next);
      return next;
    });
  };

  const toggleOptIn = async () => {
    if (!user?.id) return;

    const newOpt = !optIn;
    setOptIn(newOpt);

    const { error } = await supabase
      .from("users")
      .update({ marketing_opt_in: newOpt })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating marketing_opt_in:", error);
      setOptIn(!newOpt);
    }
  };

  const handleProfileUpdate = async (field: string, value: any) => {
    if (!user?.id) return;

    setProfile((prev: any) => ({ ...prev, [field]: value }));

    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating profile field:", field, error);
    }
  };

  const handleDisconnectStrava = async () => {
    try {
      setStravaActionLoading(true);
      setStravaMessage(null);

      const res = await fetch("/api/strava_disconnect", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStravaMessage(json?.error || "Failed to disconnect Strava.");
        return;
      }

      setProfile((prev: any) => ({
        ...prev,
        strava_access_token: null,
        strava_refresh_token: null,
        strava_expires_at: null,
        strava_athlete_id: null,
      }));
      setStravaMessage("Strava disconnected.");
    } catch (error: any) {
      setStravaMessage(error?.message || "Failed to disconnect Strava.");
    } finally {
      setStravaActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      "Are you sure you want to delete your account? This cannot be undone.",
    );
    if (!confirmed) return;
    if (!user?.id) return;

    await supabase.from("plans").delete().eq("user_id", user.id);
    await supabase.from("completed_sessions").delete().eq("user_id", user.id);
    await supabase.from("users").delete().eq("id", user.id);

    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleManageSubscription = async () => {
    const res = await fetch("/api/stripe/portal", { method: "POST" });

    if (!res.ok) {
      console.error("Failed to load Stripe portal");
      return;
    }

    const { url } = await res.json();
    if (url) window.location.href = url;
  };

  const handleResetMyData = async () => {
    const typed = window.prompt("Type RESET to wipe your training data.");
    if (typed !== "RESET") return;

    try {
      setResetLoading(true);
      setResetMessage(null);

      const res = await fetch("/api/dev/reset-my-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET" }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setResetMessage(json?.error || "Reset failed");
        return;
      }

      const deleted = json?.deleted || {};
      setResetMessage(
        `Reset complete. plans=${deleted.plans ?? 0}, sessions=${deleted.sessions ?? 0}, completed=${deleted.completed_sessions ?? 0}, strava=${deleted.strava_activities ?? 0}`,
      );

      window.location.href = "/plan";
    } catch (err: any) {
      setResetMessage(err?.message || "Reset failed");
    } finally {
      setResetLoading(false);
    }
  };

  if (profileLoading || authLoading) {
    return (
      <div className="text-center py-20 text-gray-500">Loading profile...</div>
    );
  }

  if (!profile) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
        <h1 className="text-2xl font-semibold mb-3">Settings unavailable</h1>
        <p className="text-sm text-gray-500">
          {profileError || "Please sign in again to manage your account."}
        </p>
        <Link
          href="/login?next=/settings"
          className="mt-6 inline-flex rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <h1 className="text-2xl sm:text-3xl font-semibold mb-8">
        Account Settings
      </h1>

      <div className="space-y-8">
        {/* Training Zones */}
        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Training Zones</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Swim Threshold (mm:ss / 100m)
              </label>
              <input
                type="text"
                value={secondsToTimeString(
                  profile.swim_threshold_per_100m || 0,
                )}
                onChange={(e) =>
                  handleProfileUpdate(
                    "swim_threshold_per_100m",
                    timeStringToSeconds(e.target.value),
                  )
                }
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. 1:45"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Bike FTP (watts)
              </label>
              <input
                type="number"
                value={profile.bike_ftp || ""}
                onChange={(e) =>
                  handleProfileUpdate("bike_ftp", parseInt(e.target.value))
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Run Threshold (mm:ss /{" "}
                {profile.run_pace_unit === "km" ? "km" : "mile"})
              </label>
              <input
                type="text"
                value={secondsToTimeString(profile.run_threshold_per_mile || 0)}
                onChange={(e) =>
                  handleProfileUpdate(
                    "run_threshold_per_mile",
                    timeStringToSeconds(e.target.value),
                  )
                }
                className="w-full border rounded px-3 py-2"
                placeholder="e.g. 7:30"
              />
              <div className="mt-2">
                <label className="text-xs text-gray-500 mr-2">Units:</label>
                <select
                  value={profile.run_pace_unit || "mile"}
                  onChange={(e) =>
                    handleProfileUpdate("run_pace_unit", e.target.value)
                  }
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="mile">mile</option>
                  <option value="km">km</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Email Opt-In */}
        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Email Preferences</h2>
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={optIn}
              onChange={toggleOptIn}
              className="w-4 h-4"
            />
            I’d like to receive occasional product updates and tips
          </label>
        </section>

        {/* Connected Apps */}
        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Connected Apps</h2>
          <div className="space-y-4">
            <div className="rounded-xl border border-black/10 bg-zinc-50/70 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">Strava</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${profile?.strava_access_token ? "bg-orange-100 text-orange-700" : "bg-zinc-200 text-zinc-600"}`}>
                      {profile?.strava_access_token ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {profile?.strava_access_token ? "Activity sync is active." : "Connect completed activities and training history."}
                  </p>
                </div>

                {profile?.strava_access_token ? (
                  <button
                    type="button"
                    onClick={handleDisconnectStrava}
                    disabled={stravaActionLoading}
                    className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    {stravaActionLoading ? "Disconnecting…" : "Disconnect"}
                  </button>
                ) : stravaConnectUrl ? (
                  <a
                    href={stravaConnectUrl}
                    className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Connect
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">
                    Preparing Strava connection…
                  </p>
                )}
              </div>
              {stravaMessage ? (
                <p className="mt-3 text-sm text-gray-600">{stravaMessage}</p>
              ) : null}
            </div>

            <OuraConnectionCard />
          </div>
        </section>

        {/* Subscription */}
        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-4">Subscription</h2>
          <p className="text-sm text-gray-600 mb-4">
            View your current plan, update payment info, or cancel anytime via
            Stripe.
          </p>
          <button
            className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 transition"
            onClick={handleManageSubscription}
          >
            Manage Subscription
          </button>
        </section>

        <section className="bg-white border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium mb-2">Fueling</h2>
          <p className="text-sm text-gray-600">
            Set defaults for workout fueling guidance. You can still adjust
            these per-session from your calendar.
          </p>

          <div className="mt-4 rounded-xl border border-black/10 bg-zinc-50/70 p-4">
            <label className="flex items-center gap-3 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={fuelingPreferences.enabled}
                onChange={(e) =>
                  handleFuelingPreferenceUpdate("enabled", e.target.checked)
                }
                className="h-4 w-4"
              />
              Enable fueling guidance by default
            </label>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-600">
                  Body weight (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={fuelingPreferences.bodyWeightKg}
                  onChange={(e) =>
                    handleFuelingPreferenceUpdate(
                      "bodyWeightKg",
                      e.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                  placeholder="70"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-600">
                  Body fat % (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="0.1"
                  value={fuelingPreferences.bodyFatPct}
                  onChange={(e) =>
                    handleFuelingPreferenceUpdate("bodyFatPct", e.target.value)
                  }
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                  placeholder="18"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-600">
                  Sweat rate L/hr (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={fuelingPreferences.sweatRateLPerHour}
                  onChange={(e) =>
                    handleFuelingPreferenceUpdate(
                      "sweatRateLPerHour",
                      e.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
                  placeholder="0.8"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href="/fueling"
              className="inline-flex rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 transition"
            >
              Open fueling shop guide
            </Link>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Want workout-specific nutrition guidance? Turn on fueling when
            generating a detailed session from your calendar.
          </p>
          <Link
            href="/fueling"
            className="inline-flex rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 transition"
          >
            Open fueling shop guide
          </Link>
        </section>

        {canShowResetDataButton && (
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-medium text-amber-800 mb-2">
              Dev Tools
            </h2>
            <p className="text-sm text-amber-700 mb-4">
              Reset your training data (plans, sessions, completed sessions,
              Strava activities) for fresh testing. You will be asked to type
              RESET.
            </p>
            <button
              onClick={handleResetMyData}
              disabled={resetLoading}
              className="px-5 py-2 text-sm rounded-full bg-amber-600 text-white hover:bg-amber-700 transition disabled:opacity-60"
            >
              {resetLoading ? "Resetting…" : "Reset my training data"}
            </button>
            {resetMessage && (
              <p className="mt-3 text-sm text-amber-800">{resetMessage}</p>
            )}
          </section>
        )}

        {/* Danger Zone */}
        <section className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-medium text-red-700 mb-4">Danger Zone</h2>
          <p className="text-sm text-red-600 mb-4">
            Deleting your account will erase all your plans, history, and
            preferences. This action cannot be undone.
          </p>
          <button
            onClick={handleDeleteAccount}
            className="px-5 py-2 text-sm rounded-full bg-red-600 text-white hover:bg-red-700 transition"
          >
            Delete My Account
          </button>
        </section>
      </div>
    </main>
  );
}
