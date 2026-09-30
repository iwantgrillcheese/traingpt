// Optional semantic evaluation against the actual extractor model; never included in offline verify.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import OpenAI from 'openai';
import { ATHLETE_CONTEXT_PROMPT, ATHLETE_CONTEXT_SCHEMA } from '../utils/athleteContextExtraction.ts';
import { validateAthleteContext } from '../utils/athleteContext.ts';
const cases = [
  ['I want to swim on Monday and Fri, and do strength sessions 3x a week', c => { assert.equal(c.sportAvailability?.swim, undefined); assert.deepEqual(c.preferredSportDays?.swim?.sort(), ['Friday', 'Monday']); assert.ok(c.unsupportedRequests?.length); }],
  ['I can only swim Wednesday and Thursday.', c => assert.deepEqual(c.sportAvailability?.swim?.sort(), ['Thursday', 'Wednesday'])],
  ['I prefer swimming Wednesday.', c => { assert.equal(c.sportAvailability?.swim, undefined); assert.ok(c.preferredSportDays?.swim?.length || c.preferences?.length); }],
  ['I cannot train Friday.', c => assert.deepEqual(c.unavailableDays, ['Friday'])],
  ['I play hard soccer every Tuesday.', c => { assert.equal(c.recurringCommitments?.[0]?.day, 'Tuesday'); assert.equal(c.recurringCommitments?.[0]?.intensity, 'hard'); }],
  ['I sometimes play soccer Tuesday.', c => { assert.equal(c.recurringCommitments, undefined); assert.ok(c.preferences?.length); }],
  ['I want my long run Sunday.', c => assert.equal(c.preferredLongRunDay, 'Sunday')],
  ['I’m racing a marathon November 8, 2027 after my 70.3.', c => assert.deepEqual(c.secondaryEvent, { raceType: 'Marathon', raceDate: '2027-11-08' })],
  ['My knee sometimes hurts.', c => { assert.equal(c.unavailableDays, undefined); assert.equal(c.sportAvailability, undefined); assert.ok(c.preferences?.some(p => p.strength === 'context')); }],
  ['I can only swim Thursday. Thursday is my rest day.', c => { assert.deepEqual(c.sportAvailability?.swim, ['Thursday']); assert.equal(c.restDay, 'Thursday'); }],
];
for (const [notes, verify] of cases) test(`live semantic interpretation: ${notes}`, { skip: !process.env.OPENAI_API_KEY }, async () => {
  const client = new OpenAI({ timeout: 20000, maxRetries: 0 });
  const response = await client.chat.completions.create({ model: 'gpt-4o-mini', temperature: 0, max_tokens: 2500,
    messages: [{ role: 'system', content: ATHLETE_CONTEXT_PROMPT }, { role: 'user', content: notes }],
    response_format: { type: 'json_schema', json_schema: { name: 'athlete_context_v1', strict: true, schema: ATHLETE_CONTEXT_SCHEMA } } });
  assert.equal(response.choices[0].finish_reason, 'stop');
  verify(validateAthleteContext(JSON.parse(response.choices[0].message.content)));
});
