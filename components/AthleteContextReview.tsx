'use client';

import { useState } from 'react';
import { CONTEXT_RACES, SPORTS, WEEKDAYS } from '@/types/athleteContext';
import type { DayName, InterpretedAthleteContext } from '@/types/athleteContext';
import { contextSummary, validContextDate } from '@/utils/athleteContext';

export function AthleteContextReview({ context, confirmed, onChange, onConfirm, onEdit }: {
  context: InterpretedAthleteContext;
  confirmed: boolean;
  onChange: (context: InterpretedAthleteContext) => void;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const update = (patch: Partial<InterpretedAthleteContext>) => onChange({ ...context, ...patch });
  const inputClass = 'rounded-xl border border-[#E3E0D8] bg-white px-3 py-2 text-sm text-[#101114]';
  const daysEditor = (label: string, values: DayName[] | undefined, change: (v: DayName[]) => void) => (
    <fieldset className="space-y-2"><legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-2">{WEEKDAYS.map(day => <label key={day} className="flex items-center gap-1 text-sm">
        <input type="checkbox" checked={values?.includes(day) ?? false} onChange={e => change(e.target.checked ? [...(values ?? []), day] : (values ?? []).filter(d => d !== day))} />{day.slice(0, 3)}
      </label>)}</div>
    </fieldset>
  );
  const selectDay = (label: string, key: 'restDay' | 'preferredLongRunDay' | 'preferredLongRideDay') => <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
    {label}<select aria-label={label} className={inputClass} value={context[key] ?? ''} onChange={e => update({ [key]: e.target.value || undefined })}>
      <option value="">No rule</option>{WEEKDAYS.map(d => <option key={d}>{d}</option>)}
    </select>
  </label>;
  return <section aria-label="Athlete comments interpretation" className="rounded-2xl border border-[#E3E0D8] bg-[#F7F6F2] p-5 text-[#101114]">
    <h3 className="text-lg font-semibold">Here’s what Brick understood</h3>
    <p className="mt-1 text-sm text-zinc-600">Review these rules before we build your plan. Your original comments stay with your plan.</p>
    {!editing ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{contextSummary(context).map((line, i) => <li key={i}>{line}</li>)}</ul> :
      <div className="mt-4 space-y-4">
        {SPORTS.map(sport => <div key={sport}>{daysEditor(`${sport[0].toUpperCase() + sport.slice(1)} availability (blank = unrestricted)`, context.sportAvailability?.[sport], values => {
          const availability = { ...context.sportAvailability };
          if (values.length) availability[sport] = values; else delete availability[sport];
          update({ sportAvailability: availability });
        })}</div>)}
        {daysEditor('Unavailable days', context.unavailableDays, values => update({ unavailableDays: values }))}
        {daysEditor('Avoid hard training', context.avoidHardTrainingDays, values => update({ avoidHardTrainingDays: values }))}
        {selectDay('Rest day', 'restDay')}{selectDay('Long run day', 'preferredLongRunDay')}{selectDay('Long ride day', 'preferredLongRideDay')}
        <label className="flex items-center justify-between gap-2 text-sm">Two-a-days
          <select aria-label="Two-a-days" className={inputClass} value={context.twoADaysAllowed === undefined ? '' : String(context.twoADaysAllowed)} onChange={e => update({ twoADaysAllowed: e.target.value === '' ? undefined : e.target.value === 'true' })}>
            <option value="">Use schedule setting</option><option value="true">Allowed</option><option value="false">Prefer one session per day</option>
          </select>
        </label>
        {(context.recurringCommitments ?? []).map((r, i) => <fieldset key={i} className="flex flex-wrap gap-2"><legend className="mb-2 text-sm font-medium">Recurring commitment</legend>
          <input aria-label="Activity" className={inputClass} value={r.activity} maxLength={500} onChange={e => update({ recurringCommitments: context.recurringCommitments!.map((x, j) => j === i ? { ...x, activity: e.target.value } : x) })} />
          <select aria-label="Commitment day" className={inputClass} value={r.day} onChange={e => update({ recurringCommitments: context.recurringCommitments!.map((x, j) => j === i ? { ...x, day: e.target.value as DayName } : x) })}>{WEEKDAYS.map(d => <option key={d}>{d}</option>)}</select>
          <select aria-label="Commitment intensity" className={inputClass} value={r.intensity ?? ''} onChange={e => update({ recurringCommitments: context.recurringCommitments!.map((x, j) => j === i ? { ...x, intensity: (e.target.value || undefined) as typeof r.intensity } : x) })}><option value="">Unspecified</option>{['easy', 'moderate', 'hard'].map(v => <option key={v}>{v}</option>)}</select>
          <button type="button" className="text-sm underline" onClick={() => update({ recurringCommitments: context.recurringCommitments!.filter((_, j) => j !== i) })}>Remove</button>
        </fieldset>)}
        <button type="button" className="text-sm underline" onClick={() => update({ recurringCommitments: [...(context.recurringCommitments ?? []), { activity: 'Activity', day: 'Tuesday' }] })}>Add recurring commitment</button>
        <label className="flex flex-wrap items-center justify-between gap-2 text-sm">Secondary event
          <select aria-label="Secondary event" className={inputClass} value={context.secondaryEvent?.raceType ?? ''} onChange={e => update({ secondaryEvent: e.target.value ? { raceType: e.target.value as typeof CONTEXT_RACES[number], raceDate: context.secondaryEvent?.raceDate ?? null } : undefined })}><option value="">None</option>{CONTEXT_RACES.map(r => <option key={r}>{r}</option>)}</select>
        </label>
        {context.secondaryEvent && <label className="flex flex-wrap items-center justify-between gap-2 text-sm">Secondary event date
          <input aria-label="Secondary event date" type="date" className={inputClass} value={context.secondaryEvent.raceDate ?? ''} onChange={e => update({ secondaryEvent: { ...context.secondaryEvent!, raceDate: validContextDate(e.target.value) ? e.target.value : null } })} />
          <span className="w-full text-xs text-zinc-600">Confirm the full date. This goal is saved as context; it does not change periodization yet.</span>
        </label>}
        {(context.preferences ?? []).map((p, i) => <label key={i} className="flex gap-2 text-sm">
          <input aria-label="Context or preference" className={`${inputClass} flex-1`} value={p.text} maxLength={500} onChange={e => update({ preferences: context.preferences!.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} />
          <button type="button" className="underline" onClick={() => update({ preferences: context.preferences!.filter((_, j) => j !== i) })}>Remove</button>
        </label>)}
        {(context.unsupportedRequests ?? []).map((p, i) => <label key={i} className="flex gap-2 text-sm">
          <input aria-label="Unsupported request (context only)" className={`${inputClass} flex-1`} value={p} maxLength={500} onChange={e => update({ unsupportedRequests: context.unsupportedRequests!.map((x, j) => j === i ? e.target.value : x) })} />
          <button type="button" className="underline" onClick={() => update({ unsupportedRequests: context.unsupportedRequests!.filter((_, j) => j !== i) })}>Remove</button>
        </label>)}
      </div>}
    <div className="mt-4 flex items-center gap-4">
      <button type="button" disabled={confirmed} onClick={() => { setEditing(false); onConfirm(); }} className="rounded-xl bg-[#2563FF] px-4 py-2 text-sm font-medium text-white disabled:bg-zinc-400">{confirmed ? 'Confirmed' : 'Looks right'}</button>
      <button type="button" onClick={() => { setEditing(!editing); onEdit(); }} className="text-sm font-medium underline">{editing ? 'Done editing' : 'Edit'}</button>
    </div>
    <p className="mt-3 text-xs text-zinc-600">Hard availability and rest days take priority. We may pair sessions when needed to keep your plan complete.</p>
  </section>;
}
