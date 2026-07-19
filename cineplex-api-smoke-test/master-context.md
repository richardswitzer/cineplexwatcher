---
type: master-context
title: "Master Context — Cineplex Showtime API Smoke Test"
description: "Flattened single-file version of the full AI context bundle. Use when a recipient agent cannot navigate multi-file bundles. Canonical multi-file bundle lives in docs/ai-context/."
timestamp: 2026-07-18
status: reviewed
generated_from_repo: true
review_required: false
---

# Master Context — Cineplex Showtime API Smoke Test

> This is the flattened single-file version of `docs/ai-context/`. If you
> are navigating the repo normally, use `docs/ai-context/index.md` instead.

---

## Project Overview

**What this is**: A Node.js 22 / TypeScript 5 exploration and smoke-test
project that confirms Cineplex exposes a public, unauthenticated JSON API
for movie showtimes, resolves target film and theatre IDs, and returns IMAX
screening data. Not yet a production service.

**Spec**: `../Cineplex_Spec.md`

**Key confirmed facts (2026-07-18)**:
- API base: `https://apis.cineplex.com/prod/cpx/theatrical/api`
- Subscription key: `dcdac5601d864addbc2675a2e96cb1f8` (public, in JS bundle, NOT a secret)
- The Odyssey film ID: `37617`
- Scotiabank Theatre Toronto ID: `7402`
- 21 IMAX screenings confirmed across 6 days on 2026-07-18

**Stack**: Node.js 22, TypeScript 5, ESM, native `fetch`, Playwright (optional), Vitest

---

## Architecture

```
cineplex-api-smoke-test/
├── src/
│   ├── config.ts             — env + API constants
│   ├── types.ts              — domain + raw API types
│   ├── normalize.ts          — raw → domain conversion, matching
│   ├── endpoint-candidates.ts — classified endpoint list
│   ├── smoke-test.ts         — main (npm run smoke)
│   ├── discover-network.ts   — Playwright network capture
│   └── inspect-page.ts       — Playwright page inspection
├── test/normalize.test.ts    — 12 Vitest unit tests
├── output/                   — runtime output (gitignored)
├── findings/API-FINDINGS.md  — findings report
├── docs/ai-context/          — multi-file OKF bundle
├── HANDOFF.md                — full handoff document
└── master-context.md         — this file
```

**Data flow (npm run smoke)**:
1. `config.ts` — read env + hardcoded API config
2. `GET /v1/movies` — resolve title → filmId
3. `GET /v1/theatres` — resolve name + city → theatreId
4. `GET /v1/showtimes` — fetch theatre × date × experience × session
5. `normalize.ts` — convert to `Screening[]`, filter by format
6. Print result + write `output/availability-result.json`

---

## Confirmed API Endpoints

Source: Live JS bundle inspection + direct API calls, 2026-07-18.
Bundle module: 54753 in build `6bzv0_Kg_dsOq69kLjNJ4`.

### Auth (required on all calls)

```http
Ocp-Apim-Subscription-Key: dcdac5601d864addbc2675a2e96cb1f8
Accept: application/json
```

No cookies. No Authorization header. No browser session required.

### 1. Movies list

```
GET https://apis.cineplex.com/prod/cpx/theatrical/api/v1/movies?language=en
```

Response: `{ items: [{ id, name, filmUrl, releaseDate, runtimeInMinutes, ... }] }`

Use to resolve a movie title to an integer `filmId`.
The Odyssey → `id: 37617`.

### 2. Theatres by city

```
GET https://apis.cineplex.com/prod/cpx/theatrical/api/v1/theatres?language=en&city=toronto
```

Response: `{ favouriteTheatres: [], nearbyTheatres: [{ theatreId, theatreName, location: { city, provinceCode, address } }] }`

Scotiabank Theatre Toronto → `theatreId: 7402`, `259 Richmond Street West, Toronto, ON`.

### 3. Showtimes (primary endpoint)

```
GET https://apis.cineplex.com/prod/cpx/theatrical/api/v1/showtimes
  ?filmId=37617
  &theatreId=7402
  &language=en
```

Response schema:
```typescript
Array<{
  theatre: string,             // "Scotiabank Theatre Toronto"
  theatreId: number,           // 7402
  dates: Array<{
    startDate: string,         // "2026-07-18T00:00:00" (local Toronto, no offset)
    movies: Array<{
      id: number,              // 37617
      name: string,            // "The Odyssey"
      experiences: Array<{
        experienceTypes: string[],  // ["IMAX", "Laser Projection"] | ["UltraAVX", "D-BOX", "Laser Projection"] | etc.
        sessions: Array<{
          vistaSessionId: number,           // stable screening ID — use for change detection
          showStartDateTime: string,        // "2026-07-18T19:00:00" — local Toronto time
          showStartDateTimeUtc: string,     // "2026-07-18T23:00:00Z"
          isInThePast: boolean,
          isReservedSeating: boolean,
          isShowtimeEnabledOnline: boolean, // true = bookable
          seatsRemaining: number,
          isSoldOut: boolean,
          auditorium: string,               // "IMAX" for IMAX screens
          ticketingRedesignUrl: string,     // booking URL
          showtimeShareKey: string,         // "v:{vSId}_t:{theatreId}_a:{areaCode}"
          areaCode: string,                 // "0000000001" = IMAX, "0000000004" = AVX+D-BOX
        }>
      }>
    }>
  }>
}>
```

