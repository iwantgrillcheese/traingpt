'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics/posthog-client';

type RaceType = 'Sprint' | 'Olympic' | 'Half Ironman (70.3)' | 'Ironman (140.6)';
type LongDay = 'Saturday' | 'Sunday';

type Props = {
  initialRaceType?: RaceType;
  compact?: boolean;
};

type PreviewSession = {
  day: string;
  sport: string;
  title: string;
  duration: string;
  why: string;
};

function clampHours(value: number) {
  return Math.max(4, Math.min(18, Number.isFinite(value) ? value : 8));
}

function raceScale(raceType: RaceType) {
  if (raceType.includes('140.6')) return 1.35;
  if (raceType.includes('70.3')) return 1.15;
  if (raceType === 'Olympic') return 1;
  return 0.85;
}

function buildPreview(raceType: RaceType, weeklyHours: number, longDay: LongDay): PreviewSession[] {
  const scale = raceScale(raceType);
  const hours = clampHours(weeklyHours);
  const longRideMinutes = Math.round(Math.max(75, hours * 60 * 0.34 * scale) / 5) * 5;
  const longRunMinutes = Math.round(Math.max(40, hours * 60 * 0.16 * scale) / 5) * 5;
  const qualityBike = Math.round(Math.max(50, hours * 60 * 0.13) / 5) * 5;
  const easyRun = Math.round(Math.max(30, hours * 60 * 0.09) / 5) * 5;
  const swimOne = Math.round(Math.max(35, hours * 60 * 0.08) / 5) * 5;
  const swimTwo = Math.round(Math.max(35, hours * 60 * 0.08) / 5) * 5;
  const longRideDay = longDay;
  const longRunDay = longDay === 'Saturday' ? 'Sunday' : 'Saturday';

  return [
    { day: 'Monday', sport: 'Rest', title: 'Rest + mobility', duration: '—', why: 'Absorb the weekend before the next quality block.' },
    { day: 'Tuesday', sport: 'Bike', title: 'Threshold development', duration: `${qualityBike} min`, why: 'Build sustainable bike power without compromising the long work.' },
    { day: 'Wednesday', sport: 'Swim', title: 'Technique + aerobic swim', duration: `${swimOne} min`, why: 'Improve economy while adding low-impact aerobic volume.' },
    { day: 'Thursday', sport: 'Run', title: 'Easy aerobic run', duration: `${easyRun} min`, why: 'Durability at an effort you can recover from quickly.' },
    { day: 'Friday', sport: 'Swim', title: 'Steady endurance swim', duration: `${swimTwo} min`, why: 'Race-specific aerobic work without loading the legs.' },
    { day: longRideDay, sport: 'Bike', title: raceType === 'Sprint' ? 'Race-specific ride' : 'Long ride + short brick', duration: `${longRideMinutes} min`, why: 'The key endurance session: pacing, position, and fueling practice.' },
    { day: longRunDay, sport: 'Run', title: 'Long aerobic run', duration: `${longRunMinutes} min`, why: 'Build run durability while keeping the effort controlled.' },
  ].sort((a, b) => ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(a.day) - ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(b.day));
}

export default function PublicPlanPreview({ initialRaceType = 'Half Ironman (70.3)', compact = false }: Props) {
  const [raceType, setRaceType] = useState<RaceType>(initialRaceType);
  const [raceDate, setRaceDate] = useState('');
  const [weeklyHours, setWeeklyHours] = useState(8);
  const [longDay, setLongDay] = useState<LongDay>('Saturday');
  const [generated, setGenerated] = useState(false);

  const preview = useMemo(() => buildPreview(raceType, weeklyHours, longDay), [raceType, weeklyHours, longDay]);
  const next = `/plan?raceType=${encodeURIComponent(raceType)}${raceDate ? `&raceDate=${encodeURIComponent(raceDate)}` : ''}`;
  const signupHref = `/login?next=${encodeURIComponent(next)}`;

  const generate = () => {
    setGenerated(true);
    track('public_plan_preview_generated', {
      race_type: raceType,
      race_date_provided: Boolean(raceDate),
      weekly_hours: weeklyHours,
      long_day: longDay,
    });
  };

  return (
    <div className="rounded-[2rem] border border-[#E3E0D8] bg-white p-5 shadow-[0_24px_80px_rgba(16,17,20,0.08)] sm:p-7">
      <div className="grid gap-4 md:grid-cols-4">
        <label className="text-sm font-bold text-[#101114]">
          Race distance
          <select value={raceType} onChange={(e) => setRaceType(e.target.value as RaceType)} className="mt-2 w-full rounded-xl border border-[#E3E0D8] bg-white px-3 py-3 font-medium">
            <option>Sprint</option><option>Olympic</option><option>Half Ironman (70.3)</option><option>Ironman (140.6)</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#101114]">
          Race date
          <input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#E3E0D8] bg-white px-3 py-3 font-medium" />
        </label>
        <label className="text-sm font-bold text-[#101114]">
          Hours / week
          <input type="number" min={4} max={18} value={weeklyHours} onChange={(e) => setWeeklyHours(clampHours(Number(e.target.value)))} className="mt-2 w-full rounded-xl border border-[#E3E0D8] bg-white px-3 py-3 font-medium" />
        </label>
        <label className="text-sm font-bold text-[#101114]">
          Long ride day
          <select value={longDay} onChange={(e) => setLongDay(e.target.value as LongDay)} className="mt-2 w-full rounded-xl border border-[#E3E0D8] bg-white px-3 py-3 font-medium">
            <option>Saturday</option><option>Sunday</option>
          </select>
        </label>
      </div>

      {!generated ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" onClick={generate} className="rounded-full bg-[#101114] px-5 py-3 text-sm font-black text-white">Preview my week</button>
          <p className="text-xs leading-5 text-[#6B7280]">No account required. This is a representative week; your saved plan uses your schedule, current zones, and training history.</p>
        </div>
      ) : (
        <>
          <div className={`mt-6 grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
            {preview.map((session) => (
              <div key={`${session.day}-${session.sport}`} className="rounded-2xl border border-[#E3E0D8] bg-[#FBFBFA] p-4">
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-[0.12em] text-[#6B7280]">{session.day} · {session.sport}</span><span className="text-xs font-black text-[#101114]">{session.duration}</span></div>
                <h3 className="mt-2 text-base font-black tracking-[-0.02em] text-[#101114]">{session.title}</h3>
                <p className="mt-1 text-sm leading-5 text-[#6B7280]">{session.why}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-[#101114] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div><p className="font-black">Want the full race build?</p><p className="mt-1 text-sm leading-6 text-white/65">Create a free account to save the plan, connect Strava, use your actual zones, and adapt future weeks from completed training.</p></div>
            <Link href={signupHref} onClick={() => track('public_plan_preview_signup_clicked', { race_type: raceType })} className="mt-4 inline-flex shrink-0 rounded-full bg-white px-5 py-3 text-sm font-black text-[#101114] sm:mt-0">Build the full plan</Link>
          </div>
        </>
      )}
    </div>
  );
}
