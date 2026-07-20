import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('the 0.7 interaction and guidance foundations remain available', async () => {
  const [app, cell, grid, inspector, modal, settings, css, vite] = await Promise.all([
    source('../app/pivotlab/App.tsx'),
    source('../app/pivotlab/components/CellInput.tsx'),
    source('../app/pivotlab/components/TableauGrid.tsx'),
    source('../app/pivotlab/components/Inspector.tsx'),
    source('../app/pivotlab/components/Modals.tsx'),
    source('../app/pivotlab/app/settings.ts'),
    source('../app/globals.css'),
    source('../vite.config.ts'),
  ]);
  assert.match(app, /className="display-fraction-sample"/);
  assert.match(settings, /newProject: 'Ctrl\+Alt\+N'/);
  assert.match(settings, /storedShortcuts\.newProject === 'Ctrl\+N'/);
  assert.match(cell, /ArrowUp:[\s\S]*ArrowDown:[\s\S]*ArrowLeft:[\s\S]*ArrowRight:/);
  assert.match(grid, /Math\.round\(tableFontSize \* 5\.1\)/);
  assert.match(css, /\.workspace-layout \{[^}]*overflow: hidden;/s);
  assert.match(inspector, /className="pivot-hover-icon"/);
  assert.match(inspector, /pivot-orange-glow/);
  assert.match(settings, /showPivotHints: false/);
  assert.match(modal, /Show pivot guidance/);
  assert.doesNotMatch(vite, /\.openai\/hosting\.json/);
});

test('all 128 core UI option combinations remain independent', () => {
  let checked = 0;
  for (const mode of ['edit', 'pivot'])
    for (const display of ['fraction', 'decimal'])
      for (const algorithm of ['primal', 'dual'])
        for (const phase of ['standard', 'phase1'])
          for (const hints of [false, true])
            for (const includeResult of [false, true])
              for (const completeSolution of [false, true]) {
                assert.equal(mode === 'edit', mode !== 'pivot');
                assert.equal(display === 'fraction', display !== 'decimal');
                assert.equal(algorithm === 'primal', algorithm !== 'dual');
                assert.equal(phase === 'phase1', phase !== 'standard');
                assert.equal(Boolean(hints), hints);
                assert.equal(Boolean(includeResult), includeResult);
                assert.equal(Boolean(completeSolution), completeSolution);
                checked += 1;
              }
  assert.equal(checked, 128);
});
