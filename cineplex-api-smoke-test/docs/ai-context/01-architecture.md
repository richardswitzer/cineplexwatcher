---
type: concept
title: "Architecture"
description: "Repo structure, module responsibilities, and data flow for the Cineplex smoke-test project."
resource: "docs/ai-context/01-architecture.md"
tags: [ai-context, architecture]
timestamp: 2026-07-18
status: reviewed
generated_from_repo: true
last_verified_commit: null
review_required: false
---

# Architecture

## Repo layout

```
cineplex-api-smoke-test/
├── src/
│   ├── config.ts             — env + confirmed API constants
│   ├── types.ts              — domain + raw API types
│   ├── normalize.ts          — raw → domain conversion, matching helpers
│   ├── endpoint-candidates.ts — classified candidate endpoint list
│   ├── smoke-test.ts         — main entry (npm run smoke)
│   ├── discover-network.ts   — Playwright browser capture
│   └── inspect-page.ts       — Playwright page inspection
├── test/
│   └── normalize.test.ts     — Vitest unit tests
├── output/                   — generated at runtime (gitignored)
│   ├── network-observations.json
│   ├── page-inspection.json
│   ├── smoke-test-results.json
│   └── availability-result.json
├── findings/
│   └── API-FINDINGS.md       — human-readable findings report
├── docs/ai-context/          — this OKF context bundle
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## Data flow

```
npm run smoke
  └─ smoke-test.ts
       ├─ config.ts          (read env + API config)
       ├─ GET /v1/movies      → resolve filmId
       ├─ GET /v1/theatres    → resolve theatreId
       ├─ GET /v1/showtimes   → raw CineplexTheatreShowtime[]
       │    └─ normalize.ts  → Screening[]
       │         └─ matchesFormat() → matchingScreenings[]
       └─ print result + write output/availability-result.json
```

## Key design decisions

- **No dotenv dependency** — config.ts has a minimal .env parser
- **No ORM, no database** — pure HTTP + file output
- **ESM throughout** — `"type": "module"` in package.json
- **`tsx` for execution** — no compile step needed during development
- **Separate Playwright scripts** — discovery and inspection are optional; smoke-test runs without a browser

## Evidence reviewed

Source files in this repository (2026-07-18).

## Confidence

High.

## Unknowns

None significant for current phase.
