/**
 * Restrained palette generation. Everything derives from the one canonical
 * OKLCH base color and is explicitly gamut-mapped.
 */

import { rgbToHex, toGamut, type Oklch } from "./color.ts";

export interface Swatch {
  name: string;
  color: Oklch;
  hex: string;
  /** True when the requested color fell outside sRGB and chroma was reduced. */
  clamped: boolean;
}

function swatch(name: string, requested: Oklch): Swatch {
  const { rgb, color, clamped } = toGamut(requested);
  return { name, color, hex: rgbToHex(rgb), clamped };
}

/**
 * Eight swatches: the base, two tints, two shades, two analogous hues, and
 * the complement. Tints and shades reduce chroma toward the extremes so the
 * scale stays restrained.
 */
export function buildPalette(base: Oklch): Swatch[] {
  const { l, c, h } = toGamut(base).color;
  const rot = (deg: number) => (((h + deg) % 360) + 360) % 360;
  return [
    swatch("base", { l, c, h }),
    swatch("tint-1", { l: Math.min(0.95, l + 0.14), c: c * 0.7, h }),
    swatch("tint-2", { l: Math.min(0.98, l + 0.26), c: c * 0.4, h }),
    swatch("shade-1", { l: Math.max(0.15, l - 0.14), c: c * 0.85, h }),
    swatch("shade-2", { l: Math.max(0.1, l - 0.26), c: c * 0.6, h }),
    swatch("analogous-1", { l, c: c * 0.9, h: rot(-30) }),
    swatch("analogous-2", { l, c: c * 0.9, h: rot(30) }),
    swatch("complement", { l, c: c * 0.8, h: rot(180) }),
  ];
}
