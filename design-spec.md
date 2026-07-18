# Cineplex Showtime Watcher — Design Spec

**v1.0 · 2026-07-18**

---

## Product Overview

**What it is.** A single-purpose monitoring dashboard that polls the Cineplex public API and surfaces available IMAX screenings for a configured movie and theatre. The primary job is change detection: the user wants to know the moment a new session appears or seats become scarce.

**Audience.** A single user (or a small group) who has already decided they want to see a specific film in a specific format and is watching for availability. They check this infrequently but rely on it being accurate when they do.

**Single job.** Answer the question — *Is there a session I can book right now?* — with no friction.

---

## Visual Identity

### Direction

The cinema auditorium at show time: lights down, a single warm projector source, seats in near-darkness. The interface should feel like something built to be read in that room — high contrast, warm amber as the single active colour, nothing that competes with the information itself. The typography draws from film-title lettering: compressed, uppercase, confident — not decorative, just economical with space. Data elements use monospace for alignment and legibility, not to signal "developer tool."

This is a dark-first product. The dark theme is primary. The light theme is a warm paper variant, not a simple inversion.

### Palette — Dark (primary)

| Role | Name | Hex |
|---|---|---|
| Ground | `--color-ground` | `#10121A` |
| Surface | `--color-surface` | `#1C1F2E` |
| Accent | `--color-amber` | `#D4A020` |
| Text primary | `--color-text` | `#F0EDE6` |
| Text secondary | `--color-text-2` | `#9E9A93` |
| Text tertiary | `--color-text-3` | `#4A4F65` |
| Rule / border | `--color-rule` | `#2A2D3A` |
| Available | `--color-available` | `#4CAF7D` |
| Low seats | `--color-low` | `#E8854A` |
| Sold out | `--color-soldout` | `#C05050` |

### Palette — Light

| Role | Name | Hex |
|---|---|---|
| Ground | `--color-ground` | `#F5F2EC` |
| Surface | `--color-surface` | `#EAE7E0` |
| Accent | `--color-amber` | `#9A6E0A` |
| Text primary | `--color-text` | `#1A1814` |
| Text secondary | `--color-text-2` | `#6B6760` |
| Rule / border | `--color-rule` | `#D8D4CB` |

Semantic colours (available / low / sold-out) are identical in both themes — they carry meaning and must not shift.

---

## Typography

### Roles

| Role | Face | Usage |
|---|---|---|
| Display | Barlow Condensed Bold, 700, uppercase, +0.04em tracking | Movie title, theatre name header |
| UI / Body | System UI stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | Labels, descriptions, secondary text |
| Data / Mono | JetBrains Mono, fallback `'Courier New'` | Dates, times, IDs, seat counts |

Always set `font-variant-numeric: tabular-nums` on columns of numbers.

