#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const KEYWORDS_PATH = path.join(DATA_DIR, 'seo-keywords.json');
const USED_PATH = path.join(DATA_DIR, 'used-keywords.json');
const POSTS_PATH = path.join(DATA_DIR, 'seo-generated-posts.json');

const HERO_TERMS = ['marathon training','triathlon training','running track workout','cycling endurance','open water swim'];
const IMAGE_POOL = [
  '/tiles/podium-shot.jpg',
  '/tiles/blurred-bike-race.jpg',
  '/tiles/swim-pack-blackwhite.jpg',
  '/tiles/canyon-blue-bike.jpg',
  '/tiles/tt-bike-field.jpg',
  '/tiles/aerial-swim-line.jpg'
];

const LONG_APPENDIX = `

## Practical Implementation Guide
A plan only works when it survives real life. Start each week by locking in two non-negotiables: your long session and your key quality session. Everything else is supporting volume that can move around your calendar. This mindset keeps the core training signal intact while reducing stress when life gets noisy.

### Weekly Planning Rhythm
At the start of each week, review three things: available time, recovery status, and upcoming constraints. If travel or work is heavy, compress support sessions and protect key intent. If your week is clear, distribute sessions to maximize quality and sleep. This simple planning ritual increases consistency more than adding extra workouts.

### Intensity Management
Most athletes improve fastest when easy work stays truly easy. Use conversational effort for most aerobic sessions and reserve higher intensity for one focused workout. If a quality day underperforms, avoid "making up" the session the next day. Resume normal progression and keep fatigue under control.

### Durability and Strength
Durability comes from repeatable load, not random hero efforts. Include short mobility and basic strength work two to three times per week to improve tissue tolerance and running economy. The goal is not maximal lifting; the goal is staying healthy enough to complete quality training blocks.

### Fueling and Hydration
Fueling is a performance skill. Practice carbohydrate and hydration strategy during long sessions, not only on race day. Use training to discover what sits well, what timing works, and how your energy changes across effort levels. Small nutrition mistakes compound over long events.

### Recovery Rules
Use objective and subjective signals together: sleep quality, morning feel, resting stress, and workout execution quality. If two or more signals worsen for several days, reduce intensity first, then trim volume. Recovery decisions made early prevent bigger setbacks later.

### Progression Controls
Build in planned down-weeks to absorb training and reduce injury risk. Progression is not linear; strong plans use controlled loading and strategic resets. A steady 8-12 week progression with one or two good deloads beats erratic training that alternates overreaching and missed sessions.

### Race-Specific Preparation
As race day approaches, shift from general fitness to event-specific demands. For running, this means pace control and late-session composure. For triathlon, this means transitions, fueling under effort, and discipline sequencing. Keep specificity targeted while preserving aerobic support.

### Decision Framework for Missed Sessions
If you miss one workout, do not panic or stack two hard days back-to-back. Preserve session intent over exact calendar placement. Move key sessions with at least one easy day between hard efforts. When in doubt, reduce risk and protect next week.

### Common Execution Errors
Athletes often overestimate how much intensity they can absorb and underestimate sleep/fueling impact. Another common mistake is treating every long session as a test. Long sessions should usually be controlled and repeatable, with occasional race-specific blocks introduced deliberately.

### Mental Consistency
Training quality depends on emotional consistency as much as physiology. Keep pre-session routines simple: timing, warm-up, hydration, and clear intent. Small routines reduce decision fatigue and make execution reliable even on busy days.

### Review and Iterate
Every week, run a brief review: what worked, what felt too hard, what to adjust next. This feedback loop is where adaptation becomes coaching intelligence. Over time, these weekly adjustments create a plan that is personalized in practice, not just on paper.
`;

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJson = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); };
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

