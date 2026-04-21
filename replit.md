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

### Data Sources
- РПЛ football: ESPN API
- КХЛ, Единая лига ВТБ, Суперлига волейбол: TheSportsDB API
- Translations: `sportsTranslations.ts` (team names, venues → Russian)
