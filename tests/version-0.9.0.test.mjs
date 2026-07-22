import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the display selector is one native text run at extreme Firefox zoom', async () => {
  const [app, css] = await Promise.all([
    source('../app/pivotlab/App.tsx'),
    source('../app/globals.css'),
  ]);
  assert.match(app, /className="display-fraction-sample"[^>]*>1\/2<\/span>/);
  assert.doesNotMatch(app, /display-fraction-slash|<span>1<\/span>|<span>2<\/span>/);
  assert.match(css, /\.display-fraction-sample \{[^}]*display: inline;[^}]*white-space: nowrap;/s);
  assert.doesNotMatch(css, /\.display-fraction-sample \{[^}]*inline-flex/s);
  assert.doesNotMatch(css, /\.display-fraction-slash/);
});

test('print releases the viewport clip and paginates large tableaux by row', async () => {
  const css = await source('../app/globals.css');
  const printCss = css.slice(css.indexOf('@media print'));
  assert.match(printCss, /\.app-shell\.workspace-open \{ height: auto !important; overflow: visible !important; \}/);
  assert.match(printCss, /\.tableau-step, \.history-card \{ break-inside: auto; \}/);
  assert.match(printCss, /\.tableau-grid tr \{ break-inside: avoid; page-break-inside: avoid; \}/);
  assert.doesNotMatch(printCss, /\.tableau-step, \.history-card \{ break-inside: avoid; \}/);
});

test('active and completed values use the same full-cell vertical anchor', async () => {
  const [grid, css] = await Promise.all([
    source('../app/pivotlab/components/TableauGrid.tsx'),
    source('../app/globals.css'),
  ]);
  assert.match(css, /\.tableau-grid th, \.tableau-grid td \{[^}]*vertical-align: middle;/s);
  assert.match(css, /\.tableau-number-slot \{[^}]*position: absolute;[^}]*place-items: center;/s);
  assert.match(grid, /compact \? \([\s\S]*className="tableau-number-slot"/);
});

