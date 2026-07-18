# LPAssistant

LPAssistant is an open-ended project for interactive linear-programming learning tools. Its first application is **Simplex Assistant**, a modern manual simplex-tableau trainer inspired by the LPAssistant app that accompanied Paul R. Thie and G. E. Keough's *An Introduction to Linear Programming and Game Theory*.

**Live application:** [Simplex Assistant](https://pivotlab-simplex.valbor2002.chatgpt.site)

## Simplex Assistant 0.5.0

Simplex Assistant is deliberately not an automatic solver. The user is able to choose any nonzero pivot; the application performs exactly one pivot transformation and records the resulting tableau.

### Features

- arbitrary numbers of constraint rows and variable columns;
- direct editing of the initial tableau's coefficients, RHS values, variable names, variable types, and basis;
- exact arbitrary-precision rational arithmetic;
- integer, decimal, scientific-notation, and rational-fraction input;
- exact fraction or configurable decimal display;
- primal `RHS / aᵢⱼ` and dual `cⱼ / aᵢⱼ` pivot hints on hover;
- Phase I with artificial variables and a canonical `−w` objective row;
- automatic restoration and canonicalization of the original objective after Phase I;
- complete tableau history with marked pivots, unified scrolling, undo, and redo;
- project save/open and local autosave;
- LaTeX, Markdown, CSV, PDF, PNG, transparent PNG, and SVG export;
- remappable keyboard shortcuts, responsive scaling, and light/dark themes;
- installable, offline-ready PWA behavior.

## Mathematical convention

The constraint rows and the objective row are treated uniformly as tableau equations. At a chosen nonzero entry in row `r` and column `s`, denoted `p = a_{r,s}`, Simplex Assistant divides row `r` by `p`, eliminates column `s` from every other constraint row and from the objective row, and assigns the entering variable to row `r`'s basis position.

All stored numbers are reduced pairs of arbitrary-precision integers. Decimal formatting never changes the stored value.

## Development

Prerequisite: Node.js `>=22.13.0`.

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run lint
npm test
npm run build
```

The current production application uses React, TypeScript, Vinext, and Cloudflare-based hosting. Windows 11 is the primary target, while the web/PWA architecture remains cross-platform and suitable for a future static GitHub Pages deployment.