---

## Identifier Reference

| Identifier | Value | Notes |
|------------|-------|-------|
| filmId (The Odyssey) | `37617` | From `/v1/movies` + `__NEXT_DATA__` |
| theatreId (Scotiabank Toronto) | `7402` | From `/v1/theatres?city=toronto` |
| locationId | same as theatreId | Appears as `LocationId=7402` in booking URLs |
| vistaSessionId | per-session integer | Stable screening identifier; use for change detection |
| areaCode IMAX | `0000000001` | Observed in booking URLs for IMAX sessions |
| areaCode AVX+D-BOX | `0000000004` | Observed in booking URLs for AVX sessions |

---

## IMAX Identification Rule

```typescript
function isImax(experience: CineplexExperience): boolean {
  return experience.experienceTypes.some(t =>
    t.toLowerCase().includes("imax")
  );
}
```

Or use `normalize.matchesFormat(experience.experienceTypes.join(", "), "IMAX")`.

---

## Booking Availability Rule

```typescript
function isBookable(session: CineplexSession): boolean {
  return session.isShowtimeEnabledOnline
    && !session.isSoldOut
    && !session.isInThePast;
}
```

---

## Time Zone

`showStartDateTime` is **local Toronto time with no UTC offset**.
Always interpret as `America/Toronto` (`showStartDateTimeUtc` provides the UTC equivalent).

---

## Endpoint Candidate Classifications

As defined in `src/endpoint-candidates.ts`:

| ID | Classification | Confidence | Notes |
|----|----------------|------------|-------|
| showtimes-by-film-theatre | `DISCOVERED_IN_CURRENT_CODE` | high | Primary confirmed endpoint |
| showtimes-all-theatres | `DISCOVERED_IN_CURRENT_CODE` | high | Omit theatreId for all-Canada |
| movies-list | `DISCOVERED_IN_CURRENT_CODE` | high | Confirmed |
| theatres-by-city | `DISCOVERED_IN_CURRENT_CODE` | high | Confirmed |
| legacy-theatres-v1 | `HISTORICAL_UNVERIFIED` | low | Not tested |
| legacy-movies-v1 | `HISTORICAL_UNVERIFIED` | low | Not tested |

---

## Domain Types (summary)

```typescript
interface Movie { id, title, releaseDate?, pageUrl? }
interface Theatre { id, name, address?, city?, province?, latitude?, longitude? }
interface Screening {
  screeningId,   // vistaSessionId or SHA-256 composite
  movieId, theatreId, startsAt, localDate, localTime,
  timezone,      // "America/Toronto"
  experienceName, auditoriumName,
  bookingUrl, isBookable, seatsRemaining, isSoldOut,
  vistaSessionId, sourceEndpoint
}
interface AvailabilityResult {
  checkedAt, target, resolved,
  endpointConfirmed, publiclyCallable,
  screenings, matchingScreenings,
  conclusions, unknowns
}
```

Full definitions: `src/types.ts`.

---

## Commands

```bash
npm install                     # install deps
npx playwright install chromium # (optional) for discover/inspect
npm run smoke                   # main smoke test — no browser needed
npm test                        # 12 unit tests
npm run discover                # Playwright network capture → output/network-observations.json
npm run inspect                 # Playwright page inspection → output/page-inspection.json
npm run explore                 # discover + inspect + smoke
```

---

## What Still Needs Building (from spec)

1. **`output/smoke-test-results.json`** — attempt-level structure per spec §11.2;
   `smoke-test.ts` writes `availability-result.json` instead.
2. **Historical endpoint tests** — spec §12; `HISTORICAL_UNVERIFIED` entries in
   `endpoint-candidates.ts` were not tested. Add a script if required.
3. **`output/network-observations.json`** and **`output/page-inspection.json`** —
   require `npx playwright install chromium` then `npm run discover` / `npm run inspect`.
4. **Production watcher** — spec §20 explicitly defers this to a later phase.
   Required: scheduling, persistence (seen vistaSessionIds), alerting channel.

---

## Agent Safety Rules (condensed — full: `docs/ai-context/08-agent-rules.md`)

1. **Do not read or print `.env`**.
2. **Do not generate checkout/cart/payment calls** — read-only access only.
3. **The subscription key is public** — commit freely, do not vault.
4. **Evidence-back all API claims** — reference `findings/API-FINDINGS.md`.
5. **Do not fabricate** endpoint confirmations, IDs, field names, or response shapes.
6. **`status: reviewed`** in a context file frontmatter = human sign-off.
