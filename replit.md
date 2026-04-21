# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Спорт России App Notes

### Badge Fix System (`artifacts/api-server/src/routes/sports.ts`)
TheSportsDB serves mostly-transparent PNG badges for КХЛ (97-99%), Единая лига ВТБ (~99%), and Суперлига волейбол (~94-100%) teams. Fixed via `BADGE_FIXES` map:
- **Key**: filename stem from TheSportsDB badge URL (e.g. `27hsew1615576097`)
- **Value**: correct Wikipedia/Wikimedia Commons URL
- **Function**: `fixBadge(badge)` — replaces transparent badge with Wikipedia URL
- Covers all 24 КХЛ teams (2024-25 and 2025-26 seasons), major basketball/volleyball clubs
- Teams without Wikipedia images fall back to initials display in MatchCard

### Image Loading
- **Football (РПЛ)**: ESPN CDN direct — no proxy needed
- **Wikipedia/Wikimedia**: direct URL (CDN, no proxy needed) — bypass logic in `sportsdb.ts`
- **TheSportsDB**: proxied via `/api/sports/proxy-image` endpoint

### Push Notifications System
- **Backend scheduler** (`api-server/src/lib/notificationScheduler.ts`): polls `/api/sports/all-matches` every 60s, detects score/period changes, sends via Expo Push API
- **Token store** (`api-server/src/lib/notificationStore.ts`): in-memory Map of push tokens → favorite team names
- **Registration API**: `POST /api/notifications/register` (token + favorites), `POST /api/notifications/unregister`
- **Events triggered**: goal (football/hockey), period change (volleyball/basketball), kickoff, 3h-before reminder
- **Frontend service** (`services/pushNotifications.ts`): permission request, Expo push token, local scheduled notifications
- **Local reminders**: scheduled via `expo-notifications` for 3h-before and kickoff (works offline)
- **Re-registration**: FavoritesContext auto re-syncs token with backend when favorites change
- **Expo Go limitation**: Remote push notifications removed from Expo Go SDK 53+; local notifications work; full remote push requires dev build

### Data Sources
- **РПЛ Футбол**: ESPN API (scoreboard + standings, live scores, 90+60 day window)
- **КХЛ Хоккей**: Sofascore unofficial API — **NO API KEY REQUIRED**
  - Endpoint: `https://api.sofascore.app/api/v1/sport/ice-hockey/scheduled-events/{date}`
  - Tournament filter: `uniqueTournament.id === 268` (KHL main tournament)
  - Headers required: `User-Agent: iPhone UA`, `Referer: https://www.sofascore.com/`
  - Fetch -7 to +3 days, max 3 concurrent requests, 12h cache for past dates
  - Team logos: `https://api.sofascore.app/api/v1/team/{id}/image` (via proxy with Sofascore headers)
  - League badge: `https://api.sofascore.app/api/v1/unique-tournament/268/image/dark`
  - Period labels: Russian (1-й период, 2-й период, 3-й период, ОТ, Б/У)
- **Единая лига ВТБ** (basketball): TheSportsDB (ID: 4476)
- **Pari Суперлига** (volleyball): TheSportsDB (ID: 4545)
- **Translations**: `sportsTranslations.ts` (team names, venues → Russian)
  - КХЛ short names added (e.g. "Traktor" → "Трактор Челябинск", "SKA" → "СКА Санкт-Петербург")

### Image Loading
- **Football (РПЛ)**: ESPN CDN direct — no proxy needed
- **Wikipedia/Wikimedia**: direct URL (CDN, no proxy needed) — bypass logic in `sportsdb.ts`
- **TheSportsDB**: proxied via `/api/sports/proxy-image` with ESPN UA
- **Sofascore team/tournament images**: proxied via `/api/sports/proxy-image` with Sofascore UA + Referer header

### Rate Limiting & Sofascore IP Blocking
- `pLimit(tasks, 3)` helper limits concurrent requests to any single source
- Past date fetches (> 1 day old) cached for 12h; today/future cached for 3 min
- Sofascore IP blocking: Varnish CDN bans IPs making too many requests; returns `HTTP 403`. Typical duration: 1-24 hours. Affects: КХЛ matches + all Sofascore-sourced standings.
- **Persistent cache**: `/tmp/khl_standings_cache.json` — КХЛ standings file cache (7-day validity), survives server restarts. Written on first successful fetch, read as fallback when Sofascore is blocked.
- **In production** (different IP): Sofascore works normally; all standings populated on first request.

### Standings Data Sources
- **Футбол (РПЛ)**: ESPN (`site.api.espn.com/apis/v2/sports/soccer/rus.1/standings`) — always available
- **Хоккей (КХЛ)**: Sofascore unique-tournament/268 — conference standings + playoffs via events; persistent file cache `/tmp/khl_standings_cache.json`
- **Баскетбол (ВТБ)**: Sofascore unique-tournament/128 — season auto-probed from candidates list
- **Волейбол (Суперлига)**: Sofascore unique-tournament/1009 — season auto-probed from candidates list
