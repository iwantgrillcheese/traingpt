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

const LONG_TAIL_PREFIX = ['8 week','10 week','12 week','16 week','beginner','intermediate','advanced','masters','time-crunched'];
const LONG_TAIL_SUFFIX = ['for beginners','for busy professionals','with weekly schedule','with pace guidance','with zone 2 focus','pdf','free template','with taper','with fueling strategy','with recovery days'];

const HERO_TERMS = ['marathon training','triathlon training','running track workout','cycling endurance','open water swim'];

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}
function inferIntent(keyword) {
  if (/plan|schedule|week/i.test(keyword)) return 'plan';
  if (/vs|best|compare|comparison/i.test(keyword)) return 'comparison';
  return 'informational';
}
function inferDifficulty(keyword) {
  if (/ironman|marathon|ai coach|training plans/i.test(keyword)) return 'high';
  if (/beginner|tips|workouts|strategy/i.test(keyword)) return 'low';
  return 'medium';
}

function ensureKeywordBank() {
  let bank = readJson(KEYWORDS_PATH, []);
  if (bank.length > 200) return bank;

  const seen = new Set();
  const out = [];
  for (const [category, seeds] of Object.entries(SEEDS)) {
    for (const seed of seeds) {
      const variants = new Set([seed]);
      for (const p of LONG_TAIL_PREFIX) for (const s of LONG_TAIL_SUFFIX) variants.add(`${p} ${seed} ${s}`.trim());
      for (const v of Array.from(variants).slice(0, 60)) {
        const key = v.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          keyword: v,
          category,
          intent: inferIntent(v),
          difficulty: inferDifficulty(v),
        });
      }
    }
  }
  bank = out;
  writeJson(KEYWORDS_PATH, bank);
  return bank;
}

function estimateWordCount(markdown) {
  return markdown.replace(/[`#*\-|]/g, ' ').split(/\s+/).filter(Boolean).length;
}

function buildWeekTable() {
  return `| Week | Focus | Key Workouts | Weekly Volume |
|---|---|---|---|
| 1 | Base setup | 1 quality + 1 long + easy runs | 4.5-6.0 hrs |
| 2 | Aerobic build | Progress long run, add strides | 5.0-6.5 hrs |
| 3 | Build | Tempo/threshold progression | 5.5-7.0 hrs |
| 4 | Deload | Reduced volume and long run | 4.0-5.0 hrs |
| 5 | Build | Specific endurance work | 6.0-7.5 hrs |
| 6 | Peak prep | Long run specificity | 6.5-8.0 hrs |
| 7 | Peak | Race-specific simulation | 7.0-8.5 hrs |
| 8 | Taper | Freshen up and sharpen | 4.0-5.5 hrs |`;
}

function createArticle({ primary, secondary }) {
  const title = primary.keyword[0].toUpperCase() + primary.keyword.slice(1);
  const faq = secondary.map((k) => `### ${k}\nShort answer: tailor volume and intensity to your training history, then progress gradually.`).join('\n\n');

  let content = `# ${title}

If you're searching for **${primary.keyword}**, you likely want a plan that is practical, progressive, and realistic for your week-to-week life as an athlete.

## Who This Plan Is For
This guide is for endurance athletes who want structure without guesswork, including beginners returning from inconsistency and experienced athletes trying to avoid plateaus.

## Key Training Principles
1. **Periodization:** Rotate base, build, peak, and taper blocks.
2. **Volume control:** Increase total training load in manageable steps.
3. **Intensity distribution:** Keep most sessions easy and place quality sessions deliberately.
4. **Recovery:** Sleep, fueling, and down-weeks are part of performance.

## The Training Plan
Below is a sample framework you can adapt:

${buildWeekTable()}

The exact week should be adjusted for race distance, current fitness, and available training hours.

## How to Customize the Plan
- Start from your current weekly volume, not your dream volume.
- Keep long-run/long-ride growth gradual.
- Move sessions across the week to match your work/life rhythm.
- Protect one recovery day after quality work.

## Common Mistakes
- Doing too much intensity too often.
- Treating taper as complete rest.
- Ignoring nutrition and hydration practice.
- Skipping easy days because they feel "too easy".

## FAQ
${faq}

See also: [AI triathlon coach](/blog/ai-triathlon-coach), [adaptive training plan](/blog/ai-vs-human-coach), [personalized marathon plan](/plan).

Ready to personalize this? Use TrainGPT to generate a plan matched to your race date, experience, and weekly availability.`;

  while (estimateWordCount(content) < 1250) {
    content += `\n\n### Practical Coaching Notes\nConsistency over 8-16 weeks beats one perfect week. Keep easy days truly easy, and use workouts to build race-specific durability. Review each week: what felt sustainable, what felt excessive, and where recovery needs to improve. Repeat this loop to keep the plan adaptive and realistic.`;
  }

  return {
    slug: slugify(primary.keyword),
    title,
    description: `A practical coach-level guide to ${primary.keyword}, including periodization, weekly structure, and customization tips.`,
    tag: 'Training Tip',
    date: new Date().toISOString().slice(0, 10),
    image: '/tiles/podium-shot.jpg',
    heroImageKeyword: HERO_TERMS[Math.floor(Math.random() * HERO_TERMS.length)],
    content,
  };
}

function validateArticle(post) {
  const words = estimateWordCount(post.content);
  const hasTable = /\|\s*Week\s*\|/i.test(post.content);
  const hasFaq = /## FAQ/i.test(post.content);
  const hasCta = /TrainGPT|generate a plan|personalize/i.test(post.content);
  const hasInternalLinks = (post.content.match(/\]\(\/blog\//g) || []).length >= 1;

  return {
    ok: words >= 1200 && hasTable && hasFaq && hasCta && hasInternalLinks,
    checks: { words, hasTable, hasFaq, hasCta, hasInternalLinks },
  };
}

function run() {
  const bank = ensureKeywordBank();
  const used = new Set(readJson(USED_PATH, []));
  const posts = readJson(POSTS_PATH, []);

  const available = bank.filter((k) => !used.has(k.keyword));
  if (available.length < 3) throw new Error('Not enough unused keywords in seo-keywords.json');

  const picked = available.slice(0, 3);
  const created = [];

  for (let i = 0; i < picked.length; i++) {
    const primary = picked[i];
    const secondary = available.slice(i + 1, i + 5).map((k) => k.keyword);
    const post = createArticle({ primary, secondary });
    const validation = validateArticle(post);
    if (!validation.ok) throw new Error(`Article failed validation for ${primary.keyword}: ${JSON.stringify(validation.checks)}`);

    created.push({ ...post, primaryKeyword: primary.keyword, secondaryKeywords: secondary });
    used.add(primary.keyword);
  }

  writeJson(POSTS_PATH, [...posts, ...created]);
  writeJson(USED_PATH, Array.from(used));

  console.log(JSON.stringify({ ok: true, created: created.map((p) => p.slug) }, null, 2));
}

run();
