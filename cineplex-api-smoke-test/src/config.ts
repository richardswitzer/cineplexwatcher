/**
 * Configuration — reads from environment variables with sensible defaults.
 *
 * API credentials are sourced from the Cineplex website's own JavaScript
 * bundle (confirmed 2026-07-18). They are public, embedded in the
 * browser-facing code, and not user-specific.
 *
 * The subscription key is NOT a secret in the traditional sense — it is
 * embedded unobfuscated in the public production JS bundle at:
 *   /next-static-files/_next/static/chunks/pages/movie/[slug]-*.js
 * under the `showtimesApi.ocpApimSubscriptionKey` config key.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env if present (simple parser — no dotenv dependency)
const envPath = join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

function env(key: string, fallback = ""): string {
  return (process.env[key] ?? fallback).trim();
}

export const config = {
  target: {
    movieTitle: env("TARGET_MOVIE_TITLE", "The Odyssey"),
    theatreName: env("TARGET_THEATRE_NAME", "Scotiabank Theatre Toronto"),
    format: env("TARGET_FORMAT", "IMAX"),
    city: env("TARGET_CITY", "Toronto"),
    province: env("TARGET_PROVINCE", "ON"),
    country: env("TARGET_COUNTRY", "CA"),
    dateFrom: env("TARGET_DATE_FROM"),
    dateTo: env("TARGET_DATE_TO"),
    moviePageUrl: env("CINEPLEX_MOVIE_URL"),
    theatrePageUrl: env("CINEPLEX_THEATRE_URL"),
  },

  playwright: {
    headless: env("HEADLESS", "true") !== "false",
  },

  /**
   * Cineplex theatrical API.
   *
   * Base URL and subscription key extracted from the live production JS bundle
   * at https://www.cineplex.com/movie/the-odyssey (build ID: 6bzv0_Kg_dsOq69kLjNJ4).
   * Source: module 54753, config object `showtimesApi` / `theatreApi` / `movieApi`.
   *
   * The key is public and non-user-specific. It is not a secret credential —
   * do NOT treat it as one (no rotation needed, no vault required).
   */
  cineplex: {
    apiBaseUrl: "https://apis.cineplex.com/prod/cpx/theatrical/api",
    subscriptionKey: "dcdac5601d864addbc2675a2e96cb1f8",
    language: "en",
    webOrigin: "https://www.cineplex.com",
  },
} as const;

export type Config = typeof config;
