# Events Wageningen — Infrastructure Overview

You are now working in the **Events Wageningen** platform. This is a three-repo system
managed from a single GitHub repository (`events-wageningen/website`) with two
subfolders acting as separate repos:

```
/home/dconsoli/website/          ← website (Astro/TS, public-facing)
/home/dconsoli/website/db-schemas/  ← SQL schema (single source of truth)
/home/dconsoli/website/tbot/         ← Telegram bot (content authoring tool)
```

Supabase is the central data store. The bot writes to it; the website reads from it.

---

## Data Flow

```
Telegram user
  → /new command in tbot
  → multi-step conversation (grammy @conversations)
  → INSERT into Supabase (service role key, bypasses RLS)
  → upload photo to GitHub repo: public/images/{eventId}.jpg
  → trigger GitHub Actions workflow_dispatch → rebuild site
  → Astro build fetches from Supabase (anon key, SELECT only)
  → static HTML published to GitHub Pages → events-wageningen.nl
```

---

## Repo 1 — `db-schemas/`

Single source of truth for the Supabase schema.

**Key files:**
- [db-schemas/schema.sql](db-schemas/schema.sql) — table definitions + RLS policies
- [db-schemas/seed.sql](db-schemas/seed.sql) — 14 categories + 5 sample events

**Tables:**

`events`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | slugified name + year, e.g. `koningsdag-2026` |
| `name` | TEXT | display title |
| `slug` | TEXT | URL-safe, same as id |
| `description` | TEXT | markdown supported |
| `start_date` / `end_date` | TIMESTAMPTZ | ISO 8601 with tz offset |
| `location_name` / `location_city` | TEXT | city is one of 6 hardcoded values |
| `category` | TEXT[] | multi-select, 14 possible values |
| `tags` | TEXT[] | free-form |
| `url` | TEXT | organizer link |
| `price` | TEXT | `free` \| `paid` \| `donation` |
| `status` | TEXT | `scheduled` \| `cancelled` |
| `lat` / `lon` | DOUBLE PRECISION | optional GPS |
| `creator_telegram_id` | BIGINT | who added it |

`categories` — id, label, emoji (14 entries, fetched dynamically by bot and website)

`locations` — venue presets (id, name, city, lat, lon); managed via `/addlocation` / `/removelocation`

**RLS rules:** anonymous users can SELECT only; service role bypasses all policies.

**Cities (hardcoded in both bot and website):**
`Wageningen`, `Droevendaal`, `Bennekom`, `Renkum`, `Ede`, `Rhenen`

---

## Repo 2 — `tbot/`

