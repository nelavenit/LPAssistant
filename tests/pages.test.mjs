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
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  [model, locale, result, project, rational] = await Promise.all([
    'model/tableau', 'app/i18n', 'model/result', 'model/project', 'math/rational',
  ].map((module) => vite.ssrLoadModule('/app/pivotlab/' + module + '.ts')));
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
