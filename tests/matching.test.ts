import { describe, expect, it } from "vitest";
import {
  buildAbbreviatedNameKey,
  hasDuplicateMatch,
  isLikelyAbbreviatedFullName,
  requiresManualResolution,
  resolveStudentMatch
} from "@/lib/domain/matching";

describe("name-only matching policy", () => {
  it("requires manual resolution when no matches", () => {
    expect(requiresManualResolution(0)).toBe(true);
  });

  it("does not require manual resolution on single match", () => {
    expect(requiresManualResolution(1)).toBe(false);
  });

  it("flags duplicate matches", () => {
    expect(requiresManualResolution(2)).toBe(true);
    expect(hasDuplicateMatch(2)).toBe(true);
  });
});

describe("abbreviated name key builder", () => {
  it("builds first-name + last-initial key from full names", () => {
    expect(buildAbbreviatedNameKey("Tripp Dawson")).toBe("tripp d");
  });

  it("builds key from already abbreviated names", () => {
    expect(buildAbbreviatedNameKey("Tripp D.")).toBe("tripp d");
  });

  it("returns null for single-token names", () => {
    expect(buildAbbreviatedNameKey("Tripp")).toBeNull();
  });

  it("detects likely abbreviated database names", () => {
    expect(isLikelyAbbreviatedFullName("Tripp D")).toBe(true);
    expect(isLikelyAbbreviatedFullName("Tripp Dotter")).toBe(false);
  });
});

describe("student match resolution", () => {
  const studentA = { id: "1", full_name: "Tripp Dawson", normalized_name: "tripp dawson" };
  const studentB = { id: "2", full_name: "Tripp Daniels", normalized_name: "tripp daniels" };

  it("resolves exact normalized-name match first", () => {
    const result = resolveStudentMatch({
      activeNormalizedName: "tripp dawson",
      activeRawName: "Tripp D.",
      exactByNormalized: new Map([["tripp dawson", [studentA]]]),
      byAbbreviatedKey: new Map([["tripp d", [studentA, studentB]]])
    });

    expect(result.selected?.id).toBe("1");
    expect(result.matchCount).toBe(1);
    expect(result.strategy).toBe("exact");
  });

  it("resolves unique abbreviated match when exact is missing", () => {
    const result = resolveStudentMatch({
      activeNormalizedName: "tripp d",
      activeRawName: "Tripp D.",
      exactByNormalized: new Map(),
      byAbbreviatedKey: new Map([["tripp d", [studentA]]])
    });

    expect(result.selected?.id).toBe("1");
    expect(result.matchCount).toBe(1);
    expect(result.strategy).toBe("abbreviated");
  });

  it("returns unresolved for ambiguous abbreviated match", () => {
    const result = resolveStudentMatch({
      activeNormalizedName: "tripp d",
      activeRawName: "Tripp D.",
      exactByNormalized: new Map(),
      byAbbreviatedKey: new Map([["tripp d", [studentA, studentB]]])
    });

    expect(result.selected).toBeNull();
    expect(result.matchCount).toBe(2);
    expect(result.strategy).toBe("none");
  });

  it("returns unresolved for no match", () => {
    const result = resolveStudentMatch({
      activeNormalizedName: "tripp d",
      activeRawName: "Tripp D.",
      exactByNormalized: new Map(),
      byAbbreviatedKey: new Map()
    });

    expect(result.selected).toBeNull();
    expect(result.matchCount).toBe(0);
    expect(result.strategy).toBe("none");
  });

  it("prefers unique full-name abbreviated candidate over exact abbreviated record", () => {
    const abbreviatedRecord = { id: "3", full_name: "Tripp D", normalized_name: "tripp d" };
    const result = resolveStudentMatch({
      activeNormalizedName: "tripp d",
      activeRawName: "Tripp D",
      exactByNormalized: new Map([["tripp d", [abbreviatedRecord]]]),
      byAbbreviatedKey: new Map([["tripp d", [studentA]]])
    });

    expect(result.selected?.id).toBe("1");
    expect(result.strategy).toBe("abbreviated");
  });
});
