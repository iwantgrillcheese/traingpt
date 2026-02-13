#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const POSTS_PATH = path.join(ROOT, 'data', 'seo-generated-posts.json');
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
A plan only works when it survives real life. Start each week by locking in two non-negotiables: your long session and your key quality session. Everything else is supporting volume that can move around your calendar.

### Weekly Planning Rhythm
At the start of each week, review available time, recovery status, and upcoming constraints. If travel or work is heavy, compress support sessions and protect key intent.

### Intensity Management
Keep most aerobic sessions easy and reserve higher intensity for one focused workout. If a quality day underperforms, do not force another hard day immediately.

### Durability and Strength
Use short mobility and strength blocks to improve durability. The objective is consistent training availability, not maximal lifting.

### Fueling and Hydration
Practice fueling during long sessions and race-specific efforts. Treat nutrition as a trainable skill, not an afterthought.

### Recovery Rules
If sleep, mood, and execution quality trend down for several days, reduce intensity first. Early adjustments prevent larger setbacks.

### Progression Controls
Progress with planned down-weeks. Stable progression over months beats erratic spikes followed by missed training.

### Race-Specific Preparation
As race day gets closer, include specific pacing and fueling simulation while keeping the aerobic base intact.

### Missed Session Framework
If a session is missed, preserve weekly intent and avoid stacking hard efforts back-to-back.

### Review and Iterate
Close each week with a short review and tune the next week based on execution quality.`;

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }

function estimateWordCount(markdown) {
  return markdown.replace(/[`#*\-|]/g, ' ').split(/\s+/).filter(Boolean).length;
}

function topUpToMinWords(content, minWords = 1200) {
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

  let idx = 0;
  while (estimateWordCount(content) < minWords && idx < blocks.length) {
    content += `\n\n### Coaching Implementation ${idx + 1}\n${blocks[idx]}`;
    idx += 1;
  }

  if (estimateWordCount(content) < minWords) {
    content += `\n\n## Extended FAQ and Execution Playbook
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

function contentFor(keyword, secondary, variant) {
  const title = keyword[0].toUpperCase() + keyword.slice(1);
  const intros = [
    `If you're searching for **${keyword}**, this guide gives you a practical framework you can apply immediately.`,
    `Most athletes looking up **${keyword}** want clarity, structure, and confidence. This plan format is built for that.`,
    `A strong approach to **${keyword}** should be progressive, realistic, and specific to your schedule.`
  ];

  const faq = (secondary || []).slice(0,4).map((k)=>`### ${k}\nUse this as a framework, then adjust your volume and intensity to your current fitness and recovery.`).join('\n\n');

  let c = `# ${title}\n\n${intros[variant % intros.length]}\n\n## Who This Plan Is For\nThis article is for endurance athletes who want a structured plan with clear progression and practical decision rules.\n\n## Key Training Principles\n1. Build with periodization.\n2. Keep most work aerobic.\n3. Progress volume gradually.\n4. Protect recovery and sleep.\n\n## The Training Plan\n| Week | Focus | Key Sessions | Weekly Volume |\n|---|---|---|---|\n| 1 | Base | 1 quality + 1 long + easy support work | 4.5-6.0 hrs |\n| 2 | Base | Slight progression + strides | 5.0-6.5 hrs |\n| 3 | Build | Tempo/threshold focus | 5.5-7.0 hrs |\n| 4 | Deload | Lower volume and lower long session | 4.0-5.0 hrs |\n| 5 | Build | Specific endurance | 6.0-7.5 hrs |\n| 6 | Build/Peak | Race-specific long work | 6.5-8.0 hrs |\n| 7 | Peak | Simulation and sharpening | 7.0-8.5 hrs |\n| 8 | Taper | Freshness and confidence | 4.0-5.5 hrs |\n\n## How to Customize the Plan\n- Start from your current weekly baseline.\n- Keep key sessions separated by easy days.\n- Move sessions to match your calendar while preserving intent.\n\n## Common Mistakes\n- Too much intensity too early.\n- Skipping recovery because workouts feel easy.\n- Ignoring fueling practice until race week.\n\n## FAQ\n${faq}\n\nRelated: [AI triathlon coach](/blog/ai-triathlon-coach), [adaptive training plan](/blog/ai-vs-human-coach), [best triathlon training plan](/blog/best-triathlon-training-plan).\n\nWant your exact version? Use TrainGPT to generate a personalized plan for your race date and schedule.`;

  if (estimateWordCount(c) < 1250) {
    c += LONG_APPENDIX;
    c = topUpToMinWords(c, 1250);
  }

  return c;
}

const posts = readJson(POSTS_PATH, []);
const today = new Date().toISOString().slice(0,10);
let touched = 0;
const repaired = posts.map((p, i) => {
  if (!String(p.date).startsWith(today)) return p;
  touched += 1;
  const keyword = p.primaryKeyword || p.title.toLowerCase();
  return {
    ...p,
    image: IMAGE_POOL[i % IMAGE_POOL.length],
    content: contentFor(keyword, p.secondaryKeywords, i),
  };
});

writeJson(POSTS_PATH, repaired);
console.log(JSON.stringify({ ok:true, repaired:touched, date:today }, null, 2));
