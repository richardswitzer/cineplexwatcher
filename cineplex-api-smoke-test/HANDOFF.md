---
type: handoff
title: "Agent Handoff — Cineplex Showtime API Smoke Test"
description: "Single-document handoff package for a coding/deployment agent picking up this project cold."
timestamp: 2026-07-18
status: reviewed
---

# Agent Handoff — Cineplex Showtime API Smoke Test

This document is everything a coding or deployment agent needs to continue
this project without the original context session. Read it in full before
making any changes.

---

## 1. What this project is

A Node.js 22 / TypeScript 5 smoke-test that confirms Cineplex exposes a
public, unauthenticated JSON API for movie showtimes, and queries it for
IMAX screenings of **The Odyssey** at **Scotiabank Theatre Toronto**.

This is **not** a production service yet. It is a working proof-of-concept
and exploration harness. The next phase is wiring it into a scheduled
watcher that sends an alert when a new IMAX session appears.

**Spec file**: `../Cineplex_Spec.md` (one directory up from this project).

---

## 2. Current state — what is done

| Item | Status |
|------|--------|
| Cineplex API confirmed (live, public, no auth) | ✅ CONFIRMED |
| Film ID resolved: The Odyssey = `37617` | ✅ CONFIRMED |
| Theatre ID resolved: Scotiabank Theatre Toronto = `7402` | ✅ CONFIRMED |
| Showtimes endpoint confirmed | ✅ CONFIRMED |
| IMAX sessions confirmed present (21 across 6 days) | ✅ CONFIRMED |
| `src/types.ts` — all domain + raw API types | ✅ DONE |
| `src/config.ts` — env loading + API constants | ✅ DONE |
| `src/normalize.ts` — raw → domain + matching helpers | ✅ DONE |
| `src/endpoint-candidates.ts` — classified endpoint list | ✅ DONE |
| `src/smoke-test.ts` — main entry point (`npm run smoke`) | ✅ DONE, PASSING |
| `src/discover-network.ts` — Playwright capture | ✅ WRITTEN (needs Playwright install) |
| `src/inspect-page.ts` — Playwright page inspection | ✅ WRITTEN (needs Playwright install) |
| `test/normalize.test.ts` — 12/12 unit tests passing | ✅ PASSING |
| `findings/API-FINDINGS.md` — full findings report | ✅ DONE |
| `docs/ai-context/` — OKF context bundle | ✅ DONE |
| `output/availability-result.json` — live results | ✅ GENERATED |

---

## 3. What is NOT done (next steps for the agent)

### 3a. Missing output files (low priority — optional per spec §20)

The spec calls for these but they require Playwright (browser):

```
output/network-observations.json    ← npm run discover
output/page-inspection.json         ← npm run inspect
```

These are optional for the MVP. The confirmed API was found by direct JS
bundle inspection, not by browser capture. Skip these unless explicitly
asked to run Playwright.

To generate them if needed:
```bash
npx playwright install chromium
npm run discover
npm run inspect
```

### 3b. `output/smoke-test-results.json`

The spec defines this file separately from `availability-result.json`.
The smoke test currently writes only `availability-result.json`.

To add the `smoke-test-results.json` format, modify `smoke-test.ts` to
also write the attempt-level structure defined in spec §11.2.

### 3c. Historical endpoint test (spec §12)

The spec asks to test `https://www.cineplex.com/api/v1/theatres` etc. and
label the result. These are marked `HISTORICAL_UNVERIFIED` in
`endpoint-candidates.ts`. They were deliberately skipped because a confirmed
current endpoint was already found. To complete spec §12, add a
`test-historical-endpoints` script.

### 3d. Production watcher (out of scope for current phase)

Per spec §20 and the findings doc recommendation, a production watcher would:
- Poll `GET /v1/showtimes?filmId=37617&theatreId=7402&language=en` every 5–15 min
- Detect new `vistaSessionId` values
- Send an alert (SMS, email, webhook — not yet chosen)
- Persist seen session IDs across restarts

This is explicitly listed as "Phase 2" in spec §20. Do not build it until asked.

---

## 4. Confirmed API — the single most important fact

```
Base URL  : https://apis.cineplex.com/prod/cpx/theatrical/api
Auth key  : Ocp-Apim-Subscription-Key: dcdac5601d864addbc2675a2e96cb1f8
            (PUBLIC — embedded in Cineplex's own JS bundle, not a secret)
```

### Endpoints (all confirmed 2026-07-18)

```
GET /v1/movies?language=en
  → { items: [{ id, name, filmUrl, releaseDate }] }

GET /v1/theatres?language=en&city=toronto
  → { nearbyTheatres: [{ theatreId, theatreName, location: { city, provinceCode, address } }] }

GET /v1/showtimes?filmId=37617&theatreId=7402&language=en
  → Array<{ theatre, theatreId, dates: [{ startDate, movies: [{ id, experiences: [{ experienceTypes[], sessions[] }] }] }] }>
```

### Key resolved identifiers

| Thing | ID | Source |
|-------|----|--------|
| The Odyssey | filmId `37617` | `/v1/movies` response + `__NEXT_DATA__` hydration |
| Scotiabank Theatre Toronto | theatreId `7402` | `/v1/theatres?city=toronto` response |

