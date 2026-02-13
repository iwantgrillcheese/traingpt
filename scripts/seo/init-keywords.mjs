#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const KEYWORDS_PATH = path.join(DATA_DIR, 'seo-keywords.json');
const USED_PATH = path.join(DATA_DIR, 'used-keywords.json');
const POSTS_PATH = path.join(DATA_DIR, 'seo-generated-posts.json');

const SEEDS = {
  triathlon: [
    'triathlon training plans','ironman training plans','70.3 training plans','beginner triathlon training','olympic triathlon training','sprint triathlon training','triathlon periodization','triathlon workouts','triathlon weekly schedule'
  ],
  running: [
    'marathon training plans','half marathon training plans','beginner running plans','sub-3 marathon plans','sub-4 marathon plans','running periodization','running workouts','long run strategy','taper strategy','running pacing'
  ],
  cycling: ['FTP training plans','cycling training plans','bike workouts','zone 2 training cycling'],
  swimming: ['swim training plan','swim workouts','triathlon swim tips'],
  ai: ['AI running coach','AI triathlon coach','AI marathon training','personalized training plans','adaptive training plans'],
};
const PFX = ['8 week','10 week','12 week','16 week','beginner','intermediate','advanced','masters','time-crunched'];
const SFX = ['for beginners','for busy professionals','with weekly schedule','with pace guidance','pdf','free template','with taper','with fueling strategy'];

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f,'utf8')); } catch { return fb; } };
const writeJson = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive:true }); fs.writeFileSync(f, JSON.stringify(d, null, 2)+'\n'); };

function intent(k){ if(/plan|schedule|week/i.test(k)) return 'plan'; if(/vs|best|compare/i.test(k)) return 'comparison'; return 'informational'; }
function diff(k){ if(/ironman|marathon|ai coach|training plans/i.test(k)) return 'high'; if(/beginner|tips|workouts|strategy/i.test(k)) return 'low'; return 'medium'; }

const existing = readJson(KEYWORDS_PATH, []);
if (existing.length > 200) {
  console.log(JSON.stringify({ ok: true, existing: existing.length }, null, 2));
  process.exit(0);
}

const seen = new Set();
const out = [];
for (const [category, seeds] of Object.entries(SEEDS)) {
  for (const seed of seeds) {
    const vars = new Set([seed]);
    for (const p of PFX) for (const s of SFX) vars.add(`${p} ${seed} ${s}`.trim());
    for (const k of Array.from(vars).slice(0, 60)) {
      const low = k.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      out.push({ keyword: k, category, intent: intent(k), difficulty: diff(k) });
    }
  }
}

writeJson(KEYWORDS_PATH, out);
if (!fs.existsSync(USED_PATH)) writeJson(USED_PATH, []);
if (!fs.existsSync(POSTS_PATH)) writeJson(POSTS_PATH, []);

console.log(JSON.stringify({ ok: true, keywords: out.length }, null, 2));
