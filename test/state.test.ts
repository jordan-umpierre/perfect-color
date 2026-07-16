import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_HASH_LENGTH,
  decodeShareHash,
  encodeShareHash,
  parsePersisted,
  serializePersisted,
  type PersistedState,
} from "../src/state.ts";

test("share hash round trips within precision", () => {
  const color = { l: 0.62796, c: 0.25768, h: 29.234 };
  const hash = encodeShareHash(color);
  assert.ok(hash.length <= MAX_HASH_LENGTH, `hash too long: ${hash}`);
  const decoded = decodeShareHash(hash);
  assert.ok(decoded);
  assert.ok(Math.abs(decoded.l - color.l) < 1e-4);
  assert.ok(Math.abs(decoded.c - color.c) < 1e-4);
  assert.ok(Math.abs(decoded.h - color.h) < 1e-2);
});

test("malformed and oversized hashes are rejected", () => {
  assert.equal(decodeShareHash(""), null);
  assert.equal(decodeShareHash("#c=abc_def_ghi"), null);
  assert.equal(decodeShareHash("#c=0.5_0.1"), null);
  assert.equal(decodeShareHash("#x=0.5_0.1_20"), null);
  assert.equal(decodeShareHash(`#c=${"9".repeat(100)}_0.1_20`), null);
  // Out-of-range values are rejected, not clamped.
  assert.equal(decodeShareHash("#c=2_0.1_20"), null);
  assert.equal(decodeShareHash("#c=0.5_0.9_20"), null);
});

test("persisted state round trips", () => {
  const state: PersistedState = {
    version: 1,
    color: { l: 0.65, c: 0.12, h: 250 },
    quizAnswers: [0, 1, 0, 1, 0, 1],
  };
  assert.deepEqual(parsePersisted(serializePersisted(state)), state);
});

test("corrupt stored state is rejected", () => {
  assert.equal(parsePersisted(null), null);
  assert.equal(parsePersisted("not json {"), null);
  assert.equal(parsePersisted("null"), null);
  assert.equal(parsePersisted('"a string"'), null);
  assert.equal(
    parsePersisted('{"version":2,"color":{"l":0.5,"c":0.1,"h":20}}'),
    null,
  );
  assert.equal(
    parsePersisted('{"version":1,"color":{"l":"x","c":0.1,"h":20}}'),
    null,
  );
  assert.equal(
    parsePersisted('{"version":1,"color":{"l":5,"c":0.1,"h":20}}'),
    null,
  );
  assert.equal(
    parsePersisted(
      '{"version":1,"color":{"l":0.5,"c":0.1,"h":20},"quizAnswers":[7]}',
    ),
    null,
  );
  // Oversized payloads are rejected outright.
  assert.equal(parsePersisted("[" + "1,".repeat(5000) + "1]"), null);
});
