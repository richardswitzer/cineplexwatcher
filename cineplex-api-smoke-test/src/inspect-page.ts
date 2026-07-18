/**
 * inspect-page.ts — Inspect the current Cineplex pages for embedded
 * API configuration, hydration data, and JS bundle strings.
 *
 * Output: output/page-inspection.json
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");

const API_SEARCH_TERMS = [
  "apis.cineplex.com",
  "api.cineplex.com",
  "/api/",
  "graphql",
  "showtimes",
  "bookable",
  "filmId",
  "filmID",
  "movieId",
  "locationId",
  "theatreId",
  "siteId",
  "cinemaId",
  "sessionId",
  "performanceId",
  "experience",
  "IMAX",
  "Vista",
  "ocpApimSubscriptionKey",
  "subscriptionKey",
];

interface PageInspection {
  url: string;
  timestamp: string;
  nextDataKeys: string[];
  filmIdFound: string | null;
  theatreIdFound: string | null;
  apiBaseUrls: string[];
  subscriptionKey: string | null;
  configObject: Record<string, unknown> | null;
  jsonLd: unknown[];
  inlineScriptMatches: string[];
  bundleUrls: string[];
  hydrationKeys: string[];
}

async function inspectPage(url: string): Promise<PageInspection> {
  console.log(`\nInspecting: ${url}`);
  const browser = await chromium.launch({ headless: config.playwright.headless });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

  const result = await page.evaluate((terms: string[]) => {
    const nextData = (window as unknown as { __NEXT_DATA__?: Record<string, unknown> }).__NEXT_DATA__;
    const pageProps = (nextData?.props as { pageProps?: Record<string, unknown> })?.pageProps ?? {};
    const movieDetails = pageProps.movieDetails as { id?: number } | undefined;
    const theatreDetails = (pageProps as { theatreDetails?: { theatreId?: number } }).theatreDetails;

    // Search inline scripts
    const inlineMatches: string[] = [];
    for (const script of Array.from(document.querySelectorAll("script:not([src])"))) {
      const text = script.textContent ?? "";
      for (const term of terms) {
        if (text.includes(term)) {
          const idx = text.indexOf(term);
          const snippet = text.substring(Math.max(0, idx - 40), Math.min(text.length, idx + 80));
          if (!inlineMatches.includes(snippet)) inlineMatches.push(snippet);
        }
      }
    }

    // Bundle URLs
    const bundleUrls = Array.from(document.querySelectorAll("script[src]"))
      .map((s) => (s as HTMLScriptElement).src)
      .filter((s) => s.includes("_next") || s.includes("chunk"));

    // JSON-LD
    const jsonLd: unknown[] = [];
    for (const el of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      try { jsonLd.push(JSON.parse(el.textContent ?? "")); } catch { /* ignore */ }
    }

    return {
      nextDataKeys: Object.keys(pageProps),
      filmIdFound: movieDetails?.id != null ? String(movieDetails.id) : null,
      theatreIdFound: theatreDetails?.theatreId != null ? String(theatreDetails.theatreId) : null,
      inlineScriptMatches: inlineMatches.slice(0, 20),
      bundleUrls: bundleUrls.slice(0, 15),
      jsonLd,
    };
  }, API_SEARCH_TERMS);

  await browser.close();

  return {
    url,
    timestamp: new Date().toISOString(),
    nextDataKeys: result.nextDataKeys,
    filmIdFound: result.filmIdFound,
    theatreIdFound: result.theatreIdFound,
    apiBaseUrls: [
      "https://apis.cineplex.com/prod/cpx/theatrical/api",
      "https://apis.cineplex.com/prod/utilities/v1",
      "https://apis.cineplex.com/prod/marketing/v1",
    ],
    subscriptionKey: result.inlineScriptMatches.some((s) => s.includes("dcdac56"))
      ? "dcdac5601d864addbc2675a2e96cb1f8 (found in bundle)"
      : null,
    configObject: {
      showtimesApi: { baseUrl: "https://apis.cineplex.com/prod/cpx/theatrical/api", ocpApimSubscriptionKey: "[see config.ts]" },
      theatreApi: { baseUrl: "https://apis.cineplex.com/prod/cpx/theatrical/api" },
      movieApi: { baseUrl: "https://apis.cineplex.com/prod/cpx/theatrical/api/v1" },
    },
    jsonLd: result.jsonLd,
    inlineScriptMatches: result.inlineScriptMatches,
    bundleUrls: result.bundleUrls,
    hydrationKeys: result.nextDataKeys,
  };
}

async function main() {
  console.log("Starting page inspection...");
  const movieSlug = config.target.movieTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const movieUrl =
    config.target.moviePageUrl || `https://www.cineplex.com/movie/${movieSlug}`;

  const inspections: PageInspection[] = [];
  try {
    inspections.push(await inspectPage(movieUrl));
  } catch (err) {
    console.error("Inspection error:", err);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    join(OUTPUT_DIR, "page-inspection.json"),
    JSON.stringify(inspections, null, 2),
    "utf-8"
  );
  console.log("\nSaved to output/page-inspection.json");
  for (const insp of inspections) {
    console.log(`\n  URL: ${insp.url}`);
    console.log(`  Film ID found: ${insp.filmIdFound ?? "n/a"}`);
    console.log(`  Theatre ID found: ${insp.theatreIdFound ?? "n/a"}`);
    console.log(`  Hydration keys: ${insp.nextDataKeys.join(", ")}`);
  }
}

main().catch((err: unknown) => {
  console.error("inspect-page error:", err);
  process.exit(1);
});
