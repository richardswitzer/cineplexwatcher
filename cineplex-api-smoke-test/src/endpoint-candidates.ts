/**
 * endpoint-candidates.ts
 *
 * Ranked list of Cineplex API endpoint candidates, classified by evidence.
 * All confirmed from live website traffic and JS bundle inspection on 2026-07-18.
 */

import type { EndpointCandidate } from "./types.js";

export const candidates: EndpointCandidate[] = [
  {
    id: "showtimes-by-film-theatre",
    classification: "DISCOVERED_IN_CURRENT_CODE",
    purpose: "showtimes",
    method: "GET",
    urlTemplate:
      "https://apis.cineplex.com/prod/cpx/theatrical/api/v1/showtimes?filmId={filmId}&theatreId={theatreId}&language={language}",
    requiredParameters: ["filmId", "theatreId", "language"],
    requiredHeaders: ["Ocp-Apim-Subscription-Key"],
    requiresCookies: false,
    confidence: "high",
    evidence: [
      "Config object in JS bundle module 54753: showtimesApi.baseUrl + showtimesApi.ocpApimSubscriptionKey",
      "Live call confirmed 2026-07-18: HTTP 200, returns array of CineplexTheatreShowtime",
      "filmId=37617 (The Odyssey), theatreId=7402 (Scotiabank Theatre Toronto)",
      "Response includes experiences[].experienceTypes with IMAX, sessions with vistaSessionId and seatsRemaining",
    ],
  },
  {
    id: "showtimes-all-theatres",
    classification: "DISCOVERED_IN_CURRENT_CODE",
    purpose: "showtimes",
    method: "GET",
    urlTemplate:
      "https://apis.cineplex.com/prod/cpx/theatrical/api/v1/showtimes?filmId={filmId}&language={language}",
    requiredParameters: ["filmId", "language"],
    requiredHeaders: ["Ocp-Apim-Subscription-Key"],
    requiresCookies: false,
    confidence: "high",
    evidence: [
      "Returns 150-item array (all theatres nationwide) when theatreId omitted",
      "Live call confirmed 2026-07-18",
    ],
  },
  {
    id: "movies-list",
    classification: "DISCOVERED_IN_CURRENT_CODE",
    purpose: "movie-search",
    method: "GET",
    urlTemplate:
      "https://apis.cineplex.com/prod/cpx/theatrical/api/v1/movies?language={language}",
    requiredParameters: ["language"],
    requiredHeaders: ["Ocp-Apim-Subscription-Key"],
    requiresCookies: false,
    confidence: "high",
    evidence: [
      "Config object: movieApi.baseUrl in JS bundle module 54753",
      "Live call confirmed 2026-07-18: HTTP 200, returns { items: [...] }",
      "The Odyssey returned with id=37617",
    ],
  },
  {
    id: "theatres-by-city",
    classification: "DISCOVERED_IN_CURRENT_CODE",
    purpose: "theatre-search",
    method: "GET",
    urlTemplate:
      "https://apis.cineplex.com/prod/cpx/theatrical/api/v1/theatres?language={language}&city={city}",
    requiredParameters: ["language", "city"],
    requiredHeaders: ["Ocp-Apim-Subscription-Key"],
    requiresCookies: false,
    confidence: "high",
    evidence: [
      "Config object: theatreApi.baseUrl in JS bundle module 54753",
      "Live call confirmed 2026-07-18: city=toronto returns nearbyTheatres array",
      "Scotiabank Theatre Toronto returned with theatreId=7402, address='259 Richmond Street West', city='Toronto', provinceCode='ON'",
    ],
  },
  {
    id: "legacy-theatres-v1",
    classification: "HISTORICAL_UNVERIFIED",
    purpose: "theatre-search",
    method: "GET",
    urlTemplate: "https://www.cineplex.com/api/v1/theatres",
    requiredParameters: [],
    requiredHeaders: [],
    requiresCookies: null,
    confidence: "low",
    evidence: [
      "Referenced in historical open-source implementations",
      "Not tested — superseded by confirmed apis.cineplex.com endpoint",
    ],
  },
  {
    id: "legacy-movies-v1",
    classification: "HISTORICAL_UNVERIFIED",
    purpose: "movie-search",
    method: "GET",
    urlTemplate: "https://www.cineplex.com/api/v1/movies",
    requiredParameters: [],
    requiredHeaders: [],
    requiresCookies: null,
    confidence: "low",
    evidence: [
      "Referenced in historical open-source implementations",
      "Not tested — superseded by confirmed apis.cineplex.com endpoint",
    ],
  },
];

/** Return the highest-confidence showtimes candidate. */
export function bestShowtimesCandidate(): EndpointCandidate {
  const c = candidates.find(
    (c) => c.purpose === "showtimes" && c.confidence === "high"
  );
  if (!c) throw new Error("No high-confidence showtimes candidate");
  return c;
}
