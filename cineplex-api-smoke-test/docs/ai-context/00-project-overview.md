---
type: concept
title: "Project Overview"
description: "Purpose, stack, and major subsystems of the Cineplex showtime API smoke-test project."
resource: "docs/ai-context/00-project-overview.md"
tags: [ai-context, project-overview]
timestamp: 2026-07-18
status: reviewed
generated_from_repo: true
last_verified_commit: null
review_required: false
---

# Project Overview

## What this project does

A disposable Node.js / TypeScript exploration project that determines
whether Cineplex exposes a publicly callable web API for movie showtimes
and seat availability, and confirms that a target film (The Odyssey) and
theatre (Scotiabank Theatre Toronto) can be resolved and queried for IMAX
screenings without authentication.

The project is NOT a production monitoring service. It is a smoke-test
harness that can evolve into one.

## Platforms

- Node.js 22+, TypeScript 5, ESM
- Playwright (Chromium) for browser-based endpoint discovery
- Native `fetch` for server-side API calls
- Vitest for unit tests
- Windows development environment, intended to be cross-platform

## Major subsystems

| Module | Purpose |
|--------|---------|
| `src/config.ts` | Reads `.env` + hardcoded confirmed API config |
| `src/types.ts` | Domain types (Movie, Theatre, Screening) + raw Cineplex API types |
| `src/normalize.ts` | Converts raw Cineplex API responses to domain types; format/title/theatre matching |
| `src/endpoint-candidates.ts` | Ranked, evidence-classified candidate endpoint list |
| `src/smoke-test.ts` | Main entry point: resolves IDs, fetches showtimes, prints result |
| `src/discover-network.ts` | Playwright browser — captures live API traffic |
| `src/inspect-page.ts` | Playwright browser — inspects page hydration and JS config |
| `test/normalize.test.ts` | Vitest unit tests for matching logic |
| `findings/API-FINDINGS.md` | Human-readable findings report with confirmed endpoints |

## Key discovered facts (confirmed 2026-07-18)

- Cineplex API base: `https://apis.cineplex.com/prod/cpx/theatrical/api`
- Subscription key: public, non-secret, embedded in JS bundle (`dcdac5601d864addbc2675a2e96cb1f8`)
- The Odyssey film ID: `37617`
- Scotiabank Theatre Toronto ID: `7402`
- IMAX sessions return `experienceTypes: ["IMAX", "Laser Projection"]`
- Stable session identifier: `vistaSessionId` (integer)

## Evidence reviewed

- JS bundle module 54753 in the live production Next.js build
- Direct API calls from Node.js on 2026-07-18
- `__NEXT_DATA__` hydration payload on `https://www.cineplex.com/movie/the-odyssey`

## Confidence

High — all key claims based on direct API observation, not inference.

## Unknowns

- Whether subscription key rotates (no evidence of expiry observed)
- Whether a "dates" endpoint exists separate from showtimes (not needed)
- Full semantics of `areaCode` values per experience type
