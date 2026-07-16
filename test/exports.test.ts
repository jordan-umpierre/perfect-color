import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeXml,
  toCssVariables,
  toJsonTokens,
  toSvgSwatches,
} from "../src/exports.ts";
import { buildPalette } from "../src/palette.ts";
import type { Swatch } from "../src/palette.ts";

const PALETTE: Swatch[] = [
  {
    name: "base",
    color: { l: 0.65, c: 0.12, h: 250 },
    hex: "#5a8bc4",
    clamped: false,
  },
  {
    name: "complement",
    color: { l: 0.65, c: 0.096, h: 70 },
    hex: "#a98a52",
    clamped: false,
  },
];

test("CSS export snapshot", () => {
  assert.equal(
    toCssVariables(PALETTE),
    `:root {
  --color-base: oklch(0.6500 0.1200 250.00);
  --color-base-hex: #5a8bc4;
  --color-complement: oklch(0.6500 0.0960 70.00);
  --color-complement-hex: #a98a52;
}
`,
  );
});

test("JSON tokens export snapshot", () => {
  const parsed = JSON.parse(toJsonTokens(PALETTE));
  assert.deepEqual(parsed, {
    color: {
      base: {
        $type: "color",
        $value: "#5a8bc4",
        $description: "oklch(0.6500 0.1200 250.00)",
      },
      complement: {
        $type: "color",
        $value: "#a98a52",
        $description: "oklch(0.6500 0.0960 70.00)",
      },
    },
  });
});

test("SVG export contains one labeled rect per swatch", () => {
  const svg = toSvgSwatches(PALETTE);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.equal(svg.match(/<rect /g)?.length, 2);
  assert.ok(svg.includes('fill="#5a8bc4"'));
  assert.ok(svg.includes(">base</text>"));
});

test("SVG export escapes markup in names", () => {
  const hostile: Swatch = {
    name: '<script>alert("x")</script>',
    color: { l: 0.5, c: 0.1, h: 20 },
    hex: "#aa3355",
    clamped: false,
  };
  const svg = toSvgSwatches([hostile]);
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
});

test("escapeXml covers all five entities", () => {
  assert.equal(escapeXml(`<&>"'`), "&lt;&amp;&gt;&quot;&apos;");
});

test("generated palette exports are internally consistent", () => {
  const palette = buildPalette({ l: 0.65, c: 0.12, h: 250 });
  assert.equal(palette.length, 8);
  assert.equal(new Set(palette.map((s) => s.name)).size, 8);
  const css = toCssVariables(palette);
  for (const s of palette) {
    assert.ok(css.includes(`--color-${s.name}: `));
    assert.ok(css.includes(s.hex));
    assert.match(s.hex, /^#[0-9a-f]{6}$/);
  }
});
