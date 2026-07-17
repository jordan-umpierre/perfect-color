/**
 * The daily color tournament: every UTC day, a date-seeded shuffle draws 16
 * named colors from a pool of 48 into a single-elimination bracket. Every
 * player in the world gets the same bracket on the same day, so champions
 * are comparable and shareable without any server.
 *
 * Deliberately transparent and subjective: the whole bracket is a pure
 * function of (day, pick sequence) — same day and picks always crown the
 * same champion — and the result lists the champion's full road to the
 * title. No personality claims; taglines describe the color, not you.
 */

import { rgbToHex, toGamut, type Oklch } from "./color.ts";

export interface Contender {
  name: string;
  /** A playful one-liner about the color itself. */
  tagline: string;
  /** Gamut-mapped at construction, so contenders are always inside sRGB. */
  color: Oklch;
  hex: string;
}

function contender(
  name: string,
  tagline: string,
  l: number,
  c: number,
  h: number,
): Contender {
  const mapped = toGamut({ l, c, h });
  return { name, tagline, color: mapped.color, hex: rgbToHex(mapped.rgb) };
}

/** 48 named colors spread around the hue wheel, plus a few moody neutrals. */
export const POOL: readonly Contender[] = [
  contender("Cherry Bomb", "Loud, proud, slightly dangerous.", 0.6, 0.2, 25),
  contender("Rosewood", "Old money. Quiet power.", 0.45, 0.09, 20),
  contender("Salmon Run", "Upstream, always.", 0.75, 0.12, 30),
  contender("Brick Oven", "Warm crust energy.", 0.52, 0.13, 35),
  contender("Tangerine", "Zest first, questions later.", 0.72, 0.17, 55),
  contender("Marmalade", "Sticky-sweet sunshine.", 0.68, 0.14, 65),
  contender("Terracotta", "Sunbaked and unbothered.", 0.58, 0.11, 50),
  contender("Apricot", "Soft-spoken, golden-hearted.", 0.82, 0.1, 60),
  contender("Honey Gold", "Slow-poured luxury.", 0.8, 0.14, 85),
  contender("Lemon Zing", "Wakes up the whole room.", 0.9, 0.16, 100),
  contender("Mustard Seed", "Bold takes, deli energy.", 0.7, 0.12, 95),
  contender("Butterscotch", "Grandma's secret weapon.", 0.78, 0.11, 80),
  contender(
    "Chartreuse",
    "Louder than it has any right to be.",
    0.85,
    0.19,
    125,
  ),
  contender("Pistachio", "Cracked open, worth it.", 0.82, 0.09, 130),
  contender("Olive Branch", "Comes in peace.", 0.6, 0.08, 115),
  contender("Limeade", "Front-porch fizz.", 0.88, 0.17, 135),
  contender("Shamrock", "Luck is a strategy.", 0.65, 0.16, 150),
  contender("Fern Gully", "Filtered light, deep roots.", 0.55, 0.1, 145),
  contender("Matcha", "Calm, whisked, expensive.", 0.75, 0.08, 140),
  contender(
    "Emerald City",
    "Worth the yellow brick commute.",
    0.58,
    0.14,
    155,
  ),
  contender("Verdigris", "Aged copper, timeless flex.", 0.68, 0.11, 180),
  contender("Jungle Mist", "Humid, mysterious, thriving.", 0.78, 0.07, 175),
  contender("Deep Sea", "Pressure makes it shine.", 0.42, 0.08, 200),
  contender(
    "Spearmint",
    "Cooler than the other side of the pillow.",
    0.85,
    0.1,
    165,
  ),
  contender("Lagoon", "Vacation mode, permanently.", 0.7, 0.13, 210),
  contender("Sky", "Optimism, unlimited.", 0.78, 0.1, 235),
  contender("Glacier", "Slow, unstoppable, sparkling.", 0.85, 0.06, 220),
  contender("Poolside", "Cannonball approved.", 0.8, 0.1, 215),
  contender("Cobalt", "Serious ink for serious dreams.", 0.52, 0.19, 262),
  contender("Midnight Oil", "Burning bright after hours.", 0.35, 0.1, 265),
  contender("Denim", "Goes with everything, always has.", 0.55, 0.1, 255),
  contender("Periwinkle", "Soft chaos, lovely manners.", 0.75, 0.09, 275),
  contender("Ultraviolet", "Beyond visible cool.", 0.5, 0.21, 295),
  contender("Amethyst", "Crystal-clear intentions.", 0.62, 0.15, 310),
  contender("Lavender Haze", "Drifting on purpose.", 0.8, 0.07, 300),
  contender("Grape Soda", "Fizzy nostalgia in a can.", 0.55, 0.16, 305),
  contender("Hot Magenta", "Cannot and will not tone it down.", 0.63, 0.23, 345),
  contender("Orchid", "High maintenance, worth it.", 0.72, 0.14, 330),
  contender("Bubblegum", "Pops on principle.", 0.82, 0.09, 0),
  contender("Fuchsia Flash", "Blink and you'll still see it.", 0.68, 0.2, 335),
  contender("Slate", "Unbothered. Load-bearing.", 0.55, 0.03, 250),
  contender("Charcoal Sketch", "First drafts, best ideas.", 0.35, 0.02, 270),
  contender("Fog Bank", "Mysterious before noon.", 0.8, 0.02, 240),
  contender("Espresso", "Bitter? No. Concentrated.", 0.32, 0.05, 45),
  contender("Peach Fuzz", "Soft focus, warm filter.", 0.85, 0.07, 45),
  contender("Sea Glass", "Tumbled smooth by drama.", 0.82, 0.05, 190),
  contender("Royal Plum", "Crown optional.", 0.45, 0.13, 320),
  contender("Neon Sprout", "Photosynthesizing attention.", 0.8, 0.2, 145),
];

