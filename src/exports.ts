/**
 * Export generators: CSS custom properties, W3C-style JSON design tokens, and
 * SVG swatches. All interpolated text is escaped so exports stay inert even
 * if swatch names ever come from user input.
 */

import { formatOklch } from "./color.ts";
import type { Swatch } from "./palette.ts";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Restricts a swatch name to a safe CSS identifier fragment. */
function cssName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

export function toCssVariables(palette: readonly Swatch[]): string {
  const lines = palette.flatMap((s) => [
    `  --color-${cssName(s.name)}: ${formatOklch(s.color)};`,
    `  --color-${cssName(s.name)}-hex: ${s.hex};`,
  ]);
  return `:root {\n${lines.join("\n")}\n}\n`;
}

export function toJsonTokens(palette: readonly Swatch[]): string {
  const tokens: Record<string, unknown> = {};
  for (const s of palette) {
    tokens[cssName(s.name)] = {
      $type: "color",
      $value: s.hex,
      $description: formatOklch(s.color),
    };
  }
  return JSON.stringify({ color: tokens }, null, 2) + "\n";
}

const SWATCH_SIZE = 96;
const LABEL_HEIGHT = 40;

export function toSvgSwatches(palette: readonly Swatch[]): string {
  const width = palette.length * SWATCH_SIZE;
  const height = SWATCH_SIZE + LABEL_HEIGHT;
  const cells = palette
    .map((s, i) => {
      const x = i * SWATCH_SIZE;
      const name = escapeXml(s.name);
      const hex = escapeXml(s.hex);
      return (
        `  <rect x="${x}" y="0" width="${SWATCH_SIZE}" height="${SWATCH_SIZE}" fill="${hex}"/>\n` +
        `  <text x="${x + 8}" y="${SWATCH_SIZE + 16}" font-family="monospace" font-size="11">${name}</text>\n` +
        `  <text x="${x + 8}" y="${SWATCH_SIZE + 32}" font-family="monospace" font-size="11">${hex}</text>`
      );
    })
    .join("\n");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" aria-label="Color palette swatches">\n` +
    `${cells}\n</svg>\n`
  );
}
