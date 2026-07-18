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
  assert.match(printCss, /\.history-card \+ \.history-card, \.tableau-step \+ \.tableau-step \{ border-top: 0; \}/);
  assert.match(printCss, /\.history-card \.tableau-scroll \{ border: 1px solid #777; border-top: 0; \}/);
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
  assert.match(css, /min-width: var\(--table-min-width\)/);
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
  assert.match(modal, /Simplex Assistant 0\.6\.0/);
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
  assert.match(layout, /title: "Simplex Assistant \| LPAssistant"/);
});

test("menus, initial-tableau editing, print restoration, and unified scrolling are wired", async () => {
  const [app, settings, modal, inspector, css, readme] = await Promise.all([
    readFile(new URL("../app/pivotlab/App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/app/settings.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/Modals.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/Inspector.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../README-PIVOTLAB.md", import.meta.url), "utf8"),
  ]);

  assert.match(settings, /openSettings: 'Open \/ close settings'/);
  assert.match(settings, /toggleExport: 'Open \/ close export'/);
  assert.match(settings, /toggleExport: 'Ctrl\+Shift\+E'/);
  assert.match(app, /modal === 'settings' && action === 'openSettings'/);
  assert.match(app, /modal === 'export' && action === 'toggleExport'/);
  assert.match(modal, /event\.key !== 'Escape'/);
  assert.match(app, /const canEdit = currentIndex === 0/);
  assert.match(app, /disabled=\{!canEdit\}/);
  assert.match(app, /onChange=\{isCurrent && index === 0 \? replaceCurrent : undefined\}/);
  assert.match(app, /setView\(returnView\)/);
  assert.doesNotMatch(inspector, />Edit mode</);
  assert.match(css, /\.tableau-sequence \{[^}]*overflow: auto;/s);
  assert.match(css, /\.tableau-sequence \.tableau-scroll \{[^}]*overflow: visible;/s);
  assert.match(css, /\.tableau-grid thead th \{[^}]*font-size: var\(--table-font-size\);/s);
  assert.match(css, /\.row-actions-column::after, \.tableau-grid \.row-actions-cell::after/);
  assert.match(readme, /a<sub>i,j<\/sub>/);
  assert.doesNotMatch(readme, /p = a_|aᵣₛ|a_\{r,s\}/);
});

test("0.6.0 typography, hover continuity, exports, and LPAssistant identity are wired", async () => {
  const [app, page, numberValue, grid, inspector, modal, graphic, css, readme, manifest, serviceWorker, pkg] = await Promise.all([
    readFile(new URL("../app/pivotlab/App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/NumberValue.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/TableauGrid.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/Inspector.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/components/Modals.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/pivotlab/export/tableauGraphic.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../README-PIVOTLAB.md", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(numberValue, /className="fraction-sign" aria-hidden="true"/);
  assert.match(css, /\.fraction-stack \{[^}]*grid-template-rows: 1em 1\.3px 1em;/s);
  assert.match(css, /\.fraction-stack::after/);
  assert.match(css, /\.pivot-summary-grid > div > span:first-child/);
  assert.match(css, /\.tableau-sequence \{[^}]*align-content: start;/s);
  assert.match(css, /\.tableau-step:last-child \{ border-bottom: 1px solid var\(--line\); \}/);
  assert.match(css, /\.history-list::before \{ content: none; \}/);
  assert.match(css, /\.history-card \{[^}]*margin-left: 0;/s);
  assert.match(css, /\.history-card \.tableau-scroll \{ border: 1px solid #777; border-top: 0; \}/);
  assert.match(css, /\.history-card:first-child \.tableau-scroll \{ border-top: 1px solid #777; \}/);
  assert.match(graphic, /height="\$\{RESULT_HEIGHT - 2\}" fill="none" stroke="\$\{GRID\}" stroke-width="2"/);
  assert.match(graphic, /negative \? `<line x1=/);
  assert.match(grid, /onMouseLeave=\{\(\) => \{\s*setHovered\(null\);\s*onHoverPivot\?\.\(null\);/s);
  assert.match(app, /const \[includeExportResult, setIncludeExportResult\] = useState\(true\)/);
  assert.match(app, /includeResult=\{includeExportResult\}/);
  assert.match(app, /data-tooltip="Edit is unavailable after a pivot\./);
  assert.match(modal, /Complete solution PDF/);
  assert.match(modal, /browser’s print dialog/);
  assert.doesNotMatch(modal, /Windows print dialog|For notes and problem sets|Appearance and controls/);
  assert.match(inspector, /a<sub>i,j<\/sub>/);
  assert.match(readme, /first—and currently only—application/);
  assert.match(readme, /v1 hosting target is a static GitHub Pages deployment/);
  assert.doesNotMatch(readme, /Windows 11|p =|a_\{|aᵢⱼ/);
  assert.match(manifest, /LPAssistant — Simplex Assistant/);
  assert.match(page, /new URL\('sw\.js', window\.location\.href\)/);
  assert.match(serviceWorker, /self\.registration\.scope/);
  assert.match(pkg, /"version": "0\.6\.0"/);
});
