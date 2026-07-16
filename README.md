# Perfect Color

A client-only color tool: a transparent visual preference quiz that suggests a
starting color, and a professional workspace for engineering it — synchronized
RGB / hex / HSL / OKLCH editing, restrained palette generation, WCAG 2.2
contrast checks, color-vision-deficiency previews, shareable URLs, and
design-token exports.

**Live:** https://jordan-umpierre.github.io/perfect-color/

Everything runs in the browser. No accounts, no backend, no analytics, no
uploads.

## What it demonstrates

- **Perceptual color math from scratch.** All conversions (sRGB ↔ linear ↔
  OKLab ↔ OKLCH, HSL, hex) are hand-written TypeScript verified against
  CSS Color 4 / Ottosson reference vectors. No color library.
- **One canonical value.** State is a single OKLCH color; every other
  representation is derived from it. Out-of-gamut requests are mapped back
  into sRGB by chroma reduction and the clamp is reported to the user.
- **Honest, explainable scoring.** The quiz is labeled subjective, is
  deterministic (same answers → same color), and lists exactly how each
  answer moved the result.
- **Accessibility as a feature.** Semantic HTML and native controls, full
  keyboard operation, visible focus, text alternatives for every color cue,
  forced-colors and reduced-motion support, and an axe-core WCAG 2.2 AA gate
  in CI.

## Architecture

Pure modules, DOM wiring kept separate:

| Module           | Responsibility                                                     |
| ---------------- | ------------------------------------------------------------------ |
| `src/color.ts`   | OKLCH/OKLab/sRGB/HSL/hex conversions, gamut mapping, WCAG contrast |
| `src/palette.ts` | Restrained palette derivation from the canonical OKLCH value       |
| `src/cvd.ts`     | Color-vision simulation (Machado et al. 2009 matrices)             |
| `src/quiz.ts`    | Fixed question set and deterministic, explainable scoring          |
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
                    # gamut, contrast, quiz determinism, state parsing, exports
npm run typecheck   # strict TypeScript
npm run e2e         # Playwright critical paths + axe-core WCAG 2.2 AA scan
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

- The quiz is a transparent aggregation of visual choices — it makes no
  scientific or personality claims.
- Color-vision previews are approximate simulations (Machado et al. 2009),
  not medical diagnoses.
- Gamut mapping targets sRGB only; wide-gamut (P3) output is out of scope.

## License

[MIT](LICENSE)