Telegram bot — the only way to add/edit/remove events. Uses [grammy](https://grammy.dev/)
with the `@grammyjs/conversations` plugin for multi-step dialogs.

**Key files:**
- [tbot/src/index.ts](tbot/src/index.ts) — bot setup, command routing, idle timeout logic
- [tbot/src/commands/new.ts](tbot/src/commands/new.ts) — `/new` conversation (~740 lines)
- [tbot/src/commands/modify.ts](tbot/src/commands/modify.ts) — edit existing events
- [tbot/src/commands/remove.ts](tbot/src/commands/remove.ts) — delete with confirmation
- [tbot/src/commands/list.ts](tbot/src/commands/list.ts) — show top 10 upcoming events
- [tbot/src/commands/location.ts](tbot/src/commands/location.ts) — manage venue presets
- [tbot/src/lib/supabase.ts](tbot/src/lib/supabase.ts) — DB helpers (snake_case columns)
- [tbot/src/lib/github.ts](tbot/src/lib/github.ts) — image upload + workflow dispatch
- [tbot/src/lib/slugify.ts](tbot/src/lib/slugify.ts) — `toEventId(name, year)` — strips accents, lowercases, dashes
- [tbot/src/middleware/auth.ts](tbot/src/middleware/auth.ts) — whitelist via `ALLOWED_USER_IDS`

**Bot commands:**
| Command | Purpose |
|---|---|
| `/new` | Add event (multi-step: name → dates → venue → city → GPS → categories → price → description → URL → tags → photo → confirm) |
| `/list` | Top 10 upcoming events |
| `/modify` | Edit any field of an existing event |
| `/remove` | Delete event (with confirmation) |
| `/addlocation` | Add venue preset |
| `/removelocation` | Remove venue preset |
| `/cancel` | Exit active conversation |

**Idle timeout:** warns at 60 s, force-closes at 300 s.

**Event ID generation:**
```typescript
toEventId("King's Day", 2026) // → "kings-day-2026"
// strips accents, lowercase, non-alphanumeric → dash, trims edges, appends year
```

**Required env vars (`tbot/.env`):**
```
BOT_TOKEN=
SUPABASE_URL=https://kgtcykksevxshymtbotn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
GITHUB_PAT=          # scopes: repo + workflows
GITHUB_OWNER=events-wageningen
GITHUB_REPO=website
ALLOWED_USER_IDS=    # comma-separated Telegram user IDs
```

---

## Repo 3 — `website/` (root)

Static Astro site deployed to GitHub Pages at `events-wageningen.nl`.

**Key files:**
- [src/types/event.ts](src/types/event.ts) — TypeScript interfaces (camelCase)
- [src/lib/events.ts](src/lib/events.ts) — `getEvents()`, `getCategories()` via Supabase anon key
- [src/pages/index.astro](src/pages/index.astro) — main listing page
- [src/components/EventsPageContent.astro](src/components/EventsPageContent.astro) — filter UI + event grid + modal
- [src/components/EventCard.astro](src/components/EventCard.astro) — card component
- [src/pages/events/[slug].astro](src/pages/events/[slug].astro) — event detail page
- [src/pages/calendar.astro](src/pages/calendar.astro) — monthly calendar view
- [public/images/](public/images/) — event photos (uploaded by bot via GitHub API)
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml) — build + Pages deploy

**Type mapping** (Supabase snake_case → website camelCase):
```typescript
// src/lib/events.ts maps row.location_name → event.location.name, etc.
```

**Client-side filters:** category (multi), date range, price, city — all in-page JS, no backend.

**Event images:** `/images/{eventId}.jpg`; falls back to `/default.jpg` if missing.

**Calendar integrations in modal:** Google Calendar link + `.ics` download.

**Required env vars (set in GitHub Actions secrets):**
```
PUBLIC_SUPABASE_URL=https://kgtcykksevxshymtbotn.supabase.co
PUBLIC_SUPABASE_ANON_KEY=
```

---

## Deployment topology

```
events-wageningen.nl
  └─ GitHub Pages (gh-pages branch, built from dist/)

GitHub repo: events-wageningen/website
  ├─ src/          website source
  ├─ public/images/  event photos (written by bot via GitHub API)
  ├─ tbot/         Telegram bot
  ├─ db-schemas/   SQL schema
  └─ .github/workflows/deploy.yml
       triggered by: push to main OR bot workflow_dispatch

Supabase project: kgtcykksevxshymtbotn
  ├─ events        (bot writes, website reads)
  ├─ categories    (seeded; bot + website read)
  └─ locations     (bot manages)
```

---

## Common tasks cheat-sheet

| Task | Where to look |
|---|---|
| Add a new event field | `db-schemas/schema.sql` → `tbot/src/commands/new.ts` → `src/types/event.ts` → `src/lib/events.ts` |
| Add a new category | `db-schemas/seed.sql` (or INSERT directly in Supabase) |
| Change bot conversation flow | `tbot/src/commands/new.ts` or `modify.ts` |
| Change website UI/filters | `src/components/EventsPageContent.astro` |
| Change event detail page | `src/pages/events/[slug].astro` |
| Add a new bot command | `tbot/src/index.ts` + new file in `tbot/src/commands/` |
| Authorize a new bot user | Add Telegram user ID to `ALLOWED_USER_IDS` env var |
| Trigger a manual deploy | GitHub Actions → `deploy.yml` → Run workflow |
