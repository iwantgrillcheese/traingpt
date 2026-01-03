# AGENTS.md — TrainGPT agent contract

You are an automated coding agent working in the TrainGPT repo.

## Goals
- Make small, high-quality changes that compile, typecheck, and build.
- Prefer minimal diffs over rewrites.
- Keep the product premium and consistent (spacing, typography, muted colors).

## Non-negotiables
- Do NOT add new dependencies unless the task explicitly requires it.
- Do NOT change database schema, auth, or API contracts unless explicitly requested.
- Do NOT rename or move files unless the task explicitly requests it.
- Do NOT refactor unrelated code “for cleanliness.”

## Tech stack
- Next.js App Router
- TypeScript
- Tailwind
- Supabase

## Style rules
- Keep components readable and consistent (spacing: 4/6/8, rounded-xl/2xl, subtle borders).
- Avoid bright colors; use existing grays and muted tones.
- Prefer `clsx` if already used; do not introduce new class helpers.

## Required workflow (every task)
1) Inspect relevant files first.
2) Write a short plan (bullets).
3) Implement changes.
4) Run verification:
   - `yarn lint`
   - `yarn typecheck` (or `tsc -p .` if no script)
   - `yarn build`
5) Fix any failures until green.
6) Provide a PR summary:
   - What changed
   - Files changed
   - How to verify manually (2–5 bullets)
   - Screenshots if UI changed (desktop + mobile)

## Task sizing
- One PR should touch ~1–3 components max.
- Avoid cross-cutting changes.

## UI files you will commonly edit
- /app/coaching/**
- /app/schedule/**
- /app/(marketing)/** or /app/page.tsx (landing)

## Verification notes
If verification scripts are missing, add them to package.json (see below) without changing behavior.
