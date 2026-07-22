import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the 0.7.1 scrolling, explanations, and control fixes remain available', async () => {
  const [app, inspector, modal, grid, settings, css, installer, validator] = await Promise.all([
    source('../app/pivotlab/App.tsx'),
    source('../app/pivotlab/components/Inspector.tsx'),
    source('../app/pivotlab/components/Modals.tsx'),
    source('../app/pivotlab/components/TableauGrid.tsx'),
    source('../app/pivotlab/app/settings.ts'),
    source('../app/globals.css'),
    source('../scripts/install-ci.sh'),
    source('../scripts/validate-artifact.sh'),
  ]);
  assert.match(app, /className="display-fraction-slash"[^>]*>\/<\/span>/);
  assert.match(app, /className=\{`decimal-places-slot/);
  assert.match(css, /\.decimal-places-slot \{[^}]*width: 142px;[^}]*visibility: hidden;/s);
  assert.match(css, /\.app-shell\.workspace-open \{[^}]*overflow: hidden;/s);
  assert.match(inspector, /In primal mode, the inspector shows/);
  assert.match(inspector, /In dual mode, the inspector shows/);
  assert.match(modal, /Primal and dual mode explanations always remain visible/);
  assert.match(grid, /className="basis-select-display"/);
  assert.match(settings, /redo: 'Ctrl\+Y'/);
  assert.match(installer, /exec bash "\$\{script_dir\}\/sites-env\.sh" -- bash "\$0"/);
  assert.match(validator, /exec bash "\$\{script_dir\}\/sites-env\.sh" -- bash "\$0"/);
});
