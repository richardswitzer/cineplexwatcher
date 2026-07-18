# Cineplex API Exploration Findings

## Executive Conclusion

A current, publicly callable, unauthenticated JSON API exists at
`https://apis.cineplex.com/prod/cpx/theatrical/api`. It requires one
non-secret header (`Ocp-Apim-Subscription-Key`) whose value is embedded
unobfuscated in Cineplex's own production JavaScript bundle. The API
returns full showtime data including IMAX session times, seat availability,
Vista session IDs, and booking URLs. Server-side scripting without cookies
or a browser session is fully supported.

**Status: CONFIRMED — endpoint verified and called successfully on 2026-07-18.**

---

## Test Date and Environment

- Date: 2026-07-18
- Environment: Node.js 22, Windows
- Evidence source: Live production JavaScript bundle + direct API calls
- JS Bundle: `https://www.cineplex.com/next-static-files/_next/static/chunks/pages/movie/%5Bslug%5D-1651724c7e47560a.js`
- Build ID: `6bzv0_Kg_dsOq69kLjNJ4`
- Config object found in bundle module: `54753`

---

## Target

- Movie: The Odyssey (Christopher Nolan, 2026)
- Theatre: Scotiabank Theatre Toronto
- Format: IMAX

---

## Confirmed Current Endpoints

All of the following were called successfully on 2026-07-18 without cookies,
without authentication, and from a plain server-side Node.js script.

### 1. Showtimes — `Confirmed`

```
GET https://apis.cineplex.com/prod/cpx/theatrical/api/v1/showtimes
  ?filmId={filmId}
  &theatreId={theatreId}
  &language=en
```

Required headers:
```
Ocp-Apim-Subscription-Key: dcdac5601d864addbc2675a2e96cb1f8
Accept: application/json
```

Returns: Array of `CineplexTheatreShowtime` objects, one per theatre.
Each entry contains `dates[]` → `movies[]` → `experiences[]` → `sessions[]`.

### 2. Movies list — `Confirmed`

```
GET https://apis.cineplex.com/prod/cpx/theatrical/api/v1/movies
  ?language=en
```

Returns: `{ items: CineplexMovieListItem[] }` — currently showing and
coming-soon films with IDs, slugs, and poster URLs.

### 3. Theatres by city — `Confirmed`

```
GET https://apis.cineplex.com/prod/cpx/theatrical/api/v1/theatres
  ?language=en
  &city={city}
```

Returns: `{ favouriteTheatres: [], nearbyTheatres: CineplexTheatreListItem[] }`

---

## Endpoint Required to Resolve a Movie

`GET /v1/movies?language=en` — search `items[].name` for the target title.

The Odyssey resolved to:
- `id`: 37617
- `name`: "The Odyssey"
- `filmUrl`: "the-odyssey"
- `releaseDate`: "2026-07-17T00:00:00"

Film ID is also embedded in the `__NEXT_DATA__` hydration payload on the
movie page at `props.pageProps.movieDetails.id`.

---

## Endpoint Required to Resolve a Theatre

`GET /v1/theatres?language=en&city=toronto` — filter `nearbyTheatres` for
name match + city + province.

Scotiabank Theatre Toronto resolved to:
- `theatreId`: 7402
- `theatreName`: "Scotiabank Theatre Toronto"
- `address`: "259 Richmond Street West"
- `city`: "Toronto"
- `provinceCode`: "ON"
- `postalCode`: "M5V 3M6"
- `geoLocation`: 43.649039, -79.390559

---

## Endpoint Required to Retrieve Bookable Dates

The showtimes endpoint returns all available dates (up to ~6 days ahead)
for a given film and theatre in a single call. No separate
"available dates" endpoint was needed.

Response structure:
```json
[
  {
    "theatre": "Scotiabank Theatre Toronto",
    "theatreId": 7402,
    "dates": [
      {
        "startDate": "2026-07-18T00:00:00",
        "movies": [...]
      }
    ]
  }
]
```

---

## Endpoint Required to Retrieve Showtimes

`GET /v1/showtimes?filmId=37617&theatreId=7402&language=en`

Confirmed response contains sessions for Scotiabank Theatre Toronto including
both IMAX and non-IMAX experiences.

---

## Authentication and Header Requirements

| Header | Required | Value |
|--------|----------|-------|
| `Ocp-Apim-Subscription-Key` | Yes | `dcdac5601d864addbc2675a2e96cb1f8` |
| `Accept` | Recommended | `application/json` |
| `Origin` | Optional | `https://www.cineplex.com` |
| `Referer` | Optional | `https://www.cineplex.com/` |
| `Cookie` | **No** | Not required |
| `Authorization` | **No** | Not required |

The subscription key is **not a secret** — it is embedded in plaintext in the
public production JavaScript bundle and is the same value for all users.
It does not expire per-user and requires no account.

---

## Identifier Relationships

- **Film ID**: Integer. `37617` for The Odyssey. Found in `/v1/movies` response and `__NEXT_DATA__`.
- **Theatre ID**: Integer. `7402` for Scotiabank Theatre Toronto. Found in `/v1/theatres` response.
- **Location ID**: Same as Theatre ID (`LocationId=7402` appears in booking URLs).
- **Site ID**: Not observed separately — `theatreId` is the only venue identifier in the public API.
- **Session ID (Vista)**: `vistaSessionId` integer per session (e.g. `449248`). This is the stable screening identifier.
- **Area Code**: String in booking URL params (e.g. `0000000001` for IMAX, `0000000004` for AVX+D-BOX).

