import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let model;
let locale;
let result;
let project;
let rational;
let autoSolve;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  [model, locale, result, project, rational, autoSolve] = await Promise.all([
    'model/tableau', 'app/i18n', 'model/result', 'model/project', 'math/rational', 'model/autoSolve',
  ].map((module) => vite.ssrLoadModule('/app/pivotlab/' + module + '.ts')));
});

test('auto-solve uses exact pivots and saves the final tableau and the pivot history', () => {
  const Q = rational.Rational.parse;
  const initial = model.createBlankTableau(1, 2);
  initial.rows[0].values = ['3', '1', '2'].map(Q);
  initial.rows[0].basisId = initial.variables[1].id;
  initial.objective = ['-1', '0', '0'].map(Q);
  const steps = [...autoSolve.autoSolveTableau(initial, 0)];
  assert.equal(steps.length, 1);
  assert.equal(steps[0].pivot.pivotValue, '3');
  assert.equal(steps[0].label, 'Pivot 1: x1 enters');
  const history = [{ id: 'start', label: 'Initial tableau', tableau: initial }, { id: 'end', ...steps[0] }];
  const saved = project.deserializeProject(project.serializeProject(history, 1));
  assert.equal(saved.currentIndex, 1);
  assert.equal(model.analyzeTableau(saved.history[1].tableau), 'optimal');
  assert.equal(result.getSolutionResult(saved.history[1].tableau).objectiveValue.toFraction(), '-2/3');
  assert.equal(initial.rows[0].basisId, initial.variables[1].id);
});

test('auto-solve uses Bland’s rule for a degenerate ratio tie', () => {
  const Q = rational.Rational.parse;
  const initial = model.createBlankTableau(3, 7);
  initial.rows[0].values = ['1/2', '-3/2', '-1/2', '1', '0', '1', '0', '0'].map(Q);
  initial.rows[1].values = ['1/2', '-11/2', '-5/2', '9', '1', '0', '0', '0'].map(Q);
  initial.rows[2].values = ['1', '0', '0', '0', '0', '0', '1', '1'].map(Q);
  initial.rows.forEach((row, index) => { row.basisId = initial.variables[[5, 4, 6][index]].id; });
  initial.objective = ['-10', '57', '9', '24', '0', '0', '0', '0'].map(Q);
  const steps = autoSolve.autoSolveTableau(initial, 0);
  assert.equal(steps.next().value.pivot.leavingName, 'x5');
  let next;
  let final;
  for (let count = 0; count < 20; count += 1) {
    next = steps.next();
    if (next.done) break;
    final = next.value.tableau;
  }
  assert.equal(next.done, true);
  assert.equal(model.analyzeTableau(final), 'optimal');
  assert.equal(result.getSolutionResult(final).objectiveValue.toFraction(), '-1');
});

test('auto-solve requires Phase I setup and restores the original objective before Phase II', () => {
  const Q = rational.Rational.parse;
  const initial = model.createBlankTableau(1, 2);
  initial.rows[0].values = ['2', '1', '4'].map(Q);
  initial.objective = ['0', '-1', '0'].map(Q);
  assert.equal(autoSolve.autoSolveState(initial), 'needsPhaseOne');
  assert.throws(() => autoSolve.autoSolveTableau(initial, 0).next(), /canonical/);
  const phaseOne = model.startPhaseOne(initial, [initial.rows[0].id]);
  const steps = [...autoSolve.autoSolveTableau(phaseOne, 1)];
  assert.deepEqual(steps.map(({ label }) => label), ['Pivot 2: x1 enters', 'Original objective restored', 'Pivot 4: x2 enters']);
  assert.equal(steps[1].tableau.phase, 'original');
  assert.equal(steps[1].tableau.variables.length, 2);
  assert.equal(result.getSolutionResult(steps[2].tableau).objectiveValue.toFraction(), '-4');
  initial.rows[0].basisId = initial.variables[1].id;
  assert.equal(autoSolve.autoSolveState(initial), 'needsCanonicalObjective');
});

test('auto-solve pivots zero-valued artificials out and reports infeasible and unbounded tableaux', () => {
  const Q = rational.Rational.parse;
  const initial = model.createBlankTableau(2, 2);
  initial.rows[0].values = ['-1', '1', '0'].map(Q);
  initial.objective = ['1', '0', '0'].map(Q);
  const rows = initial.rows.map(({ id }) => id);
  const steps = [...autoSolve.autoSolveTableau(model.startPhaseOne(initial, rows), 1)];
  assert.equal(steps[0].pivot.pivotValue, '-1');
  assert.equal(steps[1].tableau.rows.length, 1);
  assert.equal(model.analyzeTableau(steps[1].tableau), 'optimal');

  initial.rows[1].values[2] = Q('1');
  const infeasible = model.startPhaseOne(initial, rows);
  const infeasibleSteps = [...autoSolve.autoSolveTableau(infeasible, 1)];
  assert.equal(infeasibleSteps.length, 1);
  assert.equal(model.analyzeTableau(infeasibleSteps[0].tableau), 'phaseOneInfeasible');
  assert.equal(autoSolve.autoSolveState(infeasibleSteps[0].tableau), 'complete');

  const unbounded = model.createBlankTableau(1, 2);
  unbounded.rows[0].values = ['1', '1', '1'].map(Q);
  unbounded.rows[0].basisId = unbounded.variables[1].id;
  unbounded.objective = ['-1', '0', '0'].map(Q);
  unbounded.rows[0].values[0] = Q('-1');
  assert.equal(model.analyzeTableau(unbounded), 'unbounded');
  assert.equal(autoSolve.autoSolveState(unbounded), 'complete');
});
after(() => vite?.close());