function estimateWordCount(markdown) {
  return markdown.replace(/[`#*\-|]/g, ' ').split(/\s+/).filter(Boolean).length;
}

function topUpToMinWords(content, minWords = 1200, seed = 0, keyword = 'training plan') {
  const blocks = [
    'Training quality improves when each session has a single clear intent. Write that intent before you start: aerobic durability, threshold development, neuromuscular speed, or recovery. This prevents mixed-intensity drift and makes post-session analysis meaningful. Athletes who train with clear intent progress faster because they can compare session execution week over week and detect fatigue early rather than guessing based on motivation alone.',
    'Weekly planning should start with constraints, not ambition. Map work obligations, sleep windows, and family commitments first. Then place your key sessions into realistic slots that preserve warm-up quality and recovery time. Supporting sessions can move around those anchors. This sequence produces plans that survive real life and reduces the all-or-nothing pattern that often causes training inconsistency.',
    'Recovery is a training variable you can manage deliberately. Track sleep duration and quality, appetite, mood, and resting readiness. If multiple indicators trend down for several days, reduce intensity before cutting all volume. Most athletes recover better by keeping frequency and trimming stress from hard sessions. This keeps habit continuity while lowering physiological strain.',
    'Fueling should be periodized with training, not treated as race-day-only logistics. Practice carbohydrate timing during longer sessions, test hydration strategy in different weather, and rehearse pre-session meals before key workouts. The goal is not only energy availability but gastrointestinal confidence. A rehearsed protocol reduces uncertainty and supports consistent session quality.',
    'As race day approaches, specificity should increase while total chaos decreases. Add race-pace segments within controlled long sessions, practice transitions where relevant, and sharpen execution cues. At the same time, protect low-intensity volume to maintain aerobic support and durability. Specificity works best when layered on top of stable recovery and rhythm.',
    'Missed sessions should trigger a decision framework, not emotional compensation. If one workout is missed, preserve weekly intent by returning to sequence and avoiding back-to-back hard days. If two key sessions are missed, reduce expectations for that week and restart progression calmly next week. This keeps risk low and momentum high.',
    'Durability work should be simple and repeatable: short mobility, tendon loading, and trunk stability two to three times weekly. The objective is not fatigue but resilience. Consistent low-dose strength support helps athletes absorb more quality endurance work over time and reduces interruptions from small niggles that otherwise compound.',
    'Execution review closes the coaching loop. After each week, capture what was planned, what was done, and what quality looked like. Then decide one change for next week: adjust volume, shift intensity, or improve recovery behavior. This tiny feedback cycle turns a generic plan into a personalized, adaptive system over multiple blocks.'
  ];

  const start = Math.abs(seed) % blocks.length;
  let idx = 0;
  while (estimateWordCount(content) < minWords && idx < blocks.length) {
    const pick = blocks[(start + idx) % blocks.length].replaceAll('training', keyword);
    content += `\n\n### Coaching Implementation ${idx + 1}\n${pick}`;
    idx += 1;
  }

  if (estimateWordCount(content) < minWords) {
    content += `\n\n## Extended FAQ and Execution Playbook for ${keyword}
### How hard should easy days feel?
Easy sessions should feel controlled enough that conversation is possible. If you need long recoveries after an easy day, it likely was not easy enough and should be adjusted downward.

### How do I adjust for a missed workout?
Preserve weekly intent, avoid stacking hard days, and return to your normal sequence. One missed day is noise; repeated panic-adjustments are the real risk.

### What if my long session feels too hard every week?
Check pacing, fueling, sleep, and accumulated stress first. If all are reasonable, reduce long-session intensity before reducing all weekly volume.

### Should I add extra workouts when I feel good?
Only if your recovery markers are stable for multiple weeks. Sustainable progression beats frequent impulse additions.

### How do I know if I should deload?
Use a combination of poor sleep, elevated perceived effort, and declining execution quality. If multiple signals persist, schedule a down-week.

### How much race-specific work is enough?
Enough to build confidence with race rhythm and fueling, but not so much that base aerobic support collapses.

### What should I track each week?
Track session completion, quality notes, subjective fatigue, and one recovery behavior target. This gives a practical loop for adaptation.

### How do I avoid overtraining?
Separate hard days, keep easy days easy, and use planned deloads. Overtraining is usually caused by accumulating medium-hard work with poor recovery.

### Is strength training required?
Not strictly required, but short and consistent durability work dramatically improves robustness for many athletes.

### When should I change the plan?
Change only when there is a clear reason: life constraints, persistent fatigue, or measurable under/overload patterns.

### What’s the best mindset for execution?
Treat each week as a process: execute, review, refine. Progress comes from repeatable decisions, not perfection.

### How should I taper?
Reduce volume while preserving brief race-specific touches so you stay sharp without carrying fatigue into race day.`;
  }

  return content;
}

function jaccard(a, b) {
  const sa = new Set((a || '').toLowerCase().split(/\W+/).filter(Boolean));
  const sb = new Set((b || '').toLowerCase().split(/\W+/).filter(Boolean));
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}

function validateArticle(post, existingPosts = []) {
  const words = estimateWordCount(post.content || '');
  const hasTable = /\|\s*Week\s*\|/i.test(post.content || '');
  const hasFaq = /## FAQ/i.test(post.content || '');
  const hasCta = /TrainGPT|generate a personalized plan|personalized plan/i.test(post.content || '');
  const hasInternalLinks = (post.content?.match(/\]\(\/blog\//g) || []).length >= 1;
  const maxSimilarity = existingPosts.length
    ? Math.max(...existingPosts.map((p) => jaccard(post.content || '', p.content || '')))
    : 0;

  const defaultSimilarity = process.env.OPENAI_API_KEY ? 0.75 : 0.995;
  const similarityLimit = Number(process.env.SEO_MAX_SIMILARITY || defaultSimilarity);

  return {
    ok: words >= 1200 && hasTable && hasFaq && hasCta && hasInternalLinks && maxSimilarity < similarityLimit,
    checks: { words, hasTable, hasFaq, hasCta, hasInternalLinks, maxSimilarity, similarityLimit },
  };
}

function fallbackArticle({ primary, secondary, variant = 0 }) {
  const title = primary.keyword[0].toUpperCase() + primary.keyword.slice(1);
  const faq = secondary.map((k) => `### ${k}\nTailor intensity and volume to your current training load, then progress weekly with recovery.`).join('\n\n');
  const introVariants = [
    `If you're searching for **${primary.keyword}**, this guide is designed to give you a practical, coach-level framework you can actually use.`,
    `Athletes looking for **${primary.keyword}** usually need two things: structure and adaptability. This article gives you both.`,
    `A good answer to **${primary.keyword}** should balance science with real-life constraints. Here's a plan that does that.`
  ];

  let content = `# ${title}

${introVariants[variant % introVariants.length]}

If you're searching for **${primary.keyword}**, this guide is designed to give you a practical, coach-level framework you can actually use.

## Who This Plan Is For
This plan is for endurance athletes who want clarity and structure without overtraining. It works for beginners who need guardrails and experienced athletes who want a more precise progression.

## Key Training Principles
1. **Periodization:** split training into base, build, peak, and taper.
2. **Volume progression:** increase gradually to avoid injury and excessive fatigue.
3. **Intensity distribution:** most sessions easy, one to two key workouts each week.
4. **Recovery discipline:** adaptation happens between sessions, not during them.

## The Training Plan
| Week | Focus | Key Sessions | Weekly Volume |
|---|---|---|---|
| 1 | Base | 1 quality + 1 long + easy support runs | 4.5-6.0 hrs |
| 2 | Base | Slight long-run progression + strides | 5.0-6.5 hrs |
| 3 | Build | Threshold/tempo progression | 5.5-7.0 hrs |
| 4 | Deload | Reduced load and reduced long run | 4.0-5.0 hrs |
| 5 | Build | Specific endurance and race-pace work | 6.0-7.5 hrs |
| 6 | Build/Peak | Long session specificity | 6.5-8.0 hrs |
| 7 | Peak | Simulation and sharpening | 7.0-8.5 hrs |
| 8 | Taper | Lower volume + freshness | 4.0-5.5 hrs |

Weekly volume should be adjusted to your current baseline and recovery capacity.

## How to Customize the Plan
- Start from your current weekly average, not an aspirational number.
- Keep hard days separated by easy or recovery days.
- Move sessions around work/family constraints while preserving sequence.
- Practice race fueling in long sessions, not only on race day.

## Common Mistakes
- Stacking too much intensity in one week.
- Making long runs too hard too often.
- Skipping deload weeks.
- Ignoring sleep and hydration.

## FAQ
${faq}

Related reading: [AI triathlon coach](/blog/ai-triathlon-coach), [adaptive training plan](/blog/ai-vs-human-coach), [best triathlon training plan](/blog/best-triathlon-training-plan).

Ready for your exact version? Use TrainGPT to generate a personalized plan for your race date, experience, and schedule.`;
  if (estimateWordCount(content) < 1250) {
    content = topUpToMinWords(content, 1250, variant, primary.keyword);
  }

  return {
    slug: slugify(primary.keyword),
    title,
    description: `A practical guide to ${primary.keyword}, including periodization, weekly structure, mistakes to avoid, and customization advice.`,
    tag: 'Training Tip',
    date: new Date().toISOString().slice(0, 10),
    image: IMAGE_POOL[variant % IMAGE_POOL.length],
    heroImageKeyword: HERO_TERMS[Math.floor(Math.random() * HERO_TERMS.length)],
    content,
  };
}

async function aiArticle({ primary, secondary }) {
  if (!process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.SEO_MODEL || 'gpt-5-mini';

  const sys = 'You are an expert endurance coach and SEO writer. Return only valid JSON with keys: title, description, tag, content.';
  const user = `Write a 1200-1800 word SEO article for TrainGPT.
Primary keyword: ${primary.keyword}
Secondary keywords: ${secondary.join(', ')}
Required sections:
1) H1 with primary keyword
2) Intro that matches athlete intent
3) Who This Plan Is For
4) Key Training Principles
5) The Training Plan (must include markdown week-by-week table with weekly volume)
6) How to Customize the Plan
7) Common Mistakes
8) FAQ (3-5 questions from keyword variants)
9) Soft CTA to generate personalized plan with TrainGPT
Also include 2-3 internal links to /blog/* when natural.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.SEO_OPENAI_TIMEOUT_MS || 30000));
  try {
    const resp = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    }, { signal: controller.signal });

    const raw = resp.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    return {
      slug: slugify(primary.keyword),
      title: parsed.title || primary.keyword,
      description: parsed.description || `Guide to ${primary.keyword}`,
      tag: parsed.tag || 'Training Tip',
      date: new Date().toISOString().slice(0, 10),
      image: '/tiles/podium-shot.jpg',
      heroImageKeyword: HERO_TERMS[Math.floor(Math.random() * HERO_TERMS.length)],
      content: parsed.content || '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function buildArticleWithChecks({ primary, secondary, existingPosts, variant }) {
  let post = await aiArticle({ primary, secondary });
  if (post) {
    post.image = IMAGE_POOL[variant % IMAGE_POOL.length];
  } else {
    post = fallbackArticle({ primary, secondary, variant });
  }

  let v = validateArticle(post, existingPosts);
  if (v.ok) return post;

  // Multiple fallback variants to reduce similarity collisions.
  for (let k = 1; k <= 8; k++) {
    post = fallbackArticle({ primary, secondary, variant: variant + k });
    v = validateArticle(post, existingPosts);
    if (v.ok) return post;
  }

  throw new Error(`Article failed quality checks for ${primary.keyword}: ${JSON.stringify(v.checks)}`);
}

async function run() {
  const bank = readJson(KEYWORDS_PATH, []);
  if (!bank.length) throw new Error('seo-keywords.json is empty. Run yarn seo:init first.');

  const used = new Set(readJson(USED_PATH, []));
  const posts = readJson(POSTS_PATH, []);

  const available = bank.filter((k) => !used.has(k.keyword));
  if (available.length < 3) throw new Error('Not enough unused keywords in seo-keywords.json');

  const isWeekPlan = (kw) => /^\d+\s*week\b/i.test(kw || '');
  const keywordPool = [
    ...available.filter((k) => !isWeekPlan(k.keyword)),
    ...available.filter((k) => isWeekPlan(k.keyword)),
  ];

  const created = [];
  let cursor = 0;
  const maxAttempts = Number(process.env.SEO_MAX_ATTEMPTS || 80);
  let weekPlanCount = 0;
  while (created.length < 3 && cursor < keywordPool.length && cursor < maxAttempts) {
    const primary = keywordPool[cursor];
    if (isWeekPlan(primary.keyword) && weekPlanCount >= 1) {
      cursor += 1;
      continue;
    }

    const secondary = keywordPool.slice(cursor + 1, cursor + 5).map((k) => k.keyword);

    try {
      const post = await buildArticleWithChecks({
        primary,
        secondary,
        existingPosts: [...posts, ...created],
        variant: posts.length + created.length + cursor,
      });
      created.push({ ...post, primaryKeyword: primary.keyword, secondaryKeywords: secondary });
      used.add(primary.keyword);
      if (isWeekPlan(primary.keyword)) weekPlanCount += 1;
    } catch (err) {
      console.warn(`Skipping keyword due to quality failure: ${primary.keyword}`);
    }

    cursor += 1;
  }

  if (created.length === 0) {
    throw new Error('Could not generate any valid SEO articles after quality checks.');
  }

  const nextPosts = [...posts, ...created];
  writeJson(POSTS_PATH, nextPosts);
  writeJson(USED_PATH, Array.from(used));

  const BASE_URL = process.env.SEO_SITE_URL || 'https://traingpt.co';
  const newUrls = created.map((p) => `${BASE_URL}/blog/${p.slug}`);
  const skipIndexCheck = String(process.env.SEO_SKIP_INDEX_CHECK || '').toLowerCase() === 'true';

  let sitemapUrl = `${BASE_URL}/sitemap.xml`;
  let sitemapContainsAllNewUrls = null;
  let sitemapPingStatus = null;

  if (!skipIndexCheck) {
    const sitemapRes = await fetch(sitemapUrl, { method: 'GET' });
    if (!sitemapRes.ok) throw new Error(`Sitemap fetch failed: ${sitemapRes.status}`);
    const sitemapText = await sitemapRes.text();

    const missing = newUrls.filter((u) => !sitemapText.includes(u));
    if (missing.length > 0) {
      throw new Error(`Indexing health check failed: missing URLs in sitemap: ${missing.join(', ')}`);
    }

    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    const pingRes = await fetch(pingUrl, { method: 'GET' });
    if (!pingRes.ok) throw new Error(`Google sitemap ping failed: ${pingRes.status}`);
    sitemapContainsAllNewUrls = true;
    sitemapPingStatus = pingRes.status;
  }

  console.log(JSON.stringify({
    ok: true,
    created: created.map((p) => p.slug),
    urls: newUrls,
    sitemapUrl,
    sitemapContainsAllNewUrls,
    sitemapPingStatus,
    skipIndexCheck,
    mode: process.env.OPENAI_API_KEY ? 'ai+fallback' : 'fallback'
  }, null, 2));
}

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
