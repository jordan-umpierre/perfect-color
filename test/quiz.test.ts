import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS, scoreQuiz } from "../src/quiz.ts";
import { toGamut } from "../src/color.ts";

test("same answers always produce the same color", () => {
  const answers = [0, 1, 0, 1, 0, 1];
  assert.deepEqual(scoreQuiz(answers), scoreQuiz(answers));
});

test("different answers produce different colors", () => {
  const allFirst = scoreQuiz(QUESTIONS.map(() => 0));
  const allSecond = scoreQuiz(QUESTIONS.map(() => 1));
  assert.notDeepEqual(allFirst.color, allSecond.color);
});

test("explanation has one entry per answer", () => {
  const answers = [1, 0, 1, 0, 1, 0];
  const result = scoreQuiz(answers);
  assert.equal(result.explanation.length, answers.length);
  for (const line of result.explanation) {
    assert.ok(line.length > 0);
  }
});

test("result color is always inside the sRGB gamut", () => {
  for (let mask = 0; mask < 1 << QUESTIONS.length; mask++) {
    const answers = QUESTIONS.map((_, i) => (mask >> i) & 1);
    const { color } = scoreQuiz(answers);
    assert.equal(toGamut(color).clamped, false, `answers ${answers.join("")}`);
    assert.ok(color.l >= 0.25 && color.l <= 0.9);
  }
});

test("every question has exactly two options with swatch colors", () => {
  assert.equal(QUESTIONS.length, 6);
  for (const q of QUESTIONS) {
    assert.equal(q.options.length, 2);
    for (const option of q.options) {
      assert.ok(option.label.length > 0);
      assert.ok(option.explain.length > 0);
    }
  }
});
