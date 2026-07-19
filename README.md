# LPAssistant

LPAssistant is an open-ended umbrella project for interactive linear-programming learning tools. It is designed to contain multiple focused applications. Its first and currently only application is **Simplex Assistant**, a modern manual simplex-tableau trainer inspired by the LPAssistant app that accompanied Paul R. Thie and G. E. Keough's *An Introduction to Linear Programming and Game Theory*.

**Live application:** [Simplex Assistant](https://pivotlab-simplex.valbor2002.chatgpt.site)

## Simplex Assistant 0.7.1

Simplex Assistant is deliberately not an automatic solver. The user is able to choose any nonzero pivot; the application performs exactly one pivot transformation and records the resulting tableau.

### Features

- arbitrary numbers of constraint rows and variable columns;
- direct editing of the initial tableau's coefficients, RHS values, variable names, variable types, and basis, with spreadsheet-style arrow-key navigation;
- exact arbitrary-precision rational arithmetic;
- integer, decimal, scientific-notation, and rational-fraction input;
- exact fraction or configurable decimal display;
- optional primal RHS / a<sub>i,j</sub> and dual c<sub>j</sub> / a<sub>i,j</sub> pivot guidance, disabled by default;
- Phase I with clearly named auxiliary variables and a canonical `−w` objective row;
- automatic restoration and canonicalization of the original objective after Phase I;
- a continuous Simplex Method Tableau with fixed-size steps, tableau-only scrolling, a persistent Pivot Inspector, marked pivots, undo, and redo;
- project save/open and local autosave;
- LaTeX, Markdown, CSV, PDF, PNG, transparent PNG, and SVG export;
- remappable keyboard shortcuts, responsive scaling, and light/dark themes;
- installable, offline-ready PWA behavior.

## Mathematical convention

The constraint rows and the objective row are treated uniformly as tableau equations. At a chosen nonzero entry a<sub>i,j</sub> in row i and column j, Simplex Assistant divides row i by a<sub>i,j</sub>, eliminates column j from every other constraint row and from the objective row, and assigns the entering variable to row i's basis position.

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

The application is a cross-platform web/PWA built with React and TypeScript. Production currently runs on OpenAI Sites; the v1 hosting target is a static GitHub Pages deployment at the LPAssistant repository path.
