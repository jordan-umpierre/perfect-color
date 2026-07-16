import "./style.css";
import {
  evaluateContrast,
  formatOklch,
  hexToRgb,
  hslToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToOklch,
  toGamut,
  type Oklch,
  type Rgb,
} from "./color.ts";
import { DEFICIENCIES, simulateDeficiency } from "./cvd.ts";
import { buildPalette, type Swatch } from "./palette.ts";
import { QUESTIONS, scoreQuiz } from "./quiz.ts";
import {
  STORAGE_KEY,
  decodeShareHash,
  encodeShareHash,
  parsePersisted,
  serializePersisted,
} from "./state.ts";
import { toCssVariables, toJsonTokens, toSvgSwatches } from "./exports.ts";

const DEFAULT_COLOR: Oklch = { l: 0.65, c: 0.12, h: 250 };

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

const inputs = {
  hex: el<HTMLInputElement>("in-hex"),
  r: el<HTMLInputElement>("in-r"),
  g: el<HTMLInputElement>("in-g"),
  b: el<HTMLInputElement>("in-b"),
  hslH: el<HTMLInputElement>("in-hsl-h"),
  hslS: el<HTMLInputElement>("in-hsl-s"),
  hslL: el<HTMLInputElement>("in-hsl-l"),
  okL: el<HTMLInputElement>("in-ok-l"),
  okC: el<HTMLInputElement>("in-ok-c"),
  okH: el<HTMLInputElement>("in-ok-h"),
  contrast: el<HTMLInputElement>("in-contrast"),
};

type Source = "hex" | "rgb" | "hsl" | "oklch" | "init";

let current: Oklch = DEFAULT_COLOR;
let currentRgb: Rgb = toGamut(DEFAULT_COLOR).rgb;
let quizAnswers: number[] | undefined;

function announce(message: string): void {
  el("status").textContent = message;
}

function setColor(requested: Oklch, source: Source): void {
  const result = toGamut(requested);
  current = result.color;
  currentRgb = result.rgb;

  el("preview").style.backgroundColor = rgbToHex(currentRgb);
  el("current-value").textContent =
    `${formatOklch(current)} · ${rgbToHex(currentRgb)}`;
  el("gamut-note").textContent = result.clamped
    ? `Requested color was outside the sRGB gamut; chroma was reduced to ${current.c.toFixed(4)}.`
    : "Within the sRGB gamut.";

  if (source !== "hex") {
    inputs.hex.value = rgbToHex(currentRgb);
    el("hex-error").hidden = true;
  }
  if (source !== "rgb") {
    inputs.r.value = String(Math.round(currentRgb.r * 255));
    inputs.g.value = String(Math.round(currentRgb.g * 255));
    inputs.b.value = String(Math.round(currentRgb.b * 255));
  }
  if (source !== "hsl") {
    const hsl = rgbToHsl(currentRgb);
    inputs.hslH.value = String(Math.round(hsl.h));
    inputs.hslS.value = String(Math.round(hsl.s));
    inputs.hslL.value = String(Math.round(hsl.l));
  }
  if (source !== "oklch") {
    inputs.okL.value = current.l.toFixed(4);
    inputs.okC.value = current.c.toFixed(4);
    inputs.okH.value = current.h.toFixed(2);
  }

  renderPalette();
  renderContrast();
  renderCvd();

  const share = new URL(location.href);
  share.hash = encodeShareHash(current);
  el<HTMLInputElement>("share-url").value = share.href;
  history.replaceState(null, "", share.hash);

  try {
    localStorage.setItem(
      STORAGE_KEY,
      serializePersisted(
        quizAnswers
          ? { version: 1, color: current, quizAnswers }
          : { version: 1, color: current },
      ),
    );
  } catch {
    // Storage unavailable (private mode/quota): the app still works, just without persistence.
  }
}

let palette: Swatch[] = [];

function renderPalette(): void {
  palette = buildPalette(current);
  const list = el("palette");
  list.textContent = "";
  for (const s of palette) {
    const li = document.createElement("li");
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.backgroundColor = s.hex;
    chip.setAttribute("aria-hidden", "true");
    const meta = document.createElement("p");
    meta.className = "meta";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = s.name;
    meta.append(name, s.hex);
    li.append(chip, meta);
    list.append(li);
  }
}

function renderContrast(): void {
  const custom = hexToRgb(inputs.contrast.value);
  el("contrast-error").hidden = custom !== null;
  const backgrounds: Array<[string, Rgb]> = [
    ["White #ffffff", { r: 1, g: 1, b: 1 }],
    ["Black #000000", { r: 0, g: 0, b: 0 }],
  ];
  if (custom) backgrounds.push([`Custom ${rgbToHex(custom)}`, custom]);
  const tbody = el("contrast-table").querySelector("tbody")!;
  tbody.textContent = "";
  for (const [label, bg] of backgrounds) {
    const v = evaluateContrast(currentRgb, bg);
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = label;
    tr.append(th);
    const ratio = document.createElement("td");
    ratio.textContent = `${v.ratio.toFixed(2)}:1`;
    tr.append(ratio);
    for (const pass of [v.aaNormal, v.aaLarge, v.aaaNormal, v.aaaLarge]) {
      const td = document.createElement("td");
      td.textContent = pass ? "Pass" : "Fail";
      td.className = pass ? "pass" : "fail";
      tr.append(td);
    }
    tbody.append(tr);
  }
}