### Scale

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--text-display` | clamp(2rem, 5vw, 3rem) | 700 | Movie title |
| `--text-heading` | 1rem | 600 | Section labels |
| `--text-body` | 0.9rem | 400 | Descriptions, secondary text |
| `--text-label` | 0.68rem | 400 | Uppercase labels, +0.12em tracking |
| `--text-data` | 0.8rem | 400 | Monospace data cells |

---

## Layout & Structure

### Page model

Single page, single column, max-width 860px centred. No sidebar. No navigation. On mobile the column runs full-width with 1rem horizontal padding.

### Three vertical zones

1. **Header strip** — Movie title (Display type), theatre + format (UI type), live status indicator, last-checked timestamp.
2. **Summary bar** — Count of matching screenings. Zero-state: prominent "No sessions found" message. New-session call-out: "N new session(s) detected" with amber background, dismissible.
3. **Screenings table** — One row per session. Columns: Date, Time, Format, Seats. Sorted by date ascending by default. Rows with ≤20 seats get the low-seats colour; sold-out rows are muted and struck through.

### Responsive breakpoints

| Breakpoint | Behaviour |
|---|---|
| ≥ 860px | Full four-column table. Header and summary on one line each. |
| 520–859px | Table columns compress. Seats column narrows to 60px. |
| < 520px | Table collapses to two-line card layout per screening: Date + Time on line one, Format + Seats on line two. Full-bleed cards with 1rem horizontal margin. |

---

## Components

### WatcherHeader

Movie title in Display type. Theatre name and format in UI type below. Live status pill with animated dot (`Available — 21 sessions` or `No sessions found`). Last-checked timestamp in monospace. Refresh button aligned right.

### SummaryBar

Total matching count in large type. Zero-state replaces the count with a full-width amber-bordered message: "No IMAX sessions found at this time." New-session detection: full-width amber call-out "N new session(s) detected since last check" — dismissible with an ✕.

### ScreeningsTable

Sortable by Date (default ascending). Four columns: Date, Time, Format/Experience, Seats. No pagination needed — the API returns at most a few weeks of sessions.

### ScreeningRow

Four columns as above. State encoded via colour on the Seats cell and optional pills on Time and Seats cells. Clicking a bookable row opens the Cineplex booking URL in a new tab. Non-bookable rows (`isBookable === false`) are hidden entirely.

### RefreshControl

Button in the header ("Refresh" or refresh icon). Disabled while a request is in flight. Shows last-checked timestamp beside it. Enforces a 60-second minimum cooldown between requests — if triggered too soon, shows remaining seconds in the button label.

### ErrorBanner

If the API returns a non-200: full-width banner, red-muted background, "Could not reach Cineplex API — last data from [timestamp]." Does not clear the previous successful data from the table.

---

## States & Semantic Colour

| State | Trigger | Colour | Treatment |
|---|---|---|---|
| Available | seats > 20, isBookable | `#4CAF7D` | Normal row weight |
| Low seats | 1 ≤ seats ≤ 20 | `#E8854A` | Seat count coloured, "low" pill added |
| Sold out | isSoldOut === true | `#C05050` | Row opacity 0.45, time struck through |
| New session | vistaSessionId not in previous response | `#D4A020` | Amber "new" pill on Time cell |
| Refreshing | Request in flight | — | Spinner in header status only. Table rows do not animate individually. |

---

## Data Contract

All display data comes from the confirmed endpoint:

```
GET https://apis.cineplex.com/prod/cpx/theatrical/api/v1/showtimes
  ?filmId={id}&theatreId={id}&language=en
```

Fields the UI reads per screening row:

```
vistaSessionId    // stable identifier, used for new-session detection
localDate         // "2026-07-19"
localTime         // "07:00 PM"
timezone          // "America/Toronto"
experienceName    // "IMAX, Laser Projection"
seatsRemaining    // integer
isSoldOut         // boolean
isBookable        // boolean — hide row if false
bookingUrl        // ticketingRedesignUrl — row click target
```

**Low-seats threshold:** ≤ 20 seats remaining. Implement as a named constant, not hardcoded in component logic.

---

## Refresh & Polling

| Concern | Spec |
|---|---|
| Manual refresh | Button in header |
| Auto-poll interval | 5 minutes default, configurable |
| Tab visibility | Do not poll when `document.visibilityState === 'hidden'` |
| Rate limit | 60-second minimum between calls regardless of user action |
| New session detection | Compare `vistaSessionId` sets between previous and current response. Any ID present in current but not previous is "new." Store in memory only — resets on page reload by design. |
| Notifications | Phase 2. Stub a disabled "Notify me" button in the header with tooltip "Coming soon." |

---

## Motion

Two moments only:

1. **Live-status dot** — slow opacity pulse, 2s ease-in-out, infinite. Signals the watcher is active.
2. **New-session row flash** — 600ms background fade from `rgba(212, 160, 32, 0.15)` to transparent on first render of a new row. Draws the eye to what changed without the table jumping.

Both respect `prefers-reduced-motion: reduce` — disable the flash, flatten the pulse to a static dot.

---

## Out of Scope (Phase 1)

Do not design or build:

- User accounts
- SMS or email notifications
- Multiple simultaneous watches (different movies or theatres)
- Seat-map views
- Purchase flows
- A public API

The MVP is a single-movie, single-theatre, single-user watcher. The "Notify me" entry point may be stubbed as a disabled button — no backend work in Phase 1.
