import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRACKET_SIZE,
  currentDay,
  dailyBracket,
  deriveGame,
  nearestContender,
  POOL,
  TOTAL_ROUNDS,
} from "../src/game.ts";
import { toGamut } from "../src/color.ts";

const DAY = 20_650; // fixed day so tests are stable

test("pool names and hexes are unique and colors are in gamut", () => {
  assert.equal(new Set(POOL.map((c) => c.name)).size, POOL.length);
  assert.equal(new Set(POOL.map((c) => c.hex)).size, POOL.length);
  for (const c of POOL) {
    assert.equal(toGamut(c.color).clamped, false, c.name);
    assert.ok(c.tagline.length > 0, c.name);
  }
});

test("the daily bracket is 16 distinct pool members, the same for everyone", () => {
  const bracket = dailyBracket(DAY);
  assert.equal(bracket.length, BRACKET_SIZE);
  assert.equal(new Set(bracket.map((c) => c.name)).size, BRACKET_SIZE);
  for (const c of bracket) assert.ok(POOL.includes(c));
  assert.deepEqual(bracket, dailyBracket(DAY));
});

test("different days draw different brackets", () => {
  const names = (day: number) => dailyBracket(day).map((c) => c.name);
  assert.notDeepEqual(names(DAY), names(DAY + 1));
  assert.notDeepEqual(names(DAY + 1), names(DAY + 2));
});

test("currentDay is days since the Unix epoch, UTC", () => {
  assert.equal(currentDay(0), 0);
  assert.equal(currentDay(86_400_000), 1);
  assert.equal(currentDay(86_399_999), 0);
});

test("same day and picks always crown the same champion", () => {
  const picks = [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0];
  assert.deepEqual(deriveGame(DAY, picks), deriveGame(DAY, picks));
});

test("an unfinished bracket exposes the next matchup, not a result", () => {
  const view = deriveGame(DAY, [0, 1, 0]);
  assert.equal(view.result, null);
  assert.ok(view.round);
  assert.equal(view.roundsPlayed, 3);
  assert.equal(view.totalRounds, TOTAL_ROUNDS);
  assert.equal(view.round.index, 3);
  assert.equal(view.round.stage, "Round of 16");
  assert.equal(view.round.match, 4);
  assert.equal(view.round.matchCount, 8);
  // Both panels always show distinct named colors.
  assert.match(view.round.left.hex, /^#[0-9a-f]{6}$/);
  assert.notEqual(view.round.left.hex, view.round.right.hex);
  assert.notEqual(view.round.left.name, view.round.right.name);
});

test("stages progress round of 16 → quarterfinals → semifinals → final", () => {
  const stageAt = (n: number) => deriveGame(DAY, Array(n).fill(0)).round?.stage;
  assert.equal(stageAt(0), "Round of 16");
  assert.equal(stageAt(7), "Round of 16");
  assert.equal(stageAt(8), "Quarterfinals");
  assert.equal(stageAt(11), "Quarterfinals");
  assert.equal(stageAt(12), "Semifinals");
  assert.equal(stageAt(13), "Semifinals");
  assert.equal(stageAt(14), "Final");
  assert.equal(deriveGame(DAY, Array(TOTAL_ROUNDS).fill(0)).round, null);
});

test("winners advance: the round-of-16 winner appears in the quarterfinals", () => {
  const bracket = dailyBracket(DAY);
  // Pick right in match 1, left everywhere else: quarterfinal match 1 must
  // pit the match-1 winner (seed 2) against the match-2 winner (seed 3).
  const qf = deriveGame(DAY, [1, 0, 0, 0, 0, 0, 0, 0]).round!;
  assert.equal(qf.stage, "Quarterfinals");
  assert.equal(qf.left.name, bracket[1]!.name);
  assert.equal(qf.right.name, bracket[2]!.name);
});

test("all-left picks crown the first seed, all-right the last", () => {
  const bracket = dailyBracket(DAY);
  const left = deriveGame(DAY, Array(TOTAL_ROUNDS).fill(0)).result!;
  const right = deriveGame(DAY, Array(TOTAL_ROUNDS).fill(1)).result!;
  assert.equal(left.champion.name, bracket[0]!.name);
  assert.equal(right.champion.name, bracket[BRACKET_SIZE - 1]!.name);
});

test("every complete pick sequence crowns an in-gamut contender with a full path", () => {
  const champions = new Set<string>();
  for (let mask = 0; mask < 1 << TOTAL_ROUNDS; mask++) {
    const picks = Array.from(
      { length: TOTAL_ROUNDS },
      (_, i) => (mask >> i) & 1,
    );
    const { result } = deriveGame(DAY, picks);
    assert.ok(result, `no result for ${picks.join("")}`);
    assert.equal(toGamut(result.champion.color).clamped, false);
    assert.equal(result.path.length, TOTAL_ROUNDS);
    assert.notEqual(result.champion.name, result.runnerUp.name);
    champions.add(result.champion.name);
  }
  // Every bracket member can win.
  assert.equal(champions.size, BRACKET_SIZE);
});

test("extra and invalid answers are ignored", () => {
  const picks = Array(TOTAL_ROUNDS).fill(1);
  const padded = [...picks, 1, 0, 7];
  assert.deepEqual(deriveGame(DAY, padded), deriveGame(DAY, picks));
  // Non-1 values count as left picks rather than corrupting state.
  const weird = deriveGame(DAY, [
    2 as number,
    ...Array(TOTAL_ROUNDS - 1).fill(0),
  ]);
  const zeros = deriveGame(DAY, Array(TOTAL_ROUNDS).fill(0));
  assert.deepEqual(weird, zeros);
});

test("nearestContender maps every pool color to itself", () => {
  for (const c of POOL) {
    assert.equal(nearestContender(c.color).name, c.name);
  }
});

test("nearestContender names arbitrary colors", () => {
  const near = nearestContender({ l: 0.5202, c: 0.1901, h: 262.02 });
  assert.equal(near.name, "Cobalt");
});
