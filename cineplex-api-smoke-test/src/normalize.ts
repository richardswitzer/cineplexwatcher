/**
 * normalize.ts — Convert raw Cineplex API responses to domain types.
 * Schema confirmed from live API on 2026-07-18.
 */

import { createHash } from "node:crypto";
import type {
  CineplexTheatreShowtime,
  CineplexMovieListItem,
  CineplexTheatreListItem,
  Movie,
  Theatre,
  Screening,
} from "./types.js";

const TIMEZONE = "America/Toronto";

// ---------------------------------------------------------------------------
// Movie
// ---------------------------------------------------------------------------

export function normalizeMovie(raw: CineplexMovieListItem): Movie {
  return {
    id: String(raw.id),
    title: raw.name,
    releaseDate: raw.releaseDate,
    pageUrl: raw.filmUrl
      ? `https://www.cineplex.com/movie/${raw.filmUrl}`
      : undefined,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Theatre
// ---------------------------------------------------------------------------

export function normalizeTheatre(raw: CineplexTheatreListItem): Theatre {
  return {
    id: String(raw.theatreId),
    name: raw.theatreName,
    address: raw.location?.address,
    city: raw.location?.city,
    province: raw.location?.provinceCode,
    latitude: raw.location?.geoLocation?.latitude,
    longitude: raw.location?.geoLocation?.longitude,
    pageUrl: raw.theatreUrl
      ? `https://www.cineplex.com/theatres/${raw.theatreUrl}`
      : undefined,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Screenings
// ---------------------------------------------------------------------------

/** Parse "2026-07-18T15:00:00" → { localDate, localTime } */
function parseLocalDateTime(dt: string): { localDate: string; localTime: string } {
  const d = new Date(dt);
  // dt is already local Toronto time (no Z, no offset — treat as-is)
  const [localDate, timeRaw] = dt.split("T");
  const [hh, mm] = timeRaw.split(":");
  const hour = parseInt(hh, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = ((hour % 12) || 12).toString().padStart(2, "0");
  const localTime = `${hour12}:${mm} ${ampm}`;
  return { localDate: localDate ?? dt, localTime };
}

function makeScreeningId(
  movieId: string,
  theatreId: string,
  startsAt: string,
  experienceName: string,
  auditorium: string,
  vistaSessionId?: number
): string {
  if (vistaSessionId) return `vista:${vistaSessionId}`;
  const composite = [movieId, theatreId, startsAt, experienceName, auditorium]
    .join("|")
    .toLowerCase();
  return "sha256:" + createHash("sha256").update(composite).digest("hex").slice(0, 16);
}

const ENDPOINT = "https://apis.cineplex.com/prod/cpx/theatrical/api/v1/showtimes";

export function normalizeScreenings(
  raw: CineplexTheatreShowtime,
  movieId: string,
  movieTitle: string,
  dateFilter?: string
): Screening[] {
  const screenings: Screening[] = [];

  for (const dateEntry of raw.dates) {
    if (dateFilter && !dateEntry.startDate.startsWith(dateFilter)) continue;
    for (const movie of dateEntry.movies ?? []) {
      if (String(movie.id) !== movieId) continue;
      for (const exp of movie.experiences ?? []) {
        const experienceName = (exp.experienceTypes ?? []).join(", ");
        for (const session of exp.sessions ?? []) {
          const { localDate, localTime } = parseLocalDateTime(session.showStartDateTime);
          const screeningId = makeScreeningId(
            movieId,
            String(raw.theatreId),
            session.showStartDateTime,
            experienceName,
            session.auditorium,
            session.vistaSessionId
          );
          screenings.push({
            screeningId,
            movieId,
            movieTitle,
            theatreId: String(raw.theatreId),
            theatreName: raw.theatre,
            startsAt: session.showStartDateTime,
            localDate,
            localTime,
            timezone: TIMEZONE,
            experienceName,
            auditoriumName: session.auditorium,
            bookingUrl: session.ticketingRedesignUrl,
            isBookable: session.isShowtimeEnabledOnline && !session.isSoldOut,
            availabilityStatus: session.isSoldOut ? "SOLD_OUT" : session.isShowtimeEnabledOnline ? "AVAILABLE" : "UNAVAILABLE",
            seatsRemaining: session.seatsRemaining,
            isSoldOut: session.isSoldOut,
            vistaSessionId: session.vistaSessionId,
            sourceEndpoint: ENDPOINT,
            raw: session,
          });
        }
      }
    }
  }

  return screenings;
}

// ---------------------------------------------------------------------------
// Format matching
// ---------------------------------------------------------------------------

const IMAX_VARIANTS = [
  "imax", "imax 2d", "imax 3d", "imax 70mm", "imax 70mm film",
  "imax with laser", "imax laser", "imax, laser projection",
];

/** Returns true when experienceName matches the target format. */
export function matchesFormat(experienceName: string, targetFormat: string): boolean {
  if (!experienceName || !targetFormat) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const expNorm = norm(experienceName);
  const fmtNorm = norm(targetFormat);
  if (expNorm.includes(fmtNorm)) return true;
  if (fmtNorm === "imax") {
    return IMAX_VARIANTS.some(v => expNorm.includes(v)) || expNorm.startsWith("imax");
  }
  return false;
}

// ---------------------------------------------------------------------------
// Title matching
// ---------------------------------------------------------------------------

function normalizeTitle(t: string): string {
  return t.toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B'']/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titlesMatch(a: string, b: string): boolean {
  return normalizeTitle(a) === normalizeTitle(b);
}

// ---------------------------------------------------------------------------
// Theatre matching
// ---------------------------------------------------------------------------

export function theatreMatches(
  theatre: Theatre,
  name: string,
  city: string,
  province: string
): boolean {
  const nameLower = theatre.name.toLowerCase();
  const targetLower = name.toLowerCase();
  return (
    nameLower.includes(targetLower) || targetLower.includes(nameLower.split(" ").slice(0, 3).join(" "))
  ) && (theatre.city?.toLowerCase() === city.toLowerCase()) &&
    (theatre.province?.toLowerCase() === province.toLowerCase());
}
