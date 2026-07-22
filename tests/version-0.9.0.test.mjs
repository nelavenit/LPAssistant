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
