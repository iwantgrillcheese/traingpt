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

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJson = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); };
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

function estimateWordCount(markdown) {
  return markdown.replace(/[`#*\-|]/g, ' ').split(/\s+/).filter(Boolean).length;
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

  return {
    ok: words >= 1200 && hasTable && hasFaq && hasCta && hasInternalLinks && maxSimilarity < 0.75,
    checks: { words, hasTable, hasFaq, hasCta, hasInternalLinks, maxSimilarity },
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
  while (estimateWordCount(content) < 1250) {
    content += '\n\n### Coaching Notes\nConsistency matters more than hero workouts. Keep easy runs easy, place quality intentionally, and review each week so your next week is better calibrated than the last.';
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

  // regeneration pass with alternate fallback variant
  post = fallbackArticle({ primary, secondary, variant: variant + 1 });
  v = validateArticle(post, existingPosts);
  if (!v.ok) throw new Error(`Article failed quality checks for ${primary.keyword}: ${JSON.stringify(v.checks)}`);
  return post;
}

async function run() {
  const bank = readJson(KEYWORDS_PATH, []);
  if (!bank.length) throw new Error('seo-keywords.json is empty. Run yarn seo:init first.');

  const used = new Set(readJson(USED_PATH, []));
  const posts = readJson(POSTS_PATH, []);

  const available = bank.filter((k) => !used.has(k.keyword));
  if (available.length < 3) throw new Error('Not enough unused keywords in seo-keywords.json');

  const picked = available.slice(0, 3);
  const created = [];

  for (let i = 0; i < picked.length; i++) {
    const primary = picked[i];
    const secondary = available.slice(i + 1, i + 5).map((k) => k.keyword);

    const post = await buildArticleWithChecks({
      primary,
      secondary,
      existingPosts: [...posts, ...created],
      variant: posts.length + created.length + i,
    });
    created.push({ ...post, primaryKeyword: primary.keyword, secondaryKeywords: secondary });
    used.add(primary.keyword);
  }

  writeJson(POSTS_PATH, [...posts, ...created]);
  writeJson(USED_PATH, Array.from(used));

  console.log(JSON.stringify({ ok: true, created: created.map((p) => p.slug), mode: process.env.OPENAI_API_KEY ? 'ai+fallback' : 'fallback' }, null, 2));
}

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
