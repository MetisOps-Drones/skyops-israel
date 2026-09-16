# SkyOps Israel

Web platform for drone pilots, commercial operators, and fleet managers in Israel: interactive flight-bubble
coordination, automated airspace compliance checks, license expiration tracking, a digital logbook with
hardware wear-and-tear monitoring, a Theory LMS, and an Ops CRM for manual NOTAM dispatchers.

Next.js 14 (App Router, Server Actions, TypeScript) · Supabase (Postgres + PostGIS) · Mapbox GL JS ·
TanStack React Query + Zustand · React Hook Form + Zod · Tailwind CSS + shadcn-style UI, RTL/Hebrew by default.

## 1. Prerequisites

- Node.js 18.18+ and npm (not installed in the environment this project was scaffolded in — install from
  https://nodejs.org before continuing)
- A [Supabase](https://supabase.com) project (or the [Supabase CLI](https://supabase.com/docs/guides/cli) for local dev)
- A [Mapbox](https://account.mapbox.com) access token

## 2. Install

```bash
npm install
```

## 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase
  project's API settings.
- `NEXT_PUBLIC_MAPBOX_TOKEN` — a Mapbox access token.
- `OPENWEATHERMAP_API_KEY` — a free [OpenWeatherMap](https://openweathermap.org/api) API key; without it, the map
  screen's weather panel (`/api/weather`) returns a 500.
- `CRON_SECRET` — any long random string; the daily license-expiry cron route checks this as a Bearer token.
- `SMS_PROVIDER_*` — optional. Without these, SMS sends are logged to the server console instead (see
  `src/lib/notifications/sms.ts`).

## 4. Database

Apply the migrations in `supabase/migrations/` in order. With the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates every table, enum, RLS policy, PostGIS spatial index, and the four mock Israeli airspace zones
(Ben Gurion CTR, Palmachim, Tel Aviv Urban Zone, North Firing Zone) used to make Module A's spatial check
testable without a real CAAI/IAF data feed.

> **Local dev note:** `pg_cron` (used by `0010_expiry_sweep_and_cron.sql` to schedule the daily license sweep)
> is available on hosted Supabase projects but is not part of the default local CLI Postgres image. If
> `supabase db reset` fails on that migration locally, comment out the `select cron.schedule(...)` call —
> everything else in the migration still applies, and the sweep function can be invoked manually or from the
> `/api/cron/check-license-expirations` route in the meantime.

Regenerate `src/lib/types/database.types.ts` from your live schema once the project is linked:

```bash
npm run supabase:types
```

## 5. Run

```bash
npm run dev
```

Visit `http://localhost:3000` — you'll land on `/auth/login`. Sign up; a `profiles` row is created
automatically (`handle_new_user` trigger) with role `pilot_hobby`. To try the Ops CRM (`/ops`), update that
user's `role` to `dispatcher_admin` directly in the Supabase Table Editor.

## 6. Cron

`vercel.json` schedules `/api/cron/check-license-expirations` daily at 07:00 UTC when deployed to Vercel. On
any other host, hit that route once a day with `Authorization: Bearer $CRON_SECRET`.

## Project layout

```
src/
  app/
    (app)/              Authenticated shell: dashboard, map, logs, academy, ops
    api/cron/            Daily license-expiry sweep + SMS dispatch
    api/telemetry/parse/ DJI CSV/TXT telemetry parser endpoint
    auth/                 Login/signup + OAuth callback
  actions/               Server Actions (flight requests, NOTAM publish, PDF export, document OCR upload)
  components/
    ui/                   shadcn-style primitives
    layout/ map/ ops/ logs/ academy/ dashboard/
  hooks/                  TanStack Query hooks
  stores/                 Zustand stores (map draw state, UI state)
  lib/
    supabase/             Browser/server/middleware Supabase clients
    geo/                   Turf spatial checks, DMS formatting, GeoJSON<->WKT
    telemetry/              DJI CSV/TXT parser
    ocr/                    License expiry OCR (real provider or simulated fallback)
    pdf/                    react-pdf regulatory report document
    validations/            Zod schemas
supabase/migrations/       PostGIS schema, enums, RLS policies, mock airspace zone seed data
```
