import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './helpers/load-ts.mjs';
const {monthTrainingSummary,sessionStatus,calendarSport} = await load('app/schedule/calendar-utils.ts');
test('month totals isolate boundaries, exclude rest, and use actual linked duration', () => {
  const sessions = [
    {date:'2026-09-01',title:'Run',sport:'Run',duration:45},
    {date:'2026-09-30',title:'Ride',sport:'Bike',duration:60,stravaActivity:{moving_time:4800}},
    {date:'2026-09-10',title:'Rest day',sport:'Rest',duration:20},
    {date:'2026-09-12',title:'Swim',sport:'Swim',duration:30},
    {date:'2026-10-01',title:'Run',sport:'Run',duration:90},
  ];
  const completed = [{date:'2026-09-01',session_title:'Run',status:'done'},{date:'2026-09-12',session_title:'Swim',status:'skipped'}];
  assert.equal(JSON.stringify(monthTrainingSummary(sessions,completed,new Date(2026,8,1))),JSON.stringify({planned:3,done:2,plannedMinutes:135,completedMinutes:125,completion:67}));
  assert.equal(monthTrainingSummary([],[],new Date(2026,8,1)).completion,0);
});
test('legacy completion and common sport variants retain their state and styling', () => {
  assert.equal(sessionStatus({date:'2026-09-01',title:'Run'},[{date:'2026-09-01',session_title:'Run'}]),'done');
  assert.equal(calendarSport('VirtualRide'),'Bike');
  assert.equal(calendarSport('TrailRun'),'Run');
  assert.equal(calendarSport('Swim'),'Swim');
});
