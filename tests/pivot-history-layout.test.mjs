import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("an undone future step cannot mark the current tableau", async () => {
  const source = await readFile(
    new URL("../app/pivotlab/App.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /pivotMark=\{index < currentIndex \? history\[index \+ 1\]\?\.pivot : undefined\}/,
  );
  assert.match(source, /showHeader=\{index === 0 \|\| !entry\.pivot\}/);
  assert.doesNotMatch(source, /className="tableau-step-header"/);
});

test("print pivot rings stay cell-sized and printed tableaux are contiguous", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  const printCss = css.slice(css.indexOf("@media print"));

  assert.match(
    printCss,
    /\.tableau-grid \.selected-pivot, \.tableau-grid \.historic-pivot \{ position: relative !important;/,
  );
  assert.match(
    printCss,
    /\.history-card \+ \.history-card, \.tableau-step \+ \.tableau-step \{ border-top: 2px solid #555; \}/,
  );
  assert.match(printCss, /\.history-card > header \{ display: none !important; \}/);
  assert.match(printCss, /\.history-view, \.history-list \{ display: block; gap: 0; \}/);
  assert.match(printCss, /@page \{ margin: 0; \}/);
});

test("tableau steps share font sizing and complete-history image exports are available", async () => {
  const [grid, css, modal, graphic] = await Promise.all([
    readFile(new URL("../app/pivotlab/components/TableauGrid.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/Modals.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/export/tableauGraphic.ts", import.meta.url), "utf8"),
  ]);

  assert.match(grid, /<colgroup>/);
  assert.match(grid, /\{showHeader && \(/);
  assert.match(css, /table-layout: fixed/);
  assert.match(css, /width: max\(100%, var\(--table-min-width\)\)/);
  assert.doesNotMatch(css, /\.compact-tableau \.tableau-grid \{ --table-font-size:/);
  assert.match(modal, /PNG · no background/);
  assert.match(modal, /exportImage\('svg'\)/);
  assert.match(modal, /createTableauHistoryGraphic\(history, currentIndex, display, \{ transparent, includeResult \}\)/);
  assert.doesNotMatch(modal, /equal column widths/);
  assert.match(graphic, /pivotMark: entries\[index \+ 1\]\?\.pivot/);
  assert.match(graphic, /const STEP_SEPARATOR = 4/);
  assert.match(graphic, /fill-opacity=\"1\"/);
  assert.doesNotMatch(graphic, /paint-order=\"stroke fill\"/);
  assert.doesNotMatch(graphic, /TRANSPARENT_HALO/);
  assert.match(graphic, /if \(!transparent\) parts\.push\(`<rect x=\"0\" y=\"\$\{objectiveY\}\"/);
  assert.match(graphic, /renderResultEquation/);
  assert.match(graphic, /options\.includeResult/);
  assert.match(graphic, /image\/svg\+xml/);
  assert.match(graphic, /canvas\.toBlob/);
});

test("renaming, centered selectors, true scaling, and optional results are wired", async () => {
  const [app, css, modal, settings, result, resultView, layout, inspector, grid] = await Promise.all([
    readFile(new URL("../app/pivotlab/App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/Modals.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/app/settings.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/model/result.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/SolutionResult.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/Inspector.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/TableauGrid.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(app, /save-dot/);
  assert.doesNotMatch(app, /className="mode-dot"/);
  assert.doesNotMatch(app, /className="statusbar"/);
  assert.doesNotMatch(app, /Original objective<\/span>/);
  assert.doesNotMatch(app, /Hover for RHS \/ aᵢⱼ/);
  assert.match(css, /justify-content: center; text-align: center/);
  assert.match(css, /body \{\s*zoom: var\(--ui-scale\);/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /\.tableau-grid \.row-actions-column, \.tableau-grid \.row-actions-cell \{[^}]*position: sticky;[^}]*right: 0;/s);
  assert.match(modal, /max="150"/);
  assert.match(modal, /Simplex Assistant 0\.4\.1/);
  assert.match(settings, /uiScale: clamp\([^\n]+, 85, 150\)/);
  assert.match(settings, /redo: 'Ctrl\+Y'/);
  assert.match(settings, /addConstraint: 'Ctrl\+Alt\+C'/);
  assert.match(settings, /addVariable: 'Ctrl\+Alt\+V'/);
  assert.match(modal, /Include final result/);
  assert.match(app, /includeResult=\{includePrintResult\}/);
  assert.match(result, /variable\.kind === 'regular'/);
  assert.match(result, /basicRow\?\.values\[rhsIndex\] \?\? Rational\.ZERO/);
  assert.match(result, /tableau\.objective\[rhsIndex\]\.neg\(\)/);
  assert.match(resultView, /className="solution-min-index"/);
  assert.doesNotMatch(resultView, /<sub>min<\/sub>/);
  assert.doesNotMatch(inspector, /All pivot decisions stay manual/);
  assert.doesNotMatch(inspector, /Return to Edit mode/);
  assert.match(grid, /row-actions-cell/);
  assert.match(layout, /title: "Simplex Assistant"/);
});