const file = (relative) => readFile(new URL('../dist/pages/' + relative, import.meta.url), 'utf8');

test('Pages publishes the subpath entry and pre-caches every built entry asset', async () => {
  const [html, sw, manifest] = await Promise.all([file('index.html'), file('sw.js'), file('manifest.webmanifest')]);
  const scope = html.match(/href="([^"]*)manifest\.webmanifest"/)[1];
  assert.ok(scope.startsWith('/') && scope.endsWith('/'));
  const release = JSON.parse(sw.split('\n')[0].replace('self.PAGES_RELEASE = ', '').replace(/;\r?$/, ''));
  assert.match(release.version, /^[0-9a-f]{16}$/);
  for (const url of html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)) {
    assert.ok(url[1].startsWith(scope));
    const asset = url[1].slice(scope.length);
    assert.ok(release.files.includes(asset));
    assert.ok((await file(asset)).length > 0);
  }
  assert.ok(release.files.includes('index.html'));
  assert.equal(JSON.parse(manifest).start_url, './');
  assert.equal(JSON.parse(manifest).scope, './');
});

test('uses the first supported browser language and respects the saved preference', () => {
  assert.equal(locale.resolveLanguage('system', ['de-DE', 'ru-RU', 'en-US']), 'ru');
  assert.equal(locale.resolveLanguage('system', ['en-US', 'ru']), 'en');
  assert.equal(locale.resolveLanguage('system', ['de-DE']), 'en');
  assert.equal(locale.resolveLanguage('en', ['ru-RU']), 'en');
  assert.equal(locale.translate('ru', 'Step {number}', { number: 3 }), 'Шаг 3');
});

test('checks the basis and reduced costs before identifying an optimum', () => {
  const Q = rational.Rational.parse;
  const tableau = model.createBlankTableau(1, 2);
  tableau.rows[0].basisId = tableau.variables[0].id;
  tableau.rows[0].values = ['2', '1', '5'].map(Q);
  tableau.objective = ['2', '3', '0'].map(Q);
  assert.equal(model.analyzeTableau(tableau), 'noncanonical');
  assert.equal(model.detectBasis(tableau).rows[0].basisId, tableau.variables[1].id);
  const canonical = model.canonicalizeObjective(model.detectBasis(tableau));
  assert.equal(model.analyzeTableau(canonical), 'feasible');
  assert.doesNotMatch(result.formatSolutionResult(canonical, { mode: 'fraction' }), /ₘᵢₙ/);
  const optimal = model.pivotTableau(canonical, 0, 0).tableau;
  assert.equal(model.analyzeTableau(optimal), 'optimal');
  assert.equal(result.getSolutionResult(optimal).objectiveValue.toFraction(), '5');
  const exported = project.exportMarkdownProject([{ id: 'h', label: 'Initial tableau', tableau: optimal }], 0, { mode: 'fraction' }, {
    completeSolution: true, includeResult: true, language: 'ru',
  });
  assert.match(exported, /Текущий результат/);
  assert.match(exported, /fₘᵢₙ = 5 в точке/);
  optimal.rows[0].values[2] = Q('-1');
  assert.equal(model.analyzeTableau(optimal), 'infeasibleBasis');
  canonical.rows[0].values[0] = Q('-2');
  assert.equal(model.analyzeTableau(canonical), 'unbounded');
});

test('Phase I normalizes negative free terms, rejects cancellation and removes redundant rows', () => {
  const Q = rational.Rational.parse;
  const tableau = model.createBlankTableau(2, 1);
  tableau.rows[0].values = ['-1', '-2'].map(Q);
  tableau.rows[1].values = ['0', '0'].map(Q);
  tableau.objective = ['3', '0'].map(Q);
  const phase1 = model.startPhaseOne(tableau, model.phaseOneSuggestedRows(tableau));
  assert.equal(phase1.rows[0].values.at(-1).toFraction(), '2');
  assert.equal(model.analyzeTableau(phase1), 'phaseOneRunning');
  assert.throws(() => model.finishPhaseOne(phase1), /−w = 0/);
  const pivoted = model.pivotTableau(phase1, 0, 0).tableau;
  assert.equal(model.analyzeTableau(pivoted), 'phaseOneFeasible');
  const restored = model.finishPhaseOne(pivoted);
  assert.equal(restored.rows.length, 1);
  assert.equal(restored.variables.length, 1);
  assert.equal(result.getSolutionResult(restored).objectiveValue.toFraction(), '6');
  const malformed = model.cloneTableau(phase1);
  malformed.rows[1].values[3] = Q('-2');
  malformed.objective[3] = Q('0');
  assert.throws(() => model.finishPhaseOne(malformed), /nonnegative/);
  tableau.rows[0].values = ['0', '2'].map(Q);
  assert.equal(model.analyzeTableau(model.startPhaseOne(tableau, model.phaseOneSuggestedRows(tableau))), 'phaseOneInfeasible');
});