function renderCvd(): void {
  const list = el("cvd-list");
  list.textContent = "";
  for (const kind of DEFICIENCIES) {
    const sim = simulateDeficiency(currentRgb, kind);
    const li = document.createElement("li");
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.backgroundColor = rgbToHex(sim);
    chip.setAttribute("aria-hidden", "true");
    const meta = document.createElement("p");
    meta.className = "meta";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = kind;
    meta.append(name, rgbToHex(sim));
    li.append(chip, meta);
    list.append(li);
  }
}

// --- Editor wiring ---

inputs.hex.addEventListener("input", () => {
  const rgb = hexToRgb(inputs.hex.value);
  el("hex-error").hidden = rgb !== null;
  if (rgb) setColor(rgbToOklch(rgb), "hex");
});

function numberValue(input: HTMLInputElement, max: number): number | null {
  const v = input.valueAsNumber;
  return Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : null;
}

for (const input of [inputs.r, inputs.g, inputs.b]) {
  input.addEventListener("input", () => {
    const r = numberValue(inputs.r, 255);
    const g = numberValue(inputs.g, 255);
    const b = numberValue(inputs.b, 255);
    if (r === null || g === null || b === null) return;
    setColor(rgbToOklch({ r: r / 255, g: g / 255, b: b / 255 }), "rgb");
  });
}

for (const input of [inputs.hslH, inputs.hslS, inputs.hslL]) {
  input.addEventListener("input", () => {
    const h = numberValue(inputs.hslH, 360);
    const s = numberValue(inputs.hslS, 100);
    const l = numberValue(inputs.hslL, 100);
    if (h === null || s === null || l === null) return;
    setColor(rgbToOklch(hslToRgb({ h, s, l })), "hsl");
  });
}

for (const input of [inputs.okL, inputs.okC, inputs.okH]) {
  input.addEventListener("input", () => {
    const l = numberValue(inputs.okL, 1);
    const c = numberValue(inputs.okC, 0.4);
    const h = numberValue(inputs.okH, 360);
    if (l === null || c === null || h === null) return;
    setColor({ l, c, h: h % 360 }, "oklch");
  });
}

inputs.contrast.addEventListener("input", renderContrast);

// --- Quiz ---

function renderQuiz(): void {
  const container = el("quiz-questions");
  QUESTIONS.forEach((question, qi) => {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = `${qi + 1}. ${question.prompt}`;
    fieldset.append(legend);
    const wrap = document.createElement("div");
    wrap.className = "quiz-options";
    question.options.forEach((option, oi) => {
      const label = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `q${qi}`;
      radio.value = String(oi);
      radio.required = true;
      const chip = document.createElement("span");
      chip.className = "swatch";
      chip.style.backgroundColor = rgbToHex(toGamut(option.color).rgb);
      chip.setAttribute("aria-hidden", "true");
      label.append(radio, chip, option.label);
      wrap.append(label);
    });
    fieldset.append(wrap);
    container.append(fieldset);
  });
}

let quizColor: Oklch | null = null;

el<HTMLFormElement>("quiz-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target as HTMLFormElement);
  const answers: number[] = [];
  for (let i = 0; i < QUESTIONS.length; i++) {
    const value = data.get(`q${i}`);
    if (value !== "0" && value !== "1") {
      el("quiz-error").hidden = false;
      return;
    }
    answers.push(Number(value));
  }
  el("quiz-error").hidden = true;
  const result = scoreQuiz(answers);
  quizAnswers = answers;
  quizColor = result.color;
  el("quiz-result-swatch").style.backgroundColor = rgbToHex(
    toGamut(result.color).rgb,
  );
  el("quiz-result-value").textContent =
    `${formatOklch(result.color)} · ${rgbToHex(toGamut(result.color).rgb)}`;
  const list = el("quiz-explanation");
  list.textContent = "";
  for (const line of result.explanation) {
    const li = document.createElement("li");
    li.textContent = line;
    list.append(li);
  }
  el("quiz-result").hidden = false;
  announce("Quiz result ready.");
  setColor(current, "init"); // persist answers alongside the current color
});

el("quiz-use").addEventListener("click", () => {
  if (quizColor) {
    setColor(quizColor, "init");
    announce("Workspace color updated from quiz result.");
    el("workspace").scrollIntoView();
    inputs.hex.focus();
  }
});

// --- Share and export ---

el("copy-share").addEventListener("click", async () => {
  const url = el<HTMLInputElement>("share-url").value;
  try {
    await navigator.clipboard.writeText(url);
    announce("Share link copied to clipboard.");
  } catch {
    el<HTMLInputElement>("share-url").select();
    announce("Copy failed — link selected, copy it manually.");
  }
});

function download(filename: string, type: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  announce(`Downloaded ${filename}.`);
}

el("export-css").addEventListener("click", () =>
  download("perfect-color.css", "text/css", toCssVariables(palette)),
);
el("export-json").addEventListener("click", () =>
  download(
    "perfect-color.tokens.json",
    "application/json",
    toJsonTokens(palette),
  ),
);
el("export-svg").addEventListener("click", () =>
  download("perfect-color.svg", "image/svg+xml", toSvgSwatches(palette)),
);

// --- Init: share hash wins, then saved state, then default ---

renderQuiz();

let initial = DEFAULT_COLOR;
const fromHash = decodeShareHash(location.hash);
let stored = null;
try {
  stored = parsePersisted(localStorage.getItem(STORAGE_KEY));
} catch {
  stored = null;
}
if (fromHash) {
  initial = fromHash;
  if (stored?.quizAnswers) quizAnswers = stored.quizAnswers;
} else if (stored) {
  initial = stored.color;
  if (stored.quizAnswers) quizAnswers = stored.quizAnswers;
}
setColor(initial, "init");
