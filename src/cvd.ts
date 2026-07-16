/**
 * Color-vision deficiency simulation using the Machado, Oliveira & Fernandes
 * (2009) severity-1.0 matrices, applied in linear sRGB. This approximates how
 * a color may appear with each deficiency; it is a design aid, not a medical
 * diagnosis.
 */

import { srgbToLinear, linearToSrgb, type Rgb } from "./color.ts";

export type Deficiency = "protanopia" | "deuteranopia" | "tritanopia";

const MATRICES: Record<Deficiency, readonly number[]> = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882,
    -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182,
    0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733,
    0.691367, 0.3039,
  ],
};

export const DEFICIENCIES: readonly Deficiency[] = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
];

export function simulateDeficiency(rgb: Rgb, kind: Deficiency): Rgb {
  const m = MATRICES[kind];
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    r: linearToSrgb(clamp(m[0]! * r + m[1]! * g + m[2]! * b)),
    g: linearToSrgb(clamp(m[3]! * r + m[4]! * g + m[5]! * b)),
    b: linearToSrgb(clamp(m[6]! * r + m[7]! * g + m[8]! * b)),
  };
}
