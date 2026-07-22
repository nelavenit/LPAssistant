import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let tableauModel;
let projectModel;
let stageModel;
let historyModel;
let graphicModel;
let settingsModel;
let rationalModel;

before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  [tableauModel, projectModel, stageModel, historyModel, graphicModel, settingsModel, rationalModel] = await Promise.all([
    server.ssrLoadModule('/app/pivotlab/model/tableau.ts'),
    server.ssrLoadModule('/app/pivotlab/model/project.ts'),
    server.ssrLoadModule('/app/pivotlab/model/stages.ts'),
    server.ssrLoadModule('/app/pivotlab/model/problemHistory.ts'),
    server.ssrLoadModule('/app/pivotlab/export/tableauGraphic.ts'),
    server.ssrLoadModule('/app/pivotlab/app/settings.ts'),
    server.ssrLoadModule('/app/pivotlab/math/rational.ts'),
  ]);
});

after(async () => server?.close());

function stagedHistory() {
  const initial = tableauModel.createBlankTableau(3, 4, 'Export matrix');
  initial.rows[0].values[0] = rationalModel.Rational.parse('1/3');
  initial.objective[initial.variables.length] = rationalModel.Rational.parse('12');
  const phaseOne = tableauModel.startPhaseOne(initial, [initial.rows[0].id]);
  const phaseTwo = tableauModel.cloneTableau(phaseOne);
  phaseTwo.phase = 'original';
  phaseTwo.storedObjective = undefined;
  phaseTwo.objectiveName = 'f';
  phaseTwo.objective[phaseTwo.variables.length] = rationalModel.Rational.parse('15');
  return [
    { id: 'h0', label: 'Initial tableau', tableau: initial },
    { id: 'h1', label: 'Phase I setup', tableau: phaseOne },
    { id: 'h2', label: 'Original objective restored', tableau: phaseTwo },
  ];
}

test('stage grouping keeps variable-shape changes at explicit boundaries', () => {
  const history = stagedHistory();
  const stages = stageModel.groupTableauStages(history, 2);
  assert.deepEqual(stages.map((stage) => stage.label), ['Initial problem', 'Phase I', 'Phase II']);
  assert.deepEqual(stages.map((stage) => stage.entries.length), [1, 1, 1]);
  assert.equal(stageModel.groupTableauStages(history.slice(0, 1), 0)[0].label, null);
});

test('all text export scope, result, and number-display combinations are independent', () => {
  const history = stagedHistory();
  const formats = [
    ['LaTeX', projectModel.exportLatexProject],
    ['Markdown', projectModel.exportMarkdownProject],
    ['CSV', projectModel.exportCsvProject],
  ];
  const displays = [{ mode: 'fraction' }, { mode: 'decimal', precision: 3 }];
  let combinations = 0;
  for (const completeSolution of [false, true]) {
    for (const includeResult of [false, true]) {
      for (const display of displays) {
        for (const [name, exporter] of formats) {
          const output = exporter(history, 2, display, { completeSolution, includeResult });
          assert.equal(output.includes('Phase I'), completeSolution, `${name}: solution scope`);
          assert.equal(output.includes('Final result'), includeResult, `${name}: result scope`);
          if (name !== 'LaTeX') {
            assert.equal(output.includes(display.mode === 'fraction' ? '1/3' : '0.333'), true, `${name}: number display`);
          }
          combinations += 1;
        }
      }
    }
  }
  assert.equal(combinations, 24);
});

test('SVG, PNG source, transparency, scope, result, and number display form a full matrix', () => {
  const history = stagedHistory();
  let combinations = 0;
  for (const completeSolution of [false, true]) {
    for (const includeResult of [false, true]) {
      for (const transparent of [false, true]) {
        for (const display of [{ mode: 'fraction' }, { mode: 'decimal', precision: 2 }]) {
          const graphic = graphicModel.createTableauHistoryGraphic(history, 2, display, {
            completeSolution,
            includeResult,
            transparent,
            resultTableau: history[2].tableau,
          });
          assert.ok(graphic.width > 0 && graphic.height > 0);
          assert.equal(graphic.svg.includes('Phase I'), completeSolution);
          assert.equal(graphic.svg.includes('>min</text>'), includeResult);
          assert.equal(graphic.svg.includes('fill="#ffffff"'), !transparent);
          combinations += 1;
        }
      }
    }
  }
  assert.equal(combinations, 16);
});

