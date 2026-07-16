/**
 * Pure color math. Canonical representation is OKLCH; every other
 * representation (sRGB, hex, HSL) is derived from it.
 *
 * OKLab/OKLCH conversion constants are from Björn Ottosson's reference
 * implementation (https://bottosson.github.io/posts/oklab/).
 */

export interface Oklch {
  /** Perceptual lightness, 0..1 */
  l: number;
  /** Chroma, 0..~0.37 for sRGB colors */
  c: number;
  /** Hue angle in degrees, 0..360 */
  h: number;
}

export interface Rgb {
  /** 0..1 gamma-encoded sRGB components */
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  /** Hue in degrees 0..360, saturation and lightness 0..100 */
  h: number;
  s: number;
  l: number;
}

const DEG = Math.PI / 180;

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

interface Lab {
  l: number;
  a: number;
  b: number;
}

function linearRgbToOklab(r: number, g: number, b: number): Lab {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

function oklabToLinearRgb(lab: Lab): { r: number; g: number; b: number } {
  const l_ = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const lab = linearRgbToOklab(
    srgbToLinear(rgb.r),
    srgbToLinear(rgb.g),
    srgbToLinear(rgb.b),
  );
  const c = Math.hypot(lab.a, lab.b);
  let h = Math.atan2(lab.b, lab.a) / DEG;
  if (h < 0) h += 360;
  // Hue is meaningless at zero chroma; normalize for stable round trips.
  if (c < 1e-7) h = 0;
  return { l: lab.l, c, h };
}

/** Converts OKLCH to sRGB without gamut mapping; components may leave 0..1. */
export function oklchToRgbUnclamped(color: Oklch): Rgb {
  const lin = oklabToLinearRgb({
    l: color.l,
    a: color.c * Math.cos(color.h * DEG),
    b: color.c * Math.sin(color.h * DEG),
  });
  return {
    r: linearToSrgb(lin.r),
    g: linearToSrgb(lin.g),
    b: linearToSrgb(lin.b),
  };
}

function inGamut(rgb: Rgb, eps = 1e-6): boolean {
  return (
    rgb.r >= -eps &&
    rgb.r <= 1 + eps &&
    rgb.g >= -eps &&
    rgb.g <= 1 + eps &&
    rgb.b >= -eps &&
    rgb.b <= 1 + eps
  );
}

export interface GamutResult {
  rgb: Rgb;
  /** The OKLCH actually rendered (chroma may be reduced). */
  color: Oklch;
  /** True when the requested color was outside sRGB and chroma was reduced. */
  clamped: boolean;
}

/**
 * Maps an OKLCH color into the sRGB gamut by reducing chroma at constant
 * lightness and hue (binary search), then hard-clamping residual error.
 */
export function toGamut(color: Oklch): GamutResult {
  const l = Math.min(1, Math.max(0, color.l));
  const h = ((color.h % 360) + 360) % 360;
  const c = Math.max(0, color.c);
  const requested: Oklch = { l, c, h };
  let rgb = oklchToRgbUnclamped(requested);
  if (inGamut(rgb) && l === color.l && c === color.c) {
    return { rgb: clamp01(rgb), color: requested, clamped: false };
  }
  let lo = 0;
  let hi = c;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgbUnclamped({ l, c: mid, h }))) lo = mid;
    else hi = mid;
  }
  const mapped: Oklch = { l, c: lo, h };
  rgb = clamp01(oklchToRgbUnclamped(mapped));
  return { rgb, color: mapped, clamped: true };
}

function clamp01(rgb: Rgb): Rgb {
  const f = (v: number) => Math.min(1, Math.max(0, v));
  return { r: f(rgb.r), g: f(rgb.g), b: f(rgb.b) };
}

export function rgbToHex(rgb: Rgb): string {
  const f = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${f(rgb.r)}${f(rgb.g)}${f(rgb.b)}`;
}

/** Parses #rgb or #rrggbb (leading # optional). Returns null when invalid. */
export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || m[1] === undefined) return null;
  let digits = m[1];
  if (digits.length === 3) {
    digits = digits
      .split("")
      .map((d) => d + d)
      .join("");
  }
  return {
    r: parseInt(digits.slice(0, 2), 16) / 255,
    g: parseInt(digits.slice(2, 4), 16) / 255,
    b: parseInt(digits.slice(4, 6), 16) / 255,
  };
}

export function rgbToHsl(rgb: Rgb): Hsl {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 1e-9) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rgb.r) h = ((rgb.g - rgb.b) / d) % 6;
    else if (max === rgb.g) h = (rgb.b - rgb.r) / d + 2;
    else h = (rgb.r - rgb.g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(hsl: Hsl): Rgb {
  const h = (((hsl.h % 360) + 360) % 360) / 60;
  const s = Math.min(100, Math.max(0, hsl.s)) / 100;
  const l = Math.min(100, Math.max(0, hsl.l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 1) [r, g, b] = [c, x, 0];
  else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: r + m, g: g + m, b: b + m };
}

/** WCAG 2.x relative luminance of a gamma-encoded sRGB color. */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * srgbToLinear(rgb.r) +
    0.7152 * srgbToLinear(rgb.g) +
    0.0722 * srgbToLinear(rgb.b)
  );
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastVerdict {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

export function evaluateContrast(a: Rgb, b: Rgb): ContrastVerdict {
  const ratio = contrastRatio(a, b);
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}

export function formatOklch(color: Oklch, digits = 4): string {
  return `oklch(${color.l.toFixed(digits)} ${color.c.toFixed(digits)} ${color.h.toFixed(2)})`;
}