---

## IMAX Identification

IMAX screenings are identified by `experienceTypes` array within each experience group:

```json
{
  "experienceTypes": ["IMAX", "Laser Projection"],
  "sessions": [...]
}
```

The `auditorium` field in each session also reads `"IMAX"` for IMAX screens.

Observed IMAX area code: `0000000001` (appears in booking URLs).

Other experience types observed at Scotiabank on 2026-07-18:
- `["UltraAVX", "D-BOX", "Laser Projection"]` — area code `0000000004`
- `["Standard", "Recliner"]` — standard auditoriums

**IMAX-specific format filter**: match `experienceTypes` containing a value
that starts with or includes "IMAX" (case-insensitive), OR where `auditorium`
contains "IMAX".

---

## Booking-State Identification

A screening is publicly bookable when all of the following are true in the session object:
- `isShowtimeEnabledOnline: true`
- `isSoldOut: false`
- `isInThePast: false`

Additional useful fields:
- `seatsRemaining`: integer remaining seats (observed live values: 27, 17 on 2026-07-18)
- `ticketingRedesignUrl`: the working booking URL
- `showtimeShareKey`: stable share key (format: `v:{vistaSessionId}_t:{theatreId}_a:{areaCode}`)

---

## Example Sanitized Request

```http
GET /prod/cpx/theatrical/api/v1/showtimes?filmId=37617&theatreId=7402&language=en HTTP/1.1
Host: apis.cineplex.com
Accept: application/json
Ocp-Apim-Subscription-Key: dcdac5601d864addbc2675a2e96cb1f8
User-Agent: cineplex-api-smoke-test/0.1
Origin: https://www.cineplex.com
Referer: https://www.cineplex.com/
```

---

## Example Sanitized Response (single IMAX experience, abbreviated)

```json
[
  {
    "theatre": "Scotiabank Theatre Toronto",
    "theatreId": 7402,
    "dates": [
      {
        "startDate": "2026-07-18T00:00:00",
        "movies": [
          {
            "id": 37617,
            "name": "The Odyssey",
            "experiences": [
              {
                "experienceTypes": ["IMAX", "Laser Projection"],
                "sessions": [
                  {
                    "vistaSessionId": 449248,
                    "areaCode": "0000000001",
                    "showStartDateTime": "2026-07-18T15:00:00",
                    "showStartDateTimeUtc": "2026-07-18T19:00:00Z",
                    "isInThePast": false,
                    "isReservedSeating": true,
                    "isShowtimeEnabledOnline": true,
                    "seatsRemaining": 27,
                    "isSoldOut": false,
                    "auditorium": "IMAX",
                    "ticketingRedesignUrl": "https://apis.cineplex.com/prod/ticketing/api/v1/routing/redirect-to-ticketing?VistaSessionId=449248&VISTAHOCategoryCode=0000000001&LocationId=7402&IsSeriesShowtime=False",
                    "showtimeShareKey": "v:449248_t:7402_a:0000000001"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
]
```

---

## Historical Endpoints Tested

| Endpoint | Status |
|----------|--------|
| `GET https://www.cineplex.com/api/v1/theatres` | `HISTORICAL_UNVERIFIED` — not tested; superseded by confirmed apis.cineplex.com |
| `GET https://www.cineplex.com/api/v1/movies` | `HISTORICAL_UNVERIFIED` — not tested; superseded by confirmed apis.cineplex.com |

Reason for skipping: a confirmed, working current endpoint was identified
from the JS bundle before historical endpoints were needed. Per spec §12,
"do not spend substantial time repairing legacy endpoints if a current
endpoint has already been observed."

---

## Rate-Limit or Blocking Observations

- No 429 responses encountered.
- No CAPTCHA or bot-detection triggered during testing (3–4 requests, 500ms spacing).
- The subscription key did not rotate or expire during testing.
- Requests from a plain Node.js `fetch()` (no browser fingerprint) were accepted.

---

## Remaining Unknowns

1. Whether there is a dedicated "available dates" endpoint (not needed — dates are in the showtimes response).
2. The exact meaning and full range of `areaCode` values per experience type.
3. Whether `theatreId` and `locationId` are always identical (observed: yes, but not exhaustively confirmed).
4. Whether the subscription key has usage quotas or is rotated periodically.
5. Whether the showtimes response covers a fixed 6-day window or is configurable.
6. GraphQL endpoint: `https://apis.cineplex.com/prod/marketing/v1/search` — not explored (movie search via REST was sufficient).

---

## Production-Watcher Recommendation

A production IMAX availability watcher for The Odyssey at Scotiabank Theatre Toronto should:

1. Call `GET /v1/showtimes?filmId=37617&theatreId=7402&language=en` on a schedule (suggested: every 5–15 minutes).
2. Filter for `experienceTypes` containing "IMAX".
3. Use `vistaSessionId` as the stable per-screening identifier.
4. Use `isShowtimeEnabledOnline && !isSoldOut && !isInThePast` as the availability predicate.
5. Emit an alert when a session appears with a new `vistaSessionId` not seen in the previous check.
6. Store `showtimeShareKey` as a human-readable cross-reference.
7. Respect rate limits: a 1-second minimum delay between polls is recommended.
8. Do **not** use `seatsRemaining` as the trigger — changes in seat count are not relevant to "new session appeared".

The subscription key does not need to be rotated — it is public and static.
No authentication infrastructure is needed.
