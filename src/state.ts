/**
 * Versioned persistence and share-URL codec. All parsing validates shape and
 * numeric ranges; anything malformed or oversized is rejected (returns null)
 * rather than partially trusted.
 */

import type { Oklch } from "./color.ts";

export const STORAGE_KEY = "perfect-color:v1";
export const MAX_HASH_LENGTH = 64;
const MAX_STORED_LENGTH = 4096;

export interface PersistedState {
  version: 1;
  color: Oklch;
  quizAnswers?: number[];
}

function isValidColor(value: unknown): value is Oklch {
  if (typeof value !== "object" || value === null) return false;
  const { l, c, h } = value as Record<string, unknown>;
  return (
    typeof l === "number" &&
    Number.isFinite(l) &&
    l >= 0 &&
    l <= 1 &&
    typeof c === "number" &&
    Number.isFinite(c) &&
    c >= 0 &&
    c <= 0.5 &&
    typeof h === "number" &&
    Number.isFinite(h) &&
    h >= 0 &&
    h < 360
  );
}

/** Parses a stored JSON string. Returns null for anything invalid. */
export function parsePersisted(json: string | null): PersistedState | null {
  if (json === null || json.length > MAX_STORED_LENGTH) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record["version"] !== 1 || !isValidColor(record["color"])) return null;
  const state: PersistedState = { version: 1, color: record["color"] };
  const answers = record["quizAnswers"];
  if (Array.isArray(answers)) {
    if (answers.length > 16 || !answers.every((a) => a === 0 || a === 1)) {
      return null;
    }
    state.quizAnswers = answers as number[];
  }
  return state;
}

export function serializePersisted(state: PersistedState): string {
  return JSON.stringify(state);
}

/** Encodes a color as a bounded URL hash fragment, e.g. `#c=0.628_0.2577_29.23`. */
export function encodeShareHash(color: Oklch): string {
  const hash = `#c=${round(color.l, 4)}_${round(color.c, 4)}_${round(color.h, 2)}`;
  // ponytail: fixed precision keeps this well under MAX_HASH_LENGTH by construction
  return hash;
}

function round(v: number, digits: number): string {
  return String(Number(v.toFixed(digits)));
}

/** Decodes a share hash. Returns null for malformed, oversized, or out-of-range input. */
export function decodeShareHash(hash: string): Oklch | null {
  if (hash.length > MAX_HASH_LENGTH) return null;
  const m = /^#?c=([\d.]+)_([\d.]+)_([\d.]+)$/.exec(hash);
  if (!m) return null;
  const color = {
    l: Number(m[1]),
    c: Number(m[2]),
    h: Number(m[3]) % 360,
  };
  return isValidColor(color) ? color : null;
}
