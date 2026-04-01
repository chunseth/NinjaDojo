import { normalizeName } from "@/lib/domain/normalize";

export function requiresManualResolution(matchCount: number): boolean {
  return matchCount !== 1;
}

export function hasDuplicateMatch(matchCount: number): boolean {
  return matchCount > 1;
}

export type StudentMatchCandidate = {
  id: string;
  full_name: string;
  normalized_name: string;
};

export type StudentMatchResolution = {
  selected: StudentMatchCandidate | null;
  matchCount: number;
  strategy: "exact" | "abbreviated" | "none";
};

export function isLikelyAbbreviatedFullName(input: string): boolean {
  const normalized = normalizeName(input);
  if (!normalized) {
    return false;
  }
  const abbreviatedKey = buildAbbreviatedNameKey(input);
  if (!abbreviatedKey || normalized !== abbreviatedKey) {
    return false;
  }
  const parts = normalized.split(" ").filter(Boolean);
  return parts.length === 2 && parts[1].length <= 2;
}

export function buildAbbreviatedNameKey(input: string): string | null {
  const normalized = normalizeName(input);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const firstName = parts[0];
  const lastToken = parts[parts.length - 1];
  const lastInitial = lastToken.charAt(0);
  if (!lastInitial) {
    return null;
  }

  return `${firstName} ${lastInitial}`;
}

export function resolveStudentMatch(input: {
  activeNormalizedName: string;
  activeRawName: string;
  exactByNormalized: Map<string, StudentMatchCandidate[]>;
  byAbbreviatedKey: Map<string, StudentMatchCandidate[]>;
}): StudentMatchResolution {
  const normalizedActive = normalizeName(input.activeNormalizedName);
  const exact = input.exactByNormalized.get(normalizedActive) ?? [];
  const abbreviatedKey =
    buildAbbreviatedNameKey(input.activeRawName) ?? buildAbbreviatedNameKey(input.activeNormalizedName);
  const abbreviated = abbreviatedKey ? input.byAbbreviatedKey.get(abbreviatedKey) ?? [] : [];

  if (exact.length === 1) {
    const exactCandidate = exact[0];
    if (
      isLikelyAbbreviatedFullName(exactCandidate.full_name) &&
      abbreviated.length === 1 &&
      abbreviated[0].id !== exactCandidate.id
    ) {
      return { selected: abbreviated[0], matchCount: 1, strategy: "abbreviated" };
    }
    return { selected: exactCandidate, matchCount: 1, strategy: "exact" };
  }

  if (abbreviated.length === 1) {
    return { selected: abbreviated[0], matchCount: 1, strategy: "abbreviated" };
  }

  if (abbreviated.length > 1) {
    return { selected: null, matchCount: abbreviated.length, strategy: "none" };
  }

  return { selected: null, matchCount: exact.length, strategy: "none" };
}
