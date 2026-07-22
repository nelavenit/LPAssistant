import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the display selector uses a native, optically centered slash', async () => {
  const [app, css] = await Promise.all([
    source('../app/pivotlab/App.tsx'),
    source('../app/globals.css'),
  ]);
  assert.match(app, /className="display-fraction-slash"[^>]*>\/<\/span>/);
  assert.match(css, /\.display-fraction-sample \{[^}]*align-items: baseline;/s);
  assert.match(css, /\.display-fraction-slash \{[^}]*top: -\.045em;/s);
  assert.doesNotMatch(css, /\.display-fraction-slash \{[^}]*transform: rotate/s);
});

test('print releases the viewport clip and paginates large tableaux by row', async () => {
  const css = await source('../app/globals.css');
  const printCss = css.slice(css.indexOf('@media print'));
  assert.match(printCss, /\.app-shell\.workspace-open \{ height: auto !important; overflow: visible !important; \}/);
  assert.match(printCss, /\.tableau-step, \.history-card \{ break-inside: auto; \}/);
  assert.match(printCss, /\.tableau-grid tr \{ break-inside: avoid; page-break-inside: avoid; \}/);
  assert.doesNotMatch(printCss, /\.tableau-step, \.history-card \{ break-inside: avoid; \}/);
});

test('fractions keep one vertical anchor in active and completed steps', async () => {
  const css = await source('../app/globals.css');
  assert.match(css, /\.tableau-grid th, \.tableau-grid td \{[^}]*vertical-align: middle;/s);
  assert.match(css, /\.number-value \{[^}]*vertical-align: middle;/s);
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
  const example = modal.indexOf('Load textbook example');
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