export const BRACKET_SIZE = 16;

/** Single elimination: n contenders play n − 1 matches. */
export const TOTAL_ROUNDS = BRACKET_SIZE - 1;

/** Days since the Unix epoch, UTC — the shared daily bracket seed. */
export function currentDay(now = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

/** Deterministic PRNG (mulberry32) so every player shuffles identically. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The bracket for a given day: a seeded draw of 16 from the pool. */
export function dailyBracket(day: number): Contender[] {
  const rand = mulberry32(day);
  const pool = [...POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, BRACKET_SIZE);
}

const STAGE_NAMES: Record<number, string> = {
  16: "Round of 16",
  8: "Quarterfinals",
  4: "Semifinals",
  2: "Final",
};

export interface Round {
  stage: string;
  /** 1-based match number within the stage. */
  match: number;
  /** Matches in this stage. */
  matchCount: number;
  /** 0-based match number across the whole bracket. */
  index: number;
  left: Contender;
  right: Contender;
}

export interface GameResult {
  champion: Contender;
  runnerUp: Contender;
  /** One line per match: who beat whom at which stage. */
  path: string[];
}

export interface GameView {
  /** The next matchup to play, or null when the bracket is decided. */
  round: Round | null;
  /** The champion, present only when all matches are answered. */
  result: GameResult | null;
  roundsPlayed: number;
  totalRounds: number;
}

/**
 * Derives the bracket state for a day from the pick sequence (0 = left,
 * 1 = right). Extra or invalid answers beyond TOTAL_ROUNDS are ignored.
 */
export function deriveGame(day: number, answers: readonly number[]): GameView {
  const picks = answers
    .slice(0, TOTAL_ROUNDS)
    .map((a) => (a === 1 ? 1 : 0) as 0 | 1);
  const path: string[] = [];
  let entrants = dailyBracket(day);
  let index = 0;
  let runnerUp = entrants[1]!;
  while (entrants.length > 1) {
    const stage = STAGE_NAMES[entrants.length]!;
    const matchCount = entrants.length / 2;
    const winners: Contender[] = [];
    for (let m = 0; m < matchCount; m++) {
      const left = entrants[2 * m]!;
      const right = entrants[2 * m + 1]!;
      if (index >= picks.length) {
        return {
          round: { stage, match: m + 1, matchCount, index, left, right },
          result: null,
          roundsPlayed: index,
          totalRounds: TOTAL_ROUNDS,
        };
      }
      const winner = picks[index] === 1 ? right : left;
      const loser = picks[index] === 1 ? left : right;
      path.push(`${stage}: ${winner.name} beat ${loser.name}.`);
      winners.push(winner);
      if (entrants.length === 2) runnerUp = loser;
      index++;
    }
    entrants = winners;
  }
  return {
    round: null,
    result: { champion: entrants[0]!, runnerUp, path },
    roundsPlayed: TOTAL_ROUNDS,
    totalRounds: TOTAL_ROUNDS,
  };
}

/** The pool color nearest to `color`, by Euclidean distance in OKLab. */
export function nearestContender(color: Oklch): Contender {
  const lab = toLab(color);
  let best = POOL[0]!;
  let bestDist = Infinity;
  for (const candidate of POOL) {
    const other = toLab(candidate.color);
    const dist =
      (lab.l - other.l) ** 2 +
      (lab.a - other.a) ** 2 +
      (lab.b - other.b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

function toLab(color: Oklch): { l: number; a: number; b: number } {
  const rad = (color.h * Math.PI) / 180;
  return { l: color.l, a: color.c * Math.cos(rad), b: color.c * Math.sin(rad) };
}
