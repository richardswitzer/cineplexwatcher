/**
 * normalize.test.ts — Unit tests for the normalize module.
 */

import { describe, it, expect } from "vitest";
import { matchesFormat, titlesMatch, theatreMatches } from "../src/normalize.js";
import type { Theatre } from "../src/types.js";

describe("matchesFormat", () => {
  it("matches IMAX exactly", () => {
    expect(matchesFormat("IMAX", "IMAX")).toBe(true);
  });
  it("matches IMAX, Laser Projection", () => {
    expect(matchesFormat("IMAX, Laser Projection", "IMAX")).toBe(true);
  });
  it("matches IMAX 70MM", () => {
    expect(matchesFormat("IMAX 70MM", "IMAX")).toBe(true);
  });
  it("does not match UltraAVX for IMAX", () => {
    expect(matchesFormat("UltraAVX, D-BOX, Laser Projection", "IMAX")).toBe(false);
  });
  it("does not match standard for IMAX", () => {
    expect(matchesFormat("Standard", "IMAX")).toBe(false);
  });
  it("handles empty strings", () => {
    expect(matchesFormat("", "IMAX")).toBe(false);
    expect(matchesFormat("IMAX", "")).toBe(false);
  });
});

describe("titlesMatch", () => {
  it("matches exact titles", () => {
    expect(titlesMatch("The Odyssey", "The Odyssey")).toBe(true);
  });
  it("matches case-insensitive", () => {
    expect(titlesMatch("the odyssey", "THE ODYSSEY")).toBe(true);
  });
  it("does not match different titles", () => {
    expect(titlesMatch("The Odyssey", "The Batman")).toBe(false);
  });
  it("normalises apostrophes", () => {
    expect(titlesMatch("Schindler's List", "Schindler\u2019s List")).toBe(true);
  });
});

describe("theatreMatches", () => {
  const scotiabank: Theatre = {
    id: "7402",
    name: "Scotiabank Theatre Toronto",
    city: "Toronto",
    province: "ON",
  };

  it("matches Scotiabank Theatre Toronto in Toronto, ON", () => {
    expect(theatreMatches(scotiabank, "Scotiabank Theatre Toronto", "Toronto", "ON")).toBe(true);
  });
  it("does not match wrong city", () => {
    expect(theatreMatches(scotiabank, "Scotiabank Theatre Toronto", "Calgary", "AB")).toBe(false);
  });
});
