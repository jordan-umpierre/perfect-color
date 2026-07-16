/**
 * Preference quiz. Deliberately transparent and subjective: fixed questions,
 * deterministic scoring, and a per-answer explanation of how the result was
 * reached. No personality claims — it only aggregates the visual choices made.
 */

import { toGamut, type Oklch } from "./color.ts";

export interface QuizOption {
  label: string;
  /** Swatch shown for this option. */
  color: Oklch;
  /** Hue pole this choice pulls toward, as a unit vector on the hue circle. */
  hue?: number;
  dChroma: number;
  dLightness: number;
  explain: string;
}

export interface QuizQuestion {
  prompt: string;
  options: readonly [QuizOption, QuizOption];
}

export const QUESTIONS: readonly QuizQuestion[] = [
  {
    prompt: "Which feels more like you?",
    options: [
      {
        label: "Sunset warmth",
        color: { l: 0.72, c: 0.15, h: 45 },
        hue: 45,
        dChroma: 0,
        dLightness: 0,
        explain: "pulled the hue toward warm amber (45°)",
      },
      {
        label: "Ocean cool",
        color: { l: 0.62, c: 0.12, h: 235 },
        hue: 235,
        dChroma: 0,
        dLightness: 0,
        explain: "pulled the hue toward cool blue (235°)",
      },
    ],
  },
  {
    prompt: "Which intensity do you prefer?",
    options: [
      {
        label: "Vivid",
        color: { l: 0.65, c: 0.22, h: 150 },
        dChroma: 0.05,
        dLightness: 0,
        explain: "raised chroma by 0.05",
      },
      {
        label: "Muted",
        color: { l: 0.65, c: 0.05, h: 150 },
        dChroma: -0.05,
        dLightness: 0,
        explain: "lowered chroma by 0.05",
      },
    ],
  },
  {
    prompt: "Which mood do you gravitate toward?",
    options: [
      {
        label: "Airy and light",
        color: { l: 0.88, c: 0.06, h: 250 },
        dChroma: 0,
        dLightness: 0.12,
        explain: "raised lightness by 0.12",
      },
      {
        label: "Deep and dark",
        color: { l: 0.35, c: 0.08, h: 250 },
        dChroma: 0,
        dLightness: -0.12,
        explain: "lowered lightness by 0.12",
      },
    ],
  },
  {
    prompt: "Pick a landscape.",
    options: [
      {
        label: "Forest canopy",
        color: { l: 0.55, c: 0.12, h: 145 },
        hue: 145,
        dChroma: 0,
        dLightness: 0,
        explain: "pulled the hue toward green (145°)",
      },
      {
        label: "Berry orchard",
        color: { l: 0.55, c: 0.14, h: 340 },
        hue: 340,
        dChroma: 0,
        dLightness: 0,
        explain: "pulled the hue toward berry pink (340°)",
      },
    ],
  },
  {
    prompt: "Pick a time of day.",
    options: [
      {
        label: "Citrus morning",
        color: { l: 0.8, c: 0.16, h: 95 },
        hue: 95,
        dChroma: 0.02,
        dLightness: 0,
        explain: "pulled the hue toward citrus (95°) and nudged chroma up",
      },
      {
        label: "Twilight",
        color: { l: 0.45, c: 0.14, h: 275 },
        hue: 275,
        dChroma: 0.02,
        dLightness: 0,
        explain: "pulled the hue toward violet (275°) and nudged chroma up",
      },
    ],
  },
  {
    prompt: "Which finish appeals more?",
    options: [
      {
        label: "Soft pastel",
        color: { l: 0.85, c: 0.07, h: 20 },
        dChroma: -0.03,
        dLightness: 0.06,
        explain: "softened chroma and raised lightness",
      },
      {
        label: "Bold enamel",
        color: { l: 0.5, c: 0.2, h: 20 },
        dChroma: 0.03,
        dLightness: -0.06,
        explain: "boosted chroma and lowered lightness",
      },
    ],
  },
];

const BASE: Oklch = { l: 0.65, c: 0.12, h: 250 };
const DEG = Math.PI / 180;

export interface QuizResult {
  color: Oklch;
  /** One entry per answered question, in order. */
  explanation: string[];
}

/**
 * Deterministic scoring: answers index into QUESTIONS options (0 or 1).
 * Hue is the circular mean of the chosen hue poles; chroma and lightness are
 * the base values plus the chosen deltas, clamped to a restrained range and
 * then gamut-mapped.
 */
export function scoreQuiz(answers: readonly number[]): QuizResult {
  let x = 0;
  let y = 0;
  let c = BASE.c;
  let l = BASE.l;
  const explanation: string[] = [];
  answers.forEach((answer, i) => {
    const question = QUESTIONS[i];
    if (!question) return;
    const option = question.options[answer === 1 ? 1 : 0];
    if (option.hue !== undefined) {
      x += Math.cos(option.hue * DEG);
      y += Math.sin(option.hue * DEG);
    }
    c += option.dChroma;
    l += option.dLightness;
    explanation.push(`“${option.label}” ${option.explain}.`);
  });
  let h = BASE.h;
  if (Math.hypot(x, y) > 1e-6) {
    h = Math.atan2(y, x) / DEG;
    if (h < 0) h += 360;
  }
  l = Math.min(0.9, Math.max(0.25, l));
  c = Math.min(0.28, Math.max(0.03, c));
  return { color: toGamut({ l, c, h }).color, explanation };
}