test('problem names remain editable without invalidating pivot history', async () => {
  const app = await source('../app/pivotlab/App.tsx');
  assert.match(app, /const renameProblem = \(title: string\) => \{/);
  assert.match(app, /setHistory\(\(previous\) => previous\.map/);
  assert.match(app, /aria-label="Problem name"/);
  assert.match(app, /onChange=\{\(event\) => renameProblem\(event\.target\.value\)\}/);
  assert.doesNotMatch(app, /aria-label="Tableau title"/);
});

test('the new-tableau dialog presents blank creation before examples', async () => {
  const modal = await source('../app/pivotlab/components/Modals.tsx');
  const blank = modal.indexOf('Create a blank tableau');
  const example = modal.indexOf('className="example-library"');
  assert.ok(blank >= 0 && example > blank);
  assert.match(modal, /or load an example/);
});

test('all download and PDF paths share export-setting filenames', async () => {
  const [app, modal] = await Promise.all([
    source('../app/pivotlab/App.tsx'),
    source('../app/pivotlab/components/Modals.tsx'),
  ]);
  assert.match(modal, /const fileStem = exportFileStem\(tableau\.title, exportOptions\)/);
  assert.match(modal, /`\$\{fileStem\}\.\$\{extension\}`/);
  assert.match(modal, /`\$\{fileStem\}\.svg`/);
  assert.match(modal, /`\$\{fileStem\}\$\{transparent \? '-no-background' : ''\}\.png`/);
  assert.match(modal, /`\$\{fileStem\}\.simplex-assistant\.json`/);
  assert.match(app, /document\.title = fileStem/);
  assert.match(app, /document\.title = applicationTitle/);
});

test('the tableau block does not repeat the problem name', async () => {
  const app = await source('../app/pivotlab/App.tsx');
  const header = app.slice(app.indexOf('<header className="tableau-card-header">'), app.indexOf('<div className="tableau-sequence">'));
  assert.match(header, /<h1>Simplex Method Tableau<\/h1>/);
  assert.doesNotMatch(header, /current\.title/);
});

test('dark mode restores green as a restrained interactive accent', async () => {
  const css = await source('../app/globals.css');
  const dark = css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(dark, /--brand: #3fb950;/);
  assert.match(dark, /--brand-hover: #56d364;/);
  assert.match(dark, /--bg: #111111;/);
  assert.match(dark, /--surface: #181818;/);
  assert.match(css, /\.brand-mark \{[^}]*background: var\(--brand\);/s);
});

test('original variables are green and slack variables are gray', async () => {
  const css = await source('../app/globals.css');
  assert.match(css, /--variable-original: #4a9a7c;/);
  assert.match(css, /--variable-slack: #8d9892;/);
  assert.match(css, /\.variable-regular \.variable-kind-marker \{ background: var\(--variable-original\); \}/);
  assert.match(css, /\.variable-kind-marker \{[^}]*background: var\(--variable-slack\);/s);
  assert.doesNotMatch(css, /\.variable-slack \.variable-kind-marker \{ background: var\(--variable-original\);/);
});

test('the variable type selector calls user variables original', async () => {
  const grid = await source('../app/pivotlab/components/TableauGrid.tsx');
  assert.match(grid, /<option value="regular">Original<\/option>/);
  assert.doesNotMatch(grid, /<option value="regular">Regular<\/option>/);
});

test('PDF and print separators are at least one typographic point', async () => {
  const css = await source('../app/globals.css');
  const printCss = css.slice(css.indexOf('@media print'));
  assert.match(printCss, /\.solution-stage-tableaux \{[^}]*border: 1pt solid #777;/s);
  assert.match(printCss, /border-right: 1pt solid #777 !important; border-bottom: 1pt solid #777 !important;/);
  assert.match(printCss, /\.tableau-grid \.sticky-left \{ border-right-width: 1\.5pt !important; \}/);
  assert.doesNotMatch(printCss, /border-(?:right|bottom|top): 1px solid #777/);
});

test('shared export options precede every export format', async () => {
  const [modal, css] = await Promise.all([
    source('../app/pivotlab/components/Modals.tsx'),
    source('../app/globals.css'),
  ]);
  const settings = modal.indexOf('className="export-settings-row"');
  const formats = modal.indexOf('className="export-formats"');
  assert.ok(settings >= 0 && formats > settings);
  assert.match(css, /\.export-settings-row \{[^}]*grid-template-columns: repeat\(2,/s);
  assert.match(css, /\.export-formats \{[^}]*grid-template-columns: 1\.3fr \.7fr;/s);
});

test('navigation and history call entries pivoting steps, not tableaux', async () => {
  const [app, settings, history, modal] = await Promise.all([
    source('../app/pivotlab/App.tsx'),
    source('../app/pivotlab/app/settings.ts'),
    source('../app/pivotlab/components/HistoryView.tsx'),
    source('../app/pivotlab/components/Modals.tsx'),
  ]);
  assert.match(app, /Previous pivoting step/);
  assert.match(app, /Next pivoting step/);
  assert.match(settings, /previous pivoting step/);
  assert.match(settings, /next pivoting step/);
  assert.match(history, /<h2>Pivoting steps<\/h2>/);
  assert.match(history, /problem\.stepCount === 1 \? 'step' : 'steps'/);
  assert.doesNotMatch([app, settings, history, modal].join('\n'), /previous tableau|next tableau|every tableau through/i);
});

test('minus signs use balanced normal-flow tracks around the common magnitude axis', async () => {
  const [numberValue, css, graphic] = await Promise.all([
    source('../app/pivotlab/components/NumberValue.tsx'),
    source('../app/globals.css'),
    source('../app/pivotlab/export/tableauGraphic.ts'),
  ]);
  assert.match(numberValue, /className="number-sign"/);
  assert.match(numberValue, /className="number-magnitude fraction-stack"/);
  assert.match(css, /\.number-value \{[^}]*display: inline-grid;[^}]*grid-template-columns: \.82em auto \.82em;/s);
  assert.match(css, /\.number-sign \{[^}]*grid-column: 1;[^}]*align-self: center;/s);
  assert.doesNotMatch(css, /\.number-sign \{[^}]*position: absolute/s);
  assert.match(graphic, /const fractionX = x;/);
  assert.match(graphic, /signedTextLabel\(formatRational\(value, display\), x, y, bold, 18\)/);
  assert.doesNotMatch(numberValue, /fraction-sign/);
});

test('split variable parts have explicit kinds, selector labels, and green signs', async () => {
  const [tableau, project, result, grid, css] = await Promise.all([
    source('../app/pivotlab/model/tableau.ts'),
    source('../app/pivotlab/model/project.ts'),
    source('../app/pivotlab/model/result.ts'),
    source('../app/pivotlab/components/TableauGrid.tsx'),
    source('../app/globals.css'),
  ]);
  assert.match(tableau, /'split-positive' \| 'split-negative'/);
  assert.match(project, /isVariableKind\(kind\)/);
  assert.match(result, /isDecisionVariableKind\(variable\.kind\)/);
  assert.match(grid, /<option value="split-positive">Split \(\+\)<\/option>/);
  assert.match(grid, /<option value="split-negative">Split \(−\)<\/option>/);
  assert.match(grid, /variable\.kind === 'split-positive' \? '\+'/);
  assert.match(css, /\.variable-split-positive \.variable-kind-marker, \.variable-split-negative \.variable-kind-marker \{[^}]*background: transparent;/s);
});

test('variable markers explain themselves on delayed hover, focus, and touch', async () => {
  const [grid, css] = await Promise.all([
    source('../app/pivotlab/components/TableauGrid.tsx'),
    source('../app/globals.css'),
  ]);
  for (const hint of [
    'Original variable',
    'Slack variable',
    'Artificial variable',
    'Positive part of unrestricted variable',
    'Negative part of unrestricted variable',
  ]) assert.match(grid, new RegExp(hint));
  assert.match(grid, /aria-describedby=\{editable \? undefined : `variable-kind-tip-/);
  assert.match(grid, /\{!editable && \(\s*<span[\s\S]*role="tooltip"/);
  assert.match(grid, /event\.pointerType !== 'touch'/);
  assert.match(grid, /role="tooltip"/);
  assert.match(css, /\.variable-header:hover > \.variable-kind-tooltip \{[^}]*transition-delay: \.35s;/s);
  assert.match(css, /\.variable-header:focus > \.variable-kind-tooltip, \.variable-header:focus-within > \.variable-kind-tooltip, \.variable-kind-tooltip\.touch-visible/);
});

test('pivot guidance leaves ratio calculation to the inspector', async () => {
  const [grid, modal, css] = await Promise.all([
    source('../app/pivotlab/components/TableauGrid.tsx'),
    source('../app/pivotlab/components/Modals.tsx'),
    source('../app/globals.css'),
  ]);
  assert.doesNotMatch(grid, /pivot-ratio-tooltip/);
  assert.doesNotMatch(css, /\.pivot-ratio-tooltip/);
  assert.match(modal, /Exact ratios remain available in the pivot inspector/);
});

test('the larger no-artificial-variable example is the new default', async () => {
  const [app, examples] = await Promise.all([
    source('../app/pivotlab/App.tsx'),
    source('../app/pivotlab/model/examples.ts'),
  ]);
  assert.match(app, /createExampleProblem\('large-no-phase-one'\)/);
  assert.doesNotMatch(examples, /textbook-7-4-1|Textbook · Example 7\.4\.1/);
  assert.match(examples, /title: 'Dantzig rule cycling'/);
  assert.match(examples, /title: 'Bland’s rule has more pivots than Dantzig'/);
  assert.match(examples, /title: 'Unfeasible · Small'/);
  assert.match(examples, /title: 'Unfeasible · Larger'/);
});

test('the new-tableau dialog renders the curated example library', async () => {
  const [app, modal, examples, css] = await Promise.all([
    source('../app/pivotlab/App.tsx'),
    source('../app/pivotlab/components/Modals.tsx'),
    source('../app/pivotlab/model/examples.ts'),
    source('../app/globals.css'),
  ]);
  assert.match(app, /createExampleProblem\(id\)/);
  assert.match(modal, /exampleProblems\.map/);
  assert.match(examples, /id: 'dantzig-cycling'/);
  assert.match(examples, /id: 'bland-longer'/);
  assert.match(examples, /id: 'dual-easier'/);
  assert.match(examples, /id: 'dual-harder'/);
  assert.match(css, /\.example-library \{[^}]*grid-template-columns: repeat\(2,/s);
});

test('README documents the substantive 0.9.1 capabilities without visual trivia', async () => {
  const readme = await source('../README.md');
  assert.match(readme, /Simplex Assistant 0\.9\.1/);
  assert.match(readme, /unrestricted-variable splitting/);
  assert.match(readme, /curated example library/);
  assert.doesNotMatch(readme, /colored variable|green dot|tooltip delay/i);
});