test('algebra and Phase I construction survive large tableaux with exact values', () => {
  const tableau = tableauModel.createBlankTableau(60, 100, 'Stress tableau');
  tableau.rows[0].values[0] = rationalModel.Rational.parse('2/3');
  tableau.rows[0].values[1] = rationalModel.Rational.parse('5/7');
  tableau.rows[0].values[100] = rationalModel.Rational.parse('11/13');
  tableau.rows[1].values[0] = rationalModel.Rational.parse('4/5');
  tableau.objective[0] = rationalModel.Rational.parse('-9/11');
  const pivoted = tableauModel.pivotTableau(tableau, 0, 0).tableau;
  assert.equal(pivoted.rows.length, 60);
  assert.equal(pivoted.variables.length, 100);
  assert.equal(pivoted.rows[0].values[0].toFraction(), '1');
  assert.equal(pivoted.rows[0].values[1].toFraction(), '15/14');
  assert.equal(pivoted.rows.every((row) => row.values.length === 101), true);

  const phaseOne = tableauModel.startPhaseOne(tableau, tableau.rows.slice(0, 30).map((row) => row.id));
  assert.equal(phaseOne.variables.length, 130);
  assert.equal(phaseOne.variables.filter((variable) => variable.kind === 'artificial').length, 30);
  assert.equal(phaseOne.variables.filter((variable) => variable.kind === 'artificial').every((variable) => /^z\d+$/.test(variable.name)), true);
  tableauModel.assertTableauShape(phaseOne);
});

test('settings and previous-problem history persist and reject damaged data', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const history = stagedHistory();
  const record = historyModel.createProblemHistoryRecord(history, 2, new Date('2026-07-20T12:00:00.000Z'));
  historyModel.saveProblemHistory([record], storage);
  const loaded = historyModel.loadProblemHistory(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].title, 'Export matrix');
  assert.equal(historyModel.openProblemHistoryRecord(loaded[0]).currentIndex, 2);
  storage.setItem(historyModel.PROBLEM_HISTORY_KEY, '[{"broken":true}]');
  assert.deepEqual(historyModel.loadProblemHistory(storage), []);

  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = storage;
  storage.setItem('pivotlab-settings', JSON.stringify({ uiScale: 10, tableFontSize: 100, showPivotHints: true }));
  const settings = settingsModel.loadSettings();
  assert.equal(settings.uiScale, 75);
  assert.equal(settings.tableFontSize, 30);
  assert.equal(settings.showPivotHints, true);
  globalThis.localStorage = previousStorage;
});

test('light and dark theme tokens, inspector art, controls, and print frames retain their invariants', async () => {
  const [app, css, inspector, variableName, grid, modal, readme] = await Promise.all([
    readFile(new URL('../app/pivotlab/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/globals.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/pivotlab/components/Inspector.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/pivotlab/components/VariableName.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/pivotlab/components/TableauGrid.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/pivotlab/components/Modals.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /<span className="display-fraction-sample" aria-label="Fractions">[\s\S]*display-fraction-slash/);
  assert.match(css, /\.display-fraction-slash \{[^}]*top: -\.045em;/s);
  assert.match(variableName, /className="variable-name"/);
  assert.match(inspector, /var\(--pivot-icon-field\)/);
  assert.match(inspector, /M140 110v16/);
  assert.match(css, /:root\[data-theme="dark"\][\s\S]*--bg: #111111;[\s\S]*--brand: #3fb950;/);
  assert.doesNotMatch(css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/)?.[1] ?? '', /#(?:63c3a1|193c30|304039|485c52)/i);
  assert.ok(contrast('#111111', '#f2f2f2') > 15);
  assert.doesNotMatch(grid, /row-actions-cell|row-actions-column/);
  assert.match(grid, /basis-row-remove/);
  assert.match(modal, /<CopyIcon \/> Copy/);
  assert.match(modal, /Restore appearance defaults/);
  assert.match(modal, /Restore shortcut defaults/);
  assert.doesNotMatch(modal, /eyebrow="Start fresh"/);
  assert.match(css, /\.solution-stage-tableaux \{ display: block; border: 1pt solid #777;/);
  assert.match(css, /height: 7\.5mm; padding: 1\.2mm;/);
  assert.doesNotMatch(readme, /clearly named|tableau-only scrolling|persistent Pivot Inspector/i);
});

test('release metadata and offline cache identify version 0.9.0', async () => {
  const [pkg, lock, readme, modal, worker] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
    readFile(new URL('../app/pivotlab/components/Modals.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../public/sw.js', import.meta.url), 'utf8'),
  ]);
  assert.match(pkg, /"version": "0\.9\.0"/);
  assert.match(lock, /"version": "0\.9\.0"/);
  assert.match(readme, /Simplex Assistant 0\.9\.0/);
  assert.match(modal, /Simplex Assistant 0\.9\.0/);
  assert.match(worker, /simplex-assistant-shell-v13/);
});

function contrast(first, second) {
  const luminance = (hex) => {
    const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}
