---
type: concept
title: "API and Data Flow"
description: "Confirmed Cineplex public API endpoints, authentication requirements, response schemas, and identifier relationships."
resource: "docs/ai-context/05-api-and-data-flow.md"
tags: [ai-context, api, data-flow, cineplex]
timestamp: 2026-07-18
status: reviewed
generated_from_repo: true
last_verified_commit: null
review_required: false
---

# API and Data Flow

All endpoints below are confirmed `OBSERVED_CURRENT` or
`DISCOVERED_IN_CURRENT_CODE`. See `src/endpoint-candidates.ts` for the
full candidate list with classification and evidence.

## Outbound: calling Cineplex APIs

Configuration lives in `src/config.ts`. Values are not read from `.env`
because the API credentials are public (embedded in the production JS bundle)
and non-user-specific.

```
// Pattern only — illustrative
client = fetch(
  baseUrl: "https://apis.cineplex.com/prod/cpx/theatrical/api",
  headers: { "Ocp-Apim-Subscription-Key": API_KEY }  // API_KEY is public
)
```

## Confirmed endpoints

### Movies list

```
GET /v1/movies?language=en
Host: apis.cineplex.com
Ocp-Apim-Subscription-Key: [see config.ts]
```

Response shape: `{ items: [{ id, name, filmUrl, releaseDate, ... }] }`

Use to resolve a movie title to an integer `filmId`.

### Theatres by city

```
GET /v1/theatres?language=en&city={city}
Host: apis.cineplex.com
```

Response shape: `{ favouriteTheatres: [], nearbyTheatres: [{ theatreId, theatreName, location: { city, provinceCode, address }, ... }] }`

Use to resolve a theatre name + city to an integer `theatreId`.

### Showtimes

```
GET /v1/showtimes?filmId={id}&theatreId={id}&language=en
Host: apis.cineplex.com
```

Response shape:
```
Array<{
  theatre: string,
  theatreId: number,
  dates: Array<{
    startDate: string,          // "YYYY-MM-DDTHH:mm:ss" local Toronto time
    movies: Array<{
      id: number,
      name: string,
      experiences: Array<{
        experienceTypes: string[],   // e.g. ["IMAX", "Laser Projection"]
        sessions: Array<{
          vistaSessionId: number,    // stable screening identifier
          showStartDateTime: string, // local Toronto time, no offset
          isShowtimeEnabledOnline: boolean,
          isSoldOut: boolean,
          isInThePast: boolean,
          seatsRemaining: number,
          auditorium: string,
          ticketingRedesignUrl: string,
          showtimeShareKey: string,  // "v:{vSId}_t:{theatreId}_a:{areaCode}"
        }>
      }>
    }>
  }>
}>
```

## Request pattern

All requests use:
- `Accept: application/json`
- `Ocp-Apim-Subscription-Key: [see config.ts — public value]`
- `User-Agent: cineplex-api-smoke-test/0.1`
- `Origin: https://www.cineplex.com`
- No cookies
- No Authorization header

## Error handling

- `429` → rate limited, hard stop (`process.exit(6)`)
- `4xx` other → throw, propagate to caller
- Response body parse failure → schema error (`process.exit(7)`)
- Theatre/movie not found in response → specific exit codes (2, 3)

## Identifier relationships

| Identifier | Type | Source | Notes |
|------------|------|--------|-------|
| `filmId` | integer | `/v1/movies` response | Also in `__NEXT_DATA__.props.pageProps.movieDetails.id` |
| `theatreId` | integer | `/v1/theatres` response | Same value appears as `LocationId` in booking URLs |
| `vistaSessionId` | integer | `/v1/showtimes` → session | Stable per-screening ID; use for change detection |
| `areaCode` | string | session object | Correlates with experience type (e.g. `0000000001` = IMAX) |

## IMAX identification

Filter `experiences` where any `experienceTypes` entry contains "IMAX"
(case-insensitive). The `auditorium` field will also read "IMAX" for
IMAX screens.

## Booking-state identification

A session is publicly bookable iff:
- `isShowtimeEnabledOnline === true`
- `isSoldOut === false`
- `isInThePast === false`

## Time zones

`showStartDateTime` is local Toronto time with no offset indicator. Always
interpret in `America/Toronto`. UTC equivalent is in `showStartDateTimeUtc`.

## Evidence reviewed

- Bundle module 54753 in production Next.js build (2026-07-18)
- Direct HTTP calls from Node.js 22, no browser session
- Observed live responses for film 37617, theatre 7402

## Confidence

High.

## Unknowns

- Subscription key rotation frequency
- Whether the 6-day lookahead window on showtimes is fixed or configurable
- Full semantics of all `areaCode` values
