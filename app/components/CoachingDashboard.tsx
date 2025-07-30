'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Session } from '@/types/session';
import { StravaActivity } from '@/types/strava';
import { WeeklySummary } from '@/utils/getWeeklySummary';

import CompliancePanel from '@/app/coaching/CompliancePanel';
import WeeklySummaryPanel from '@/app/coaching/WeeklySummaryPanel';
import FitnessPanel from '@/app/coaching/FitnessPanel';
import StravaConnectBanner from '@/app/components/StravaConnectBanner';
import CoachChatModal from '@/app/components/CoachChatModal'; // 🧠 GPT Modal

const SPORT_COLORS: Record<string, string> = {
  Swim: '#60A5FA',
  Bike: '#34D399',
  Run: '#FBBF24',
  Strength: '#A78BFA',
  Unplanned: '#9CA3AF',
};

const normalizeSportName = (raw: string | null | undefined): string => {
  const sport = raw?.toLowerCase();
  switch (sport) {
    case 'swim':
      return 'Swim';
    case 'bike':
    case 'ride':
    case 'virtualride':
      return 'Bike';
    case 'run':
      return 'Run';
    case 'strength':
      return 'Strength';
    default:
      return 'Unplanned';
  }
};

const formatMinutes = (minutes: number): string => {
  if (minutes <= 0) return '0 min';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`;
};

type Props = {
  userId: string;
  sessions: Session[];
  completedSessions: Session[];
  stravaActivities: StravaActivity[];
  weeklyVolume: number[];
  weeklySummary: WeeklySummary;
  stravaConnected: boolean;
};

export default function CoachingDashboard({
  userId,
  sessions,
  completedSessions,
  stravaActivities,
  weeklyVolume,
  weeklySummary,
  stravaConnected,
}: Props) {
  const [viewMode, setViewMode] = useState<'week' | 'plan'>('week');
  const [chatOpen, setChatOpen] = useState(false);
  const [totalTime, setTotalTime] = useState(0);
  const [sportBreakdown, setSportBreakdown] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const breakdown = weeklySummary.sportBreakdown
      .map(({ sport, completed }) => ({
        name: normalizeSportName(sport),
        value: completed ?? 0,
      }))
      .filter((entry) => entry.value > 0);

    const total = breakdown.reduce((sum, b) => sum + b.value, 0);
    setSportBreakdown(breakdown);
    setTotalTime(Math.round(total * 10) / 10);
  }, [weeklySummary]);

  const displayedAdherence =
    viewMode === 'plan'
      ? weeklySummary.planToDate.adherence
      : weeklySummary.adherence;

  const plannedCount =
    viewMode === 'plan'
      ? weeklySummary.planToDate.planned
      : weeklySummary.debug?.plannedSessionsCount ?? 0;

  const completedCount =
    viewMode === 'plan'
      ? weeklySummary.planToDate.completed
      : weeklySummary.debug?.completedSessionsCount ?? 0;

  return (
    <div className="relative mt-10 rounded-2xl border bg-white p-6 shadow-sm">
      <StravaConnectBanner stravaConnected={stravaConnected} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">🏊‍♀️ Training Summary</h2>
        <div className="flex gap-2">
          {['week', 'plan'].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as 'week' | 'plan')}
              className={`px-3 py-1 text-sm rounded-md ${
                viewMode === mode
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {mode === 'week' ? 'This Week' : 'Plan to Date'}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-700">
        Total time trained: <strong>{formatMinutes(totalTime)}</strong>
      </p>

      <div className="mt-4 h-48">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={sportBreakdown}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={60}
              label={({ name, value }) => `${name}: ${formatMinutes(Number(value))}`}
              labelLine={false}
            >
              {sportBreakdown.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={SPORT_COLORS[entry.name] ?? '#D1D5DB'}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatMinutes(Number(value))}
              labelFormatter={(label) => label}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-sm text-gray-500 italic">
        Adherence: {displayedAdherence}% — {completedCount}/{plannedCount} sessions completed
      </p>

      <p className="mt-2 text-xs text-gray-400">
        {viewMode === 'week'
          ? 'Includes all sessions planned for and completed this week (Mon–Sun).'
          : 'Includes all sessions since your plan started.'}
      </p>

      <WeeklySummaryPanel weeklySummary={weeklySummary} viewMode={viewMode} />
      <CompliancePanel weeklySummary={weeklySummary} viewMode={viewMode} />

      <FitnessPanel
        sessions={sessions}
        completedSessions={completedSessions}
        stravaActivities={stravaActivities}
      />

      {/* 💬 Ask Coach Button */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-blue-600 px-4 py-2 text-sm text-white shadow-lg hover:bg-blue-700"
      >
        💬 Ask Your Coach
      </button>

      {/* GPT Coach Modal */}
      <CoachChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
