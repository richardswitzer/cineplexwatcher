/**
 * discover-network.ts — Playwright-based network traffic capture.
 *
 * Launches a headless Chromium browser, visits the Cineplex movie and
 * theatre pages, and records all relevant API requests and responses.
 *
 * Sensitive headers (cookies, auth tokens, session identifiers, analytics
 * identifiers, device IDs, CSRF tokens) are redacted before saving.
 *
 * Output: output/network-observations.json
 */

import { chromium, type Page, type Request, type Response } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");

// ---------------------------------------------------------------------------
// Sensitive header detection
// ---------------------------------------------------------------------------

const SENSITIVE_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "x-auth-token",
  "x-session-id",
  "x-device-id",
  "x-csrf-token",
  "x-request-id",
  "x-correlation-id",
  "x-forwarded-for",
  "x-real-ip",
  "x-analytics",
]);

const SENSITIVE_VALUE_PATTERNS = [
  /[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/i, // UUIDs
  /^bearer\s+/i,
  /^basic\s+/i,
  /\bemail\b/i,
];

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_HEADERS.has(lower)) {
      out[k] = "[REDACTED]";
    } else if (SENSITIVE_VALUE_PATTERNS.some((p) => p.test(v))) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Capture criteria
// ---------------------------------------------------------------------------

const CAPTURE_KEYWORDS = [
  "movie", "movies", "film", "films", "theatre", "theater", "location",
  "showtime", "showtimes", "session", "sessions", "performance",
  "bookable", "booking", "dates", "experience", "format", "imax",
  "vista", "site", "cinema", "api", "graphql",
];

function isRelevantUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes("apis.cineplex.com")) return true;
  if (lower.includes("cineplex.com/api")) return true;
  if (lower.includes("graphql")) return true;
  return CAPTURE_KEYWORDS.some((kw) => lower.includes(`/${kw}`) || lower.includes(`?${kw}`) || lower.includes(`&${kw}`));
}

const CAPTURE_CONTENT_TYPES = [
  "application/json",
  "application/graphql-response+json",
  "text/json",
];

function isRelevantContentType(ct: string | null): boolean {
  if (!ct) return false;
  return CAPTURE_CONTENT_TYPES.some((t) => ct.includes(t));
}

// ---------------------------------------------------------------------------
// Observation type
// ---------------------------------------------------------------------------

interface NetworkObservation {
  timestamp: string;
  pageUrl: string;
  method: string;
  url: string;
  resourceType: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  status: number | null;
  responseContentType: string | null;
  responseHeaders: Record<string, string>;
  responseBodySample: unknown;
  candidatePurpose: string;
  containsMovieTitle: boolean;
  containsTheatreName: boolean;
  containsImax: boolean;
}

// ---------------------------------------------------------------------------
// Infer purpose
// ---------------------------------------------------------------------------

function inferPurpose(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("showtimes")) return "showtimes";
  if (lower.includes("session")) return "session-details";
  if (lower.includes("theatre") || lower.includes("theater")) return "theatre-search";
  if (lower.includes("movie") || lower.includes("film")) return "movie-search";
  if (lower.includes("dates")) return "bookable-dates";
  if (lower.includes("experience") || lower.includes("format")) return "formats";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const movieTitle = config.target.movieTitle.toLowerCase();
  const theatreName = config.target.theatreName.toLowerCase();
  const observations: NetworkObservation[] = [];
  const handled = new Set<string>();

  console.log("Launching Chromium...");
  const browser = await chromium.launch({ headless: config.playwright.headless });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 cineplex-smoke-test-observer/0.1",
    locale: "en-CA",
    extraHTTPHeaders: {
      "Accept-Language": "en-CA,en;q=0.9",
    },
  });
  const page = await ctx.newPage();

  // Intercept responses
  page.on("response", async (resp: Response) => {
    const url = resp.url();
    const ct = resp.headers()["content-type"] ?? null;
    if (!isRelevantUrl(url) && !isRelevantContentType(ct)) return;
    if (handled.has(url)) return;
    handled.add(url);

    let bodyRaw: unknown = null;
    try {
      if (isRelevantContentType(ct)) {
        const text = await resp.text();
        bodyRaw = text.length < 50_000 ? JSON.parse(text) : { truncated: true, size: text.length };
      }
    } catch {
      // Non-JSON — ignore body
    }

    const bodyStr = JSON.stringify(bodyRaw ?? "").toLowerCase();
    const req = resp.request();

    const obs: NetworkObservation = {
      timestamp: new Date().toISOString(),
      pageUrl: page.url(),
      method: req.method(),
      url,
      resourceType: req.resourceType(),
      requestHeaders: redactHeaders(req.headers()),
      requestBody: null,
      status: resp.status(),
      responseContentType: ct,
      responseHeaders: redactHeaders(resp.headers()),
      responseBodySample: bodyRaw,
      candidatePurpose: inferPurpose(url),
      containsMovieTitle: bodyStr.includes(movieTitle),
      containsTheatreName: bodyStr.includes(theatreName.split(" ")[0]!.toLowerCase()),
      containsImax: bodyStr.includes("imax"),
    };

    observations.push(obs);
    console.log(`  Captured [${resp.status()}]: ${url.substring(0, 100)}`);
  });

  // --- Visit movie page ---
  const movieSlug = config.target.movieTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const movieUrl = config.target.moviePageUrl || `https://www.cineplex.com/movie/${movieSlug}`;
  console.log(`\nVisiting movie page: ${movieUrl}`);
  try {
    await page.goto(movieUrl, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(2000);
    // Accept cookie consent if present
    try {
      await page.click("button:has-text('Accept')", { timeout: 3000 });
    } catch { /* no consent dialog */ }
    // Click "Get Tickets" / "View Showtimes" to trigger showtime API calls
    try {
      await page.click("[data-testid='get-tickets']", { timeout: 5000 });
      await page.waitForTimeout(2000);
    } catch { /* button not present */ }
  } catch (err) {
    console.warn(`Movie page navigation warning: ${String(err).slice(0, 100)}`);
  }

  await page.waitForTimeout(1000);

  // --- Visit theatre page ---
  const theatreSlug = config.target.theatreName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const theatreUrl =
    config.target.theatrePageUrl || `https://www.cineplex.com/theatres/${theatreSlug}`;
  console.log(`\nVisiting theatre page: ${theatreUrl}`);
  try {
    await page.goto(theatreUrl, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(2000);
  } catch (err) {
    console.warn(`Theatre page navigation warning: ${String(err).slice(0, 100)}`);
  }

  await browser.close();

  // Save
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    join(OUTPUT_DIR, "network-observations.json"),
    JSON.stringify(observations, null, 2),
    "utf-8"
  );

  console.log(
    `\nSaved ${observations.length} observations to output/network-observations.json`
  );
}

main().catch((err: unknown) => {
  console.error("discover-network error:", err);
  process.exit(1);
});
