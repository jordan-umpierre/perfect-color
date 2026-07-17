# Perfect Color

A client-only color game and engineering workspace. You open the app and
start playing immediately: a **daily tournament bracket** of sixteen named
colors, drawn each UTC day from a pool of 48 (Cherry Bomb, Verdigris,
Grape Soda, Midnight Oil…). Everyone in the world gets the same bracket on
the same day — no server required. Pick your favorite in every matchup —
Round of 16, Quarterfinals, Semifinals, Final — and the last color standing
is **your champion**, with a name, a tagline, a runner-up, and a copyable
share-ready result. The champion flows into a professional workspace: synchronized RGB / hex / HSL /
OKLCH editing, restrained palette generation, WCAG 2.2 contrast checks,
color-vision-deficiency previews, shareable URLs, and design-token exports.

**Live:** https://jordan-umpierre.github.io/perfect-color/

Everything runs in the browser. No accounts, no backend, no analytics, no
uploads.

## What it demonstrates

- **Perceptual color math from scratch.** All conversions (sRGB ↔ linear ↔
  OKLab ↔ OKLCH, HSL, hex) are hand-written TypeScript verified against
  CSS Color 4 / Ottosson reference vectors. No color library.
- **A tournament as a pure function.** The whole bracket derives from
  (UTC day, pick sequence): a seeded PRNG draws the day's 16 contenders, so
  the game is deterministic (same day and picks always crown the same
  champion), globally shared without a backend, resumable after a reload,
  and the result lists the champion's full road to the title.
- **One canonical value.** State is a single OKLCH color; every other
  representation is derived from it. Out-of-gamut requests are mapped back
  into sRGB by chroma reduction and the clamp is reported to the user.
- **Accessibility as a feature.** Semantic HTML and native controls, full
  keyboard play (arrow keys), visible focus, text alternatives for every
  color cue, forced-colors and reduced-motion support, and an axe-core
  WCAG 2.2 AA gate over both views in CI.

## Architecture

Pure modules, DOM wiring kept separate:

| Module           | Responsibility                                                     |
| ---------------- | ------------------------------------------------------------------ |
| `src/color.ts`   | OKLCH/OKLab/sRGB/HSL/hex conversions, gamut mapping, WCAG contrast |
| `src/game.ts`    | Daily 16-color bracket drawn from a 48-color named pool            |
| `src/palette.ts` | Restrained palette derivation from the canonical OKLCH value       |
| `src/cvd.ts`     | Color-vision simulation (Machado et al. 2009 matrices)             |
| `src/state.ts`   | Versioned localStorage record and bounded share-URL codec          |
| `src/exports.ts` | CSS custom properties, JSON design tokens, escaped SVG swatches    |
| `src/main.ts`    | The only file that touches the DOM                                 |

No UI framework and no runtime dependencies; Vite is used only as build
tooling.

## Develop and verify

Requires Node 22+.

```sh
npm ci
npm run dev         # local dev server
npm test            # unit tests (node:test): reference vectors, round trips,
                    # gamut, contrast, game determinism, state parsing, exports
npm run typecheck   # strict TypeScript
npm run e2e         # Playwright critical paths + axe-core WCAG 2.2 AA scans
npm run build       # static production build in dist/
```

## Security and privacy

- All data stays in the browser: one versioned `localStorage` record and an
  optional URL hash containing only the color value.
- Everything parsed at a trust boundary (stored state, share hash, hex input)
  is validated for shape, range, and size; malformed input falls back to
  defaults instead of being partially trusted.
- SVG/CSS/JSON exports escape all interpolated text.
- No third-party runtime code, no network requests, no cookies.

To report a security issue, use GitHub's private vulnerability reporting on
this repository.

## Limitations

- "Your champion color" is playful framing: the game is a transparent
  tournament over your picks, not a scientific or personality claim, and it
  says so in the UI. Color taglines describe the color, not you.
- The bracket rotates at UTC midnight; an in-progress game from a previous
  day resets rather than mixing two brackets.
- Color-vision previews are approximate simulations (Machado et al. 2009),
  not medical diagnoses.
- Gamut mapping targets sRGB only; wide-gamut (P3) output is out of scope.

## License

[MIT](LICENSE)
