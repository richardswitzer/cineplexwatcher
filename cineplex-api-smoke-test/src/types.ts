/**
 * Normalised domain types — independent of Cineplex raw response schema.
 * Schema evidence: confirmed from live API on 2026-07-18.
 */

export interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  releaseDate?: string;
  pageUrl?: string;
  raw?: unknown;
}

export interface Theatre {
  id: string;
  name: string;
  address?: string;
  city?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  pageUrl?: string;
  raw?: unknown;
}

export interface Screening {
  screeningId: string;
  movieId: string;
  movieTitle: string;
  theatreId: string;
  theatreName: string;
  startsAt: string;           // ISO-8601
  localDate: string;          // YYYY-MM-DD
  localTime: string;          // HH:mm
  timezone: string;           // America/Toronto
  experienceName?: string;    // e.g. "IMAX, Laser Projection"
  auditoriumName?: string;    // e.g. "IMAX"
  language?: string;
  accessibility?: string[];
  bookingUrl?: string;        // ticketingRedesignUrl
  isBookable: boolean;
  availabilityStatus?: string;
  seatsRemaining?: number;
  isSoldOut?: boolean;
  vistaSessionId?: number;
  sourceEndpoint: string;
  raw?: unknown;
}

export interface AvailabilityResult {
  checkedAt: string;
  target: {
    movieTitle: string;
    theatreName: string;
    format?: string;
  };
  resolved: {
    movieId?: string;
    theatreId?: string;
    locationId?: string;
    siteId?: string;
  };
  endpointConfirmed: boolean;
  endpointUrl?: string;
  publiclyCallable: boolean;
  screenings: Screening[];
  matchingScreenings: Screening[];
  conclusions: string[];
  unknowns: string[];
}

/** Raw Cineplex API types — as observed 2026-07-18 */

export interface CineplexSession {
  seatMapUrl: string;
  ticketingUrl: string;
  ticketingRedesignUrl: string;
  getTicketingUrlApi: string;
  deeplinkUrl: string;
  showtimeShareKey: string;
  vistaSessionId: number;
  areaCode: string;
  showStartDateTime: string;
  showStartDateTimeUtc: string;
  isInThePast: boolean;
  isReservedSeating: boolean;
  isShowtimeEnabledOnline: boolean;
  seatsRemaining: number;
  isSoldOut: boolean;
  auditorium: string;
}

export interface CineplexExperience {
  experienceTypes: string[];
  order: number;
  isCcEnabled: boolean;
  isDsEnabled: boolean;
  sessions: CineplexSession[];
}

export interface CineplexMovieShowtime {
  id: number;
  presentationType: string;
  name: string;
  filmUrl: string;
  isEvent: boolean;
  runtimeInMinutes: number;
  smallPosterImageUrl: string;
  mediumPosterImageUrl: string;
  largePosterImageUrl: string;
  genres: string[];
  experiences: CineplexExperience[];
}

export interface CineplexDateEntry {
  startDate: string;
  movies: CineplexMovieShowtime[];
}

export interface CineplexTheatreShowtime {
  theatre: string;
  theatreId: number;
  dates: CineplexDateEntry[];
}

export interface CineplexMovieListItem {
  id: number;
  releaseDate: string;
  name: string;
  runtimeInMinutes: number;
  filmUrl: string;
  smallPosterImageUrl: string;
  mediumPosterImageUrl: string;
  largePosterImageUrl: string;
  brightcoveVideoId: string;
  language: string;
}

export interface CineplexMoviesResponse {
  items: CineplexMovieListItem[];
}

export interface CineplexTheatreLocation {
  geoLocation: { latitude: number; longitude: number };
  distanceToOriginInMeters: number;
  hasDistanceToOrigin: boolean;
  address: string;
  city: string;
  provinceCode: string;
  postalCode: string;
}

export interface CineplexTheatreListItem {
  theatreId: number;
  theatreName: string;
  shortTheatreName: string;
  theatreUrl: string;
  hasFreeParking: boolean;
  alertMessages: unknown;
  location: CineplexTheatreLocation;
}

export interface CineplexTheatresResponse {
  favouriteTheatres: CineplexTheatreListItem[];
  nearbyTheatres: CineplexTheatreListItem[];
}

export interface EndpointCandidate {
  id: string;
  classification:
    | "OBSERVED_CURRENT"
    | "DISCOVERED_IN_CURRENT_CODE"
    | "HISTORICAL_UNVERIFIED"
    | "INFERRED"
    | "REJECTED";
  purpose:
    | "movie-search"
    | "theatre-search"
    | "bookable-dates"
    | "showtimes"
    | "session-details"
    | "formats"
    | "unknown";
  method: string;
  urlTemplate: string;
  requiredParameters: string[];
  requiredHeaders: string[];
  requiresCookies: boolean | null;
  evidence: string[];
  confidence: "high" | "medium" | "low";
}
