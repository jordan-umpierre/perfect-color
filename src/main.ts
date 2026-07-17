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
import {
  currentDay,
  deriveGame,
  nearestContender,
  type GameView,
} from "./game.ts";
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

const DAY = currentDay();
const DAY_LABEL = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
}).format(new Date(DAY * 86_400_000));

let current: Oklch = DEFAULT_COLOR;
let currentRgb: Rgb = toGamut(DEFAULT_COLOR).rgb;
let gameAnswers: number[] = [];

function announce(message: string): void {
  el("status").textContent = message;
}

function persist(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      serializePersisted(
        gameAnswers.length > 0
          ? { version: 2, color: current, gameAnswers, gameDay: DAY }
          : { version: 2, color: current },
      ),
    );
  } catch {
    // Storage unavailable (private mode/quota): the app still works, just without persistence.
  }
}

// ---------- Views ----------

type View = "game" | "workspace";

function showView(view: View, moveFocus = true): void {
  const isGame = view === "game";
  el("game-view").hidden = !isGame;
  el("workspace-view").hidden = isGame;
  el("nav-game").toggleAttribute("aria-current", isGame);
  el("nav-game").setAttribute("aria-current", isGame ? "page" : "false");
  el("nav-workspace").setAttribute("aria-current", isGame ? "false" : "page");
  if (moveFocus) {
    const heading = isGame
      ? el("game-play").hidden
        ? el("result-heading")
        : el("game-heading")
      : el("workspace-heading");
    heading.focus();
  }
}

el("nav-game").addEventListener("click", () => showView("game"));
el("nav-workspace").addEventListener("click", () => showView("workspace"));

// ---------- Game ----------

const panels = {
  left: el<HTMLButtonElement>("pick-left"),
  right: el<HTMLButtonElement>("pick-right"),
};

function panelFill(button: HTMLButtonElement): HTMLElement {
  return button.querySelector<HTMLElement>(".panel-fill")!;
}

function matchLabel(round: NonNullable<GameView["round"]>): string {
  return `${round.stage} — match ${round.match} of ${round.matchCount}`;
}

function renderGame(): void {
  const view = deriveGame(DAY, gameAnswers);
  el("bracket-date").textContent = `${DAY_LABEL} bracket`;
  if (view.round) {
    el("game-play").hidden = false;
    el("game-result").hidden = true;
    el("round-label").textContent = matchLabel(view.round);
    el<HTMLProgressElement>("round-progress").value = view.roundsPlayed;
    panelFill(panels.left).style.backgroundColor = view.round.left.hex;
    panelFill(panels.right).style.backgroundColor = view.round.right.hex;
    el("left-name").textContent = view.round.left.name;
    el("right-name").textContent = view.round.right.name;
    panels.left.setAttribute("aria-label", view.round.left.name);
    panels.right.setAttribute("aria-label", view.round.right.name);
  } else if (view.result) {
    el("game-play").hidden = true;
    el("game-result").hidden = false;
    el("result-swatch").style.backgroundColor = view.result.champion.hex;
    el("result-name").textContent = view.result.champion.name;
    el("result-tagline").textContent = `“${view.result.champion.tagline}”`;
    el("result-value").textContent =
      `${formatOklch(view.result.champion.color)} · ${view.result.champion.hex}`;
    el("result-runnerup").textContent =
      `Beat ${view.result.runnerUp.name} in the final of the ${DAY_LABEL} bracket.`;
    const list = el("result-explanation");
    list.textContent = "";
    for (const line of view.result.path) {
      const li = document.createElement("li");
      li.textContent = line;
      list.append(li);
    }
  }
}

function pick(side: 0 | 1): void {
  const before = deriveGame(DAY, gameAnswers);
  if (!before.round) return;
  gameAnswers.push(side);
  const after = deriveGame(DAY, gameAnswers);
  renderGame();
  if (after.result) {
    setColor(after.result.champion.color, "init");
    announce(`${after.result.champion.name} takes the title!`);
    el("result-heading").focus();
  } else {
    persist();
    announce(`${matchLabel(after.round!)}.`);
  }
}

panels.left.addEventListener("click", () => pick(0));
panels.right.addEventListener("click", () => pick(1));

window.addEventListener("keydown", (event) => {
  if (el("game-view").hidden || el("game-play").hidden) return;
  const target = event.target as HTMLElement | null;
  if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    pick(0);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    pick(1);
  }
});

function restart(): void {
  gameAnswers = [];
  persist();
  renderGame();
  showView("game");
  announce("New tournament. Round of 16, match 1 of 8.");
}

async function copyResult(): Promise<void> {
  const view = deriveGame(DAY, gameAnswers);
  if (!view.result) return;
  const { champion, runnerUp } = view.result;
  const text = [
    `🏆 ${champion.name} — my champion in today's Perfect Color bracket (${DAY_LABEL})`,
    `“${champion.tagline}” It beat ${runnerUp.name} in the final.`,
    el<HTMLInputElement>("share-url").value,
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    announce("Result copied to clipboard.");
  } catch {
    announce("Copy failed — the share link is available in the workspace.");
  }
}

el("restart").addEventListener("click", restart);
el("result-replay").addEventListener("click", restart);
el("result-workspace").addEventListener("click", () => showView("workspace"));
el("result-share").addEventListener("click", copyResult);

// ---------- Workspace ----------

function setColor(requested: Oklch, source: Source): void {
  const result = toGamut(requested);
  current = result.color;
  currentRgb = result.rgb;

  el("preview").style.backgroundColor = rgbToHex(currentRgb);
  el("closest-name").textContent =
    `Closest name: ${nearestContender(current).name}`;
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

  persist();
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

// --- Share and export ---

async function copyShareLink(): Promise<void> {
  const url = el<HTMLInputElement>("share-url").value;
  try {
    await navigator.clipboard.writeText(url);
    announce("Share link copied to clipboard.");
  } catch {
    el<HTMLInputElement>("share-url").select();
    announce("Copy failed — link selected, copy it manually.");
  }
}

el("copy-share").addEventListener("click", copyShareLink);

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

// --- Init: share hash opens the workspace; otherwise resume the game ---

let stored = null;
try {
  stored = parsePersisted(localStorage.getItem(STORAGE_KEY));
} catch {
  stored = null;
}
// Picks only carry over within the same daily bracket.
if (stored?.gameAnswers && stored.gameDay === DAY) {
  gameAnswers = stored.gameAnswers;
}

const fromHash = decodeShareHash(location.hash);
if (fromHash) {
  // Consume the share link so a later reload resumes normally.
  history.replaceState(null, "", location.pathname + location.search);
}
setColor(fromHash ?? stored?.color ?? DEFAULT_COLOR, "init");
renderGame();
showView(fromHash ? "workspace" : "game", false);
