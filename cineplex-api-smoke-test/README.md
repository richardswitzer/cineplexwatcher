# Cineplex Showtime API — Smoke Test & Discovery

Exploration project confirming the Cineplex public showtime API and verifying
IMAX screening availability for *The Odyssey* at Scotiabank Theatre Toronto.

## Quick start

```bash
npm install
cp .env.example .env      # optional — defaults target The Odyssey / Scotiabank IMAX
npm run smoke             # runs without a browser; exits 0 on success
npm test                  # 12 unit tests
```

## Results (2026-07-18)

- **API confirmed**: `https://apis.cineplex.com/prod/cpx/theatrical/api`
- **Public, unauthenticated**: Yes — no cookies, no account, plain `fetch()`
- **IMAX screenings found**: 21 across 6 days
- **Stable identifier**: `vistaSessionId` (integer per session)

See [`findings/API-FINDINGS.md`](findings/API-FINDINGS.md) for the full report.

## Agent handoff

See [`HANDOFF.md`](HANDOFF.md) for the full agent-to-agent handoff document, or
[`master-context.md`](master-context.md) for the flattened single-file context bundle.

## Project layout

```
src/           TypeScript source (config, types, normalize, smoke-test, discover, inspect)
test/          Vitest unit tests
findings/      API findings report
output/        Runtime output (gitignored except .gitkeep)
docs/ai-context/  OKF context bundle (from PaymentEvolution/agent-kits template)
```

## All commands

```bash
npm run smoke      # resolve IDs → fetch showtimes → print result
npm run discover   # Playwright: capture live API traffic  [needs: npx playwright install chromium]
npm run inspect    # Playwright: inspect page hydration    [needs: npx playwright install chromium]
npm run explore    # discover + inspect + smoke
npm test           # vitest unit tests
```
