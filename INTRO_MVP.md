# Intro.ai MVP Plan (Resume → Site → Publish)

## Goal
Upload a resume, generate a polished personal website, and publish it to a subdomain like:

`https://{slug}.intro.ai`

## Product Constraint
Intro is a **resume transformation tool**, not a freeform website builder.

## North Star UI
Notion-like: minimal, premium typography, calm spacing, responsive/mobile-first.

---

## MVP Scope (Vertical Slice)

1. **Create flow** (`/intro`)
   - Upload resume (PDF/DOCX)
   - Fallback: paste resume text manually
   - Generate structured site data via OpenAI
   - Pick template + slug

2. **Data model + persistence**
   - `sites` table in Supabase
   - Store:
     - raw resume text
     - structured `SiteData` JSON
     - selected template
     - published static HTML

3. **Templates**
   - 3 templates: Minimal, Modern, Studio
   - Section flow: Hero → About → Experience → Projects → Skills → Contact

4. **Publish pipeline** (`/api/intro/publish`)
   - Render template to static HTML with `renderToStaticMarkup`
   - Store HTML in `sites.published_html`
   - Return `https://{slug}.intro.ai`

5. **Subdomain routing**
   - Middleware reads host and extracts slug
   - Rewrite to `/s/[slug]`
   - Route returns static HTML from DB

---

## Proposed Architecture

- **Frontend**: Next.js app routes (`/intro`, `/intro/[id]` optional)
- **APIs**:
  - `POST /api/intro/generate`
  - `POST /api/intro/publish`
  - `GET /api/intro/slug-availability?slug=...`
- **DB**: Supabase (`sites` table + RLS)
- **AI**: OpenAI JSON-mode generation validated by Zod
- **Rendering**:
  - React template components under `app/intro/templates/*`
  - server-side render to static HTML
- **Delivery**:
  - subdomain host rewrite in `middleware.ts`
  - static HTML response from `/s/[slug]`

---

## Environment Variables

Use these (documented in `.env.intro.example`):

- `OPENAI_API_KEY` — model generation for SiteData
- `INTRO_OPENAI_MODEL` — optional model override (default `gpt-5-mini`)
- `SUPABASE_URL` — server-side Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` — server-side write/publish operations
- `NEXT_PUBLIC_SUPABASE_URL` — client access
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client auth
- `NEXT_PUBLIC_INTRO_BASE_DOMAIN` — e.g. `intro.ai`
- `INTRO_SITE_SCHEME` — `https` (default)

Optional:
- `MAX_RESUME_CHARS` — extraction safety limit (default ~120k)
- `INTRO_PUBLISH_CACHE_SECONDS` — CDN cache for published pages

---

## DNS + Vercel setup (required)

1. Add wildcard domain in Vercel for `*.intro.ai`
2. DNS wildcard record:
   - `*.intro.ai` CNAME → Vercel target
3. Ensure apex/root domain config remains intact (`intro.ai`)
4. Middleware must preserve platform internals and only rewrite app subdomains.

---

## PR Plan (small + green)

1. PR1: schema + migration + RLS + types (`SiteData` + zod)
2. PR2: `/intro` upload flow + resume extraction + `/api/intro/generate`
3. PR3: templates + `/api/intro/publish` static render
4. PR4: subdomain middleware + `/s/[slug]` serving + 404/not-published
5. PR5: polish (slug checker, publish success screen, copy URL)

Each PR must pass build and keep changes reversible.
