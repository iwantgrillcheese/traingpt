import type { CoachGuide } from '@/types/coachGuides';

export const COACH_GUIDES: CoachGuide[] = [
  {
    id: 'read-plan',
    title: 'How to read this plan (so you don’t overthink it)',
    body:
      'Most workouts should feel controlled, especially early on. The plan is built around consistency — not crushing every session. ' +
      'If you’re unsure whether something is “hard enough,” ask your coach before you add intensity.',
    tags: ['expectations'],
    priority: 10,
    applicableTo: { experience: ['beginner'] },
    ctas: [
      {
        label: 'Explain my first week',
        type: 'open_coaching',
        prompt: 'Can you explain how I should approach my first week of training and what matters most?',
      },
    ],
  },
  {
    id: 'time-goals',
    title: 'Setting a realistic time goal (without guessing)',
    body:
      'For your first race, the best “goal” is execution: steady pacing, fueling on longer sessions, and showing up consistently. ' +
      'Once you have a few solid weeks logged, we can tighten a time target based on what your training shows — not vibes.',
    tags: ['time_goals'],
    priority: 9,
    applicableTo: { experience: ['beginner'] },
    ctas: [
      {
        label: 'Help me set a realistic goal',
        type: 'open_coaching',
        prompt:
          'Based on my race type and experience, what’s a realistic goal for me and what should I focus on most?',
      },
    ],
  },
  {
    id: 'bike-basics',
    title: 'Bike: what you need (and what you don’t)',
    body:
      'Any safe, comfortable road bike is enough for your first triathlon. Fitness and pacing matter way more than fancy gear. ' +
      'If you buy used, the key is safety: correct size, shifting works, brakes are strong, and no frame damage.',
    tags: ['bike', 'gear'],
    priority: 8,
    applicableTo: { experience: ['beginner'] },
    resources: [
      {
        kind: 'budget',
        label: 'Facebook Marketplace (budget used bikes)',
        href: 'https://www.facebook.com/marketplace/',
        note: 'Great deals — plan on a safety check at a shop.',
      },
      {
        kind: 'safe',
        label: 'Local bike shop (used + safety check)',
        href: 'https://www.google.com/maps/search/bike+shop+near+me',
        note: 'More expensive, but you buy confidence.',
      },
      {
        kind: 'convenient',
        label: 'OfferUp (budget used bikes)',
        href: 'https://offerup.com/',
        note: 'Same rule: check size + brakes + shifting.',
      },
    ],
    ctas: [
      {
        label: 'Sanity-check a used bike listing',
        type: 'open_coaching',
        prompt:
          'I’m looking at a used bike. What frame size should I aim for and what red flags should I avoid? (I can paste the listing.)',
      },
    ],
  },
  {
    id: 'fueling-basics',
    title: 'Fueling basics (simple rules that work)',
    body:
      'Rule of thumb: if a session is over 75–90 minutes, you should be taking in calories — especially on the bike. ' +
      'If you feel flat, unusually sore, or dread workouts, it’s often under-fueling (or under-sleeping), not “lack of fitness.”',
    tags: ['fueling'],
    priority: 7,
    applicableTo: { experience: ['beginner'] },
    resources: [
      {
        kind: 'convenient',
        label: 'The Feed (endurance nutrition variety)',
        href: 'https://thefeed.com/',
        note: 'Buy singles first before committing to a big box.',
      },
      {
        kind: 'safe',
        label: 'REI (easy place to try basics)',
        href: 'https://www.rei.com/',
        note: 'Good for starter gels, chews, drink mix, bottles.',
      },
    ],
    ctas: [
      {
        label: 'Help me fuel my long workouts',
        type: 'open_coaching',
        prompt:
          'Can you give me a simple fueling plan for my longer workouts (what to eat before + during) without overcomplicating it?',
      },
    ],
  },
  {
    id: 'missed-workouts',
    title: 'If you miss a workout (don’t “make it up”)',
    body:
      'Missing a session happens. Don’t stack workouts to catch up — that’s where injury and burnout show up. ' +
      'Just continue with the next scheduled day. Consistency over weeks beats any single heroic session.',
    tags: ['missed_workouts'],
    priority: 6,
    applicableTo: { experience: ['beginner'] },
  },
  {
    id: 'use-coach',
    title: 'How to use your coach (so you get maximum value)',
    body:
      'Ask specific, real questions: “Is this effort right?”, “Can I move this session?”, “How should this feel?”, “What should I prioritize this week?” ' +
      'You don’t need perfect wording — I’ll help you think like a triathlete.',
    tags: ['how_to_use_coach'],
    priority: 5,
    applicableTo: { experience: ['beginner'] },
    ctas: [
      {
        label: 'Ask a question now',
        type: 'open_coaching',
        prompt: 'I’m new to triathlon — what should I focus on first, and what should I ignore for now?',
      },
    ],
  },
];