### IMAX identification

Filter `experiences` where `experienceTypes` contains a string including "IMAX".
The `auditorium` field in sessions also reads `"IMAX"`.
Confirmed format label: `"IMAX, Laser Projection"`.

### Booking state

A session is bookable when:
- `isShowtimeEnabledOnline === true`
- `isSoldOut === false`
- `isInThePast === false`

### Stable screening identifier

`vistaSessionId` (integer) — use this for change detection in a watcher.

---

## 5. Repository structure

```
cineplex-api-smoke-test/
├── AGENTS.md                     ← agent entry point (points to docs/ai-context/08-agent-rules.md)
├── HANDOFF.md                    ← this file
├── package.json
├── tsconfig.json
├── .env.example                  ← copy to .env to customise targets
├── .gitignore
├── src/
│   ├── config.ts                 ← API constants + env reader
│   ├── types.ts                  ← all TypeScript interfaces
│   ├── normalize.ts              ← raw → domain, matching helpers
│   ├── endpoint-candidates.ts    ← classified endpoint list
│   ├── smoke-test.ts             ← npm run smoke (main)
│   ├── discover-network.ts       ← npm run discover (Playwright)
│   └── inspect-page.ts           ← npm run inspect (Playwright)
├── test/
│   └── normalize.test.ts         ← 12 unit tests
├── output/
│   ├── availability-result.json  ← last smoke-test result
│   └── .gitkeep
├── findings/
│   └── API-FINDINGS.md           ← confirmed endpoint findings report
└── docs/
    └── ai-context/               ← OKF context bundle (from agent-kits template)
        ├── index.md
        ├── 00-project-overview.md
        ├── 01-architecture.md
        ├── 05-api-and-data-flow.md
        ├── 08-agent-rules.md
        └── log.md
```

---

## 6. Setup and commands

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Install Playwright browser for discover/inspect scripts
npx playwright install chromium

# 3. Copy and edit .env if you want to change target movie/theatre/format
cp .env.example .env

# 4. Run the smoke test (no browser needed)
npm run smoke

# 5. Run unit tests
npm test

# 6. Run browser-based endpoint discovery (requires Playwright)
npm run discover

# 7. Run page inspection (requires Playwright)
npm run inspect

# 8. Run full explore pipeline
npm run explore
```

**Exit codes for `npm run smoke`:**

| Code | Meaning |
|------|---------|
| 0 | Endpoint confirmed, test completed |
| 1 | Unexpected implementation error |
| 2 | Movie could not be resolved |
| 3 | Theatre could not be resolved |
| 4 | No candidate endpoint discovered |
| 5 | Endpoint not reproducible outside browser |
| 6 | Rate limited (429) |
| 7 | Response schema not understood |

---

## 7. Environment variables

All variables have working defaults. Override in `.env` only if targeting a
different movie, theatre, or format.

```dotenv
TARGET_MOVIE_TITLE=The Odyssey
TARGET_THEATRE_NAME=Scotiabank Theatre Toronto
TARGET_FORMAT=IMAX
TARGET_CITY=Toronto
TARGET_PROVINCE=ON
TARGET_COUNTRY=CA
TARGET_DATE_FROM=            # leave blank for all available dates
TARGET_DATE_TO=              # leave blank for all available dates
CINEPLEX_MOVIE_URL=          # override if slug-based URL fails
CINEPLEX_THEATRE_URL=        # override if slug-based URL fails
HEADLESS=true                # set false to watch the browser
```

**Do not put `Ocp-Apim-Subscription-Key` in `.env`.** It is not a secret
and lives in `src/config.ts` as a constant. See `docs/ai-context/08-agent-rules.md §3`.

---

## 8. Key agent rules (summary — full rules in `docs/ai-context/08-agent-rules.md`)

1. **Do not read or print `.env`** — it may contain future secrets.
2. **Do not generate code that writes to checkout/payment/cart endpoints.**
3. **The API subscription key is public and may be committed to VCS.**
4. **Any factual claim about API behaviour must be evidence-backed** — check `findings/API-FINDINGS.md` and `src/endpoint-candidates.ts`.
5. **Do not fabricate endpoint confirmations, IDs, or response fields.**

---

## 9. Important implementation notes

- All source uses **ESM** (`"type": "module"` in package.json). Use `.js`
  extensions in imports (even for `.ts` files — `tsx` resolves them).
- The `src/config.ts` file has a minimal `.env` parser — no `dotenv` dependency.
- `showStartDateTime` in the API response is **local Toronto time with no
  UTC offset**. Always interpret as `America/Toronto`.
- The showtimes response returns **all available dates** (typically 6 days)
  in a single call — no separate "bookable dates" endpoint is needed.
- When calling without `theatreId`, the API returns all 150 Canadian Cineplex
  theatres in one payload (~large). Always pass `theatreId` when known.

---

## 10. Context bundle

The full OKF context bundle is at `docs/ai-context/`. Start at
`docs/ai-context/index.md` for navigation, or read
`docs/ai-context/05-api-and-data-flow.md` for the API reference.

Original template source: `PaymentEvolution/agent-kits` →
`ai-context-okf-bundle` (private repo, accessible via `gh` CLI).
