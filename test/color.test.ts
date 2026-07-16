import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contrastRatio,
  evaluateContrast,
  hexToRgb,
  hslToRgb,
  oklchToRgbUnclamped,
  rgbToHex,
  rgbToHsl,
  rgbToOklch,
  toGamut,
  type Oklch,
  type Rgb,
} from "../src/color.ts";

function assertClose(
  actual: number,
  expected: number,
  tol: number,
  msg: string,
) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg}: expected ${expected}, got ${actual}`,
  );
}

// Reference vectors: CSS Color 4 / Ottosson OKLab reference values for the
// sRGB primaries, white, and black.
const REFERENCE: Array<{ name: string; rgb: Rgb; oklch: Oklch }> = [
  {
    name: "white",
    rgb: { r: 1, g: 1, b: 1 },
    oklch: { l: 1, c: 0, h: 0 },
  },
  {
    name: "black",
    rgb: { r: 0, g: 0, b: 0 },
    oklch: { l: 0, c: 0, h: 0 },
  },
  {
    name: "red",
    rgb: { r: 1, g: 0, b: 0 },
    oklch: { l: 0.62796, c: 0.25768, h: 29.234 },
  },
  {
    name: "green",
    rgb: { r: 0, g: 1, b: 0 },
    oklch: { l: 0.86644, c: 0.29483, h: 142.495 },
  },
  {
    name: "blue",
    rgb: { r: 0, g: 0, b: 1 },
    oklch: { l: 0.45201, c: 0.31321, h: 264.052 },
  },
];

test("sRGB to OKLCH matches reference vectors", () => {
  for (const { name, rgb, oklch } of REFERENCE) {
    const actual = rgbToOklch(rgb);
    assertClose(actual.l, oklch.l, 1e-3, `${name} L`);
    assertClose(actual.c, oklch.c, 1e-3, `${name} C`);
    if (oklch.c > 1e-4) assertClose(actual.h, oklch.h, 0.1, `${name} H`);
  }
});

test("OKLCH to sRGB round trips within tolerance", () => {
  for (const { name, rgb } of REFERENCE) {
    const back = oklchToRgbUnclamped(rgbToOklch(rgb));
    assertClose(back.r, rgb.r, 1e-5, `${name} r`);
    assertClose(back.g, rgb.g, 1e-5, `${name} g`);
    assertClose(back.b, rgb.b, 1e-5, `${name} b`);
  }
});

test("hex round trips", () => {
  for (const hex of ["#000000", "#ffffff", "#1a7f5c", "#c03bff"]) {
    const rgb = hexToRgb(hex);
    assert.ok(rgb, hex);
    assert.equal(rgbToHex(rgb), hex);
  }
  assert.deepEqual(hexToRgb("#abc"), hexToRgb("#aabbcc"));
  assert.equal(hexToRgb("nope"), null);
  assert.equal(hexToRgb("#12345"), null);
  assert.equal(hexToRgb("#gggggg"), null);
});

test("HSL round trips within tolerance", () => {
  for (const rgb of [
    { r: 1, g: 0, b: 0 },
    { r: 0.2, g: 0.4, b: 0.8 },
    { r: 0.5, g: 0.5, b: 0.5 },
  ]) {
    const back = hslToRgb(rgbToHsl(rgb));
    assertClose(back.r, rgb.r, 1e-9, "r");
    assertClose(back.g, rgb.g, 1e-9, "g");
    assertClose(back.b, rgb.b, 1e-9, "b");
  }
  // Achromatic: hue/saturation are zero.
  const grey = rgbToHsl({ r: 0.5, g: 0.5, b: 0.5 });
  assert.equal(grey.h, 0);
  assert.equal(grey.s, 0);
});

test("gamut mapping reduces chroma and flags the clamp", () => {
  const impossible: Oklch = { l: 0.7, c: 0.35, h: 145 };
  const result = toGamut(impossible);
  assert.equal(result.clamped, true);
  assert.ok(result.color.c < impossible.c);
  for (const v of [result.rgb.r, result.rgb.g, result.rgb.b]) {
    assert.ok(v >= 0 && v <= 1);
  }
  // Lightness and hue are preserved by the mapping.
  assertClose(result.color.l, impossible.l, 1e-9, "L preserved");
  assertClose(result.color.h, impossible.h, 1e-9, "H preserved");

  const inGamut = toGamut({ l: 0.6, c: 0.1, h: 200 });
  assert.equal(inGamut.clamped, false);
});

test("WCAG contrast ratios match known values", () => {
  const white: Rgb = { r: 1, g: 1, b: 1 };
  const black: Rgb = { r: 0, g: 0, b: 0 };
  assertClose(contrastRatio(white, black), 21, 1e-9, "white/black");
  assertClose(contrastRatio(white, white), 1, 1e-9, "white/white");
  // #767676 on white is the canonical ~4.54:1 AA boundary example.
  const grey = hexToRgb("#767676")!;
  assertClose(contrastRatio(grey, white), 4.54, 0.01, "#767676/white");
  // Order must not matter.
  assert.equal(contrastRatio(grey, white), contrastRatio(white, grey));
});

test("contrast verdicts apply WCAG thresholds", () => {
  const v = evaluateContrast(hexToRgb("#767676")!, { r: 1, g: 1, b: 1 });
  assert.equal(v.aaNormal, true);
  assert.equal(v.aaLarge, true);
  assert.equal(v.aaaNormal, false);
  assert.equal(v.aaaLarge, true);
});
