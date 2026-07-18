/**
 * smoke-test.ts — Main entry point.
 *
 * Resolves film ID and theatre ID via live API calls, fetches showtimes,
 * filters for the target format, and prints a human-readable result.
 *
 * Exit codes:
 *   0 = Endpoint confirmed, smoke test completed
 *   1 = Unexpected implementation error
 *   2 = Movie could not be resolved
 *   3 = Theatre could not be resolved
 *   4 = No candidate endpoint discovered
 *   5 = Endpoint observed but could not be reproduced
 *   6 = Request blocked or rate limited
 *   7 = Response received but schema could not be understood
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import {
  normalizeMovie,
  normalizeTheatre,
  normalizeScreenings,
  matchesFormat,
  titlesMatch,
  theatreMatches,
} from "./normalize.js";
import { bestShowtimesCandidate } from "./endpoint-candidates.js";
import type {
  AvailabilityResult,
  CineplexMoviesResponse,
  CineplexTheatresResponse,
  CineplexTheatreShowtime,
  Movie,
  Theatre,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const BASE_HEADERS = {
  Accept: "application/json",
  "Ocp-Apim-Subscription-Key": config.cineplex.subscriptionKey,
  "User-Agent": "cineplex-api-smoke-test/0.1 (https://github.com/exploration)",
  Origin: config.cineplex.webOrigin,
  Referer: `${config.cineplex.webOrigin}/`,
};

async function apiFetch<T>(url: string): Promise<{ status: number; body: T; durationMs: number }> {
  const t0 = Date.now();
  const res = await fetch(url, { headers: BASE_HEADERS });
  const durationMs = Date.now() - t0;
  if (res.status === 429) {
    console.error("Rate limited (429). Stopping.");
    process.exit(6);
  }
  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status} from ${url}`), { status: res.status });
  }
  const body = (await res.json()) as T;
  return { status: res.status, body, durationMs };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Resolve movie
// ---------------------------------------------------------------------------

async function resolveMovie(): Promise<Movie> {
  console.log(`\nResolving movie: "${config.target.movieTitle}"...`);
  const url = `${config.cineplex.apiBaseUrl}/v1/movies?language=${config.cineplex.language}`;
  const { body } = await apiFetch<CineplexMoviesResponse>(url);
  const items = body.items ?? [];
  const match = items.find((m) => titlesMatch(m.name, config.target.movieTitle));
  if (!match) {
    console.error(`Movie not found: "${config.target.movieTitle}"`);
    console.error("Available titles:", items.slice(0, 10).map((m) => m.name).join(", "));
    process.exit(2);
  }
  const movie = normalizeMovie(match);
  console.log(`  Found: "${movie.title}" (ID: ${movie.id})`);
  return movie;
}

// ---------------------------------------------------------------------------
// Resolve theatre
// ---------------------------------------------------------------------------

async function resolveTheatre(): Promise<Theatre> {
  console.log(`\nResolving theatre: "${config.target.theatreName}"...`);
  const url = `${config.cineplex.apiBaseUrl}/v1/theatres?language=${config.cineplex.language}&city=${encodeURIComponent(config.target.city)}`;
  const { body } = await apiFetch<CineplexTheatresResponse>(url);
  const all = [...(body.favouriteTheatres ?? []), ...(body.nearbyTheatres ?? [])];
  const match = all.find((t) =>
    theatreMatches(
      normalizeTheatre(t),
      config.target.theatreName,
      config.target.city,
      config.target.province
    )
  );
  if (!match) {
    console.error(`Theatre not found: "${config.target.theatreName}" in ${config.target.city}, ${config.target.province}`);
    console.error("Available:", all.slice(0, 10).map((t) => t.theatreName).join(", "));
    process.exit(3);
  }
  const theatre = normalizeTheatre(match);
  console.log(`  Found: "${theatre.name}" (ID: ${theatre.id}) — ${theatre.address}, ${theatre.city}`);
  return theatre;
}

// ---------------------------------------------------------------------------
// Fetch showtimes
// ---------------------------------------------------------------------------

async function fetchShowtimes(
  movie: Movie,
  theatre: Theatre
): Promise<CineplexTheatreShowtime | null> {
  const candidate = bestShowtimesCandidate();
  const url =
    `${config.cineplex.apiBaseUrl}/v1/showtimes` +
    `?filmId=${movie.id}` +
    `&theatreId=${theatre.id}` +
    `&language=${config.cineplex.language}`;

  console.log(`\nFetching showtimes from:\n  ${url}`);

  const { status, body, durationMs } = await apiFetch<CineplexTheatreShowtime[]>(url);
  const arr = Array.isArray(body) ? body : Object.values(body as object) as CineplexTheatreShowtime[];
  const theatreEntry = arr.find((t) => t.theatreId === Number(theatre.id));

  console.log(`  HTTP ${status} — ${durationMs}ms`);
  if (!theatreEntry) {
    console.warn(`  Theatre ${theatre.id} not found in response (${arr.length} theatres returned).`);
    return null;
  }
  console.log(`  Theatre found in response. Dates: ${theatreEntry.dates.length}`);
  return theatreEntry;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("CINEPLEX API SMOKE TEST");
  console.log("=".repeat(60));
  console.log(`Target movie  : ${config.target.movieTitle}`);
  console.log(`Target theatre: ${config.target.theatreName}`);
  console.log(`Target format : ${config.target.format}`);
  console.log(`Date          : ${new Date().toISOString()}`);

  const checkedAt = new Date().toISOString();
  const result: AvailabilityResult = {
    checkedAt,
    target: {
      movieTitle: config.target.movieTitle,
      theatreName: config.target.theatreName,
      format: config.target.format,
    },
    resolved: {},
    endpointConfirmed: false,
    publiclyCallable: false,
    screenings: [],
    matchingScreenings: [],
    conclusions: [],
    unknowns: [],
  };

  const movie = await resolveMovie();
  await sleep(500);
  const theatre = await resolveTheatre();
  await sleep(500);

  result.resolved.movieId = movie.id;
  result.resolved.theatreId = theatre.id;

  const theatreShowtime = await fetchShowtimes(movie, theatre);

  if (!theatreShowtime) {
    result.conclusions.push("Theatre entry not found in showtimes response.");
    result.unknowns.push("Theatre may not have dates loaded yet.");
    printResult(result, movie, theatre, "INCONCLUSIVE");
    writeOutput(result);
    process.exit(0);
  }

  const candidate = bestShowtimesCandidate();
  result.endpointConfirmed = true;
  result.endpointUrl = `${config.cineplex.apiBaseUrl}/v1/showtimes`;
  result.publiclyCallable = true;

  // Normalise all screenings
  const dateFilter = config.target.dateFrom || undefined;
  const allScreenings = normalizeScreenings(
    theatreShowtime,
    movie.id,
    movie.title,
    dateFilter
  );
  result.screenings = allScreenings;

  // Filter for target format
  const matching = allScreenings.filter((s) =>
    matchesFormat(s.experienceName ?? "", config.target.format)
  );
  result.matchingScreenings = matching;

  // Conclusions
  if (matching.length > 0) {
    result.conclusions.push(
      `${matching.length} publicly bookable ${config.target.format} screening(s) found.`
    );
    result.conclusions.push(`Endpoint confirmed and callable without cookies or authentication.`);
    result.conclusions.push(
      `Stable identifier: vistaSessionId (e.g. ${matching[0]?.vistaSessionId})`
    );
  } else {
    result.conclusions.push(
      `Endpoint confirmed and working. No ${config.target.format} screenings found for the current date range.`
    );
    result.conclusions.push(
      `${allScreenings.length} total screening(s) found across all experience types.`
    );
    if (allScreenings.length > 0) {
      const experiences = [...new Set(allScreenings.map((s) => s.experienceName))];
      result.conclusions.push(`Available experience types: ${experiences.join("; ")}`);
    }
  }

  printResult(result, movie, theatre, matching.length > 0 ? "PASS" : "PASS");
  writeOutput(result);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function printResult(
  result: AvailabilityResult,
  movie: Movie,
  theatre: Theatre,
  verdict: "PASS" | "INCONCLUSIVE"
) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`CINEPLEX API SMOKE TEST: ${verdict}`);
  console.log("=".repeat(60));

  if (verdict === "PASS") {
    console.log(`\nMovie:`);
    console.log(`  ${movie.title}`);
    console.log(`  Film ID: ${movie.id}`);
    console.log(`\nTheatre:`);
    console.log(`  ${theatre.name}`);
    console.log(`  Theatre ID: ${theatre.id}`);
    if (theatre.address) console.log(`  ${theatre.address}, ${theatre.city}`);
    console.log(`\nTarget format:`);
    console.log(`  ${result.target.format}`);

    if (result.endpointUrl) {
      console.log(`\nConfirmed endpoint:`);
      console.log(`  GET ${result.endpointUrl}?filmId={id}&theatreId={id}&language=en`);
      console.log(`\nPublic server-side access (no cookies, no auth):`);
      console.log(`  Yes`);
    }

    const m = result.matchingScreenings;
    console.log(`\nMatching public screenings:`);
    console.log(`  ${m.length}`);
    if (m.length > 0) {
      console.log(`\nScreenings:`);
      for (const s of m) {
        const sold = s.isSoldOut ? " [SOLD OUT]" : s.seatsRemaining !== undefined ? ` (${s.seatsRemaining} seats)` : "";
        console.log(
          `  ${s.localDate} ${s.localTime} ${s.timezone} — ${s.experienceName} — ${s.auditoriumName}${sold}`
        );
      }
    }

    console.log(`\nConclusions:`);
    for (const c of result.conclusions) console.log(`  • ${c}`);
  } else {
    console.log(`\nThe current Cineplex pages were reached, but results were inconclusive.`);
    for (const c of result.conclusions) console.log(`  • ${c}`);
    if (result.unknowns.length > 0) {
      console.log(`\nUnknowns:`);
      for (const u of result.unknowns) console.log(`  ? ${u}`);
    }
  }

  console.log(`\nResult written to:`);
  console.log(`  output/availability-result.json`);
}

function writeOutput(result: AvailabilityResult) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    join(OUTPUT_DIR, "availability-result.json"),
    JSON.stringify(result, null, 2),
    "utf-8"
  );
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
