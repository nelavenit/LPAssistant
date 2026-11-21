import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let examplesModel;
let tableauModel;

before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  [examplesModel, tableauModel] = await Promise.all([
    server.ssrLoadModule('/app/pivotlab/model/examples.ts'),
    server.ssrLoadModule('/app/pivotlab/model/tableau.ts'),
  ]);
});

after(async () => server?.close());

const load = (id) => examplesModel.createExampleProblem(id);
const valueSnapshot = (tableau) => ({
  basis: tableau.rows.map((row) => tableau.variables.find((variable) => variable.id === row.basisId)?.name ?? null),
  rows: tableau.rows.map((row) => row.values.map((value) => value.toFraction())),
  objective: tableau.objective.map((value) => value.toFraction()),
});

test('the example library covers the requested structural and pathological cases', () => {
  const ids = new Set(examplesModel.exampleProblems.map((example) => example.id));
  for (const required of [
    'small-no-phase-one',
    'small-phase-one',
    'large-no-phase-one',
    'large-phase-one',
    'dantzig-cycling',
    'bland-longer',
    'dual-easier',
    'dual-harder',
    'degenerate-tie',
    'alternate-optima',
    'unbounded-small',
    'unbounded-larger',
    'unfeasible-small',
    'unfeasible-larger',
    'unrestricted-split',
  ]) assert.equal(ids.has(required), true, required);
  assert.ok(examplesModel.exampleProblems.length >= 15);
  assert.equal(new Set(examplesModel.exampleProblems.map((example) => example.title)).size, examplesModel.exampleProblems.length);

  for (const example of examplesModel.exampleProblems) {
    const tableau = example.create();
    tableauModel.assertTableauShape(tableau);
    assert.equal(tableau.title, example.title);
  }
});

test('examples use family-local slack names and omit the retired textbook default', () => {
  assert.equal(examplesModel.exampleProblems.some((example) => example.id === 'textbook-7-4-1'), false);
  for (const example of examplesModel.exampleProblems) {
    const slackNames = example.create().variables
      .filter((variable) => variable.kind === 'slack')
      .map((variable) => variable.name);
    assert.deepEqual(slackNames, slackNames.map((_, index) => `s${index + 1}`), example.id);
  }
});

test('Phase I examples expose missing bases while direct-start examples do not', () => {
  assert.equal(load('small-no-phase-one').rows.every((row) => row.basisId), true);
  assert.equal(load('large-no-phase-one').rows.every((row) => row.basisId), true);
  assert.equal(load('small-phase-one').rows.some((row) => !row.basisId), true);
  assert.equal(load('large-phase-one').rows.filter((row) => !row.basisId).length, 2);
});

test('Beale example returns to its initial tableau after the six-pivot Dantzig cycle', () => {
  const initial = load('dantzig-cycling');
  let current = initial;
  for (const [row, column] of [[0, 0], [1, 1], [0, 2], [1, 3], [0, 4], [1, 5]]) {
    current = tableauModel.pivotTableau(current, row, column).tableau;
  }
  assert.deepEqual(valueSnapshot(current), valueSnapshot(initial));
});

test('the Bland comparison needs two pivots where Dantzig needs one', () => {
  const initial = load('bland-longer');
  const dantzig = tableauModel.pivotTableau(initial, 0, 1).tableau;
  assert.equal(dantzig.objective.slice(0, 2).every((value) => !value.isNegative()), true);

  const blandFirst = tableauModel.pivotTableau(initial, 0, 0).tableau;
  assert.equal(blandFirst.objective[1].isNegative(), true);
  const blandSecond = tableauModel.pivotTableau(blandFirst, 0, 1).tableau;
  assert.deepEqual(valueSnapshot(blandSecond), valueSnapshot(dantzig));
});

test('dual-size and split-variable examples encode their advertised structures', () => {
  const dualEasier = load('dual-easier');
  const dualHarder = load('dual-harder');
  assert.deepEqual([
    dualEasier.rows.length,
    dualEasier.variables.filter((variable) => variable.kind === 'regular').length,
    dualEasier.variables.length,
    dualEasier.rows.filter((row) => row.basisId === null).length,
  ], [3, 2, 5, 3]);
  assert.deepEqual([
    dualHarder.rows.length,
    dualHarder.variables.filter((variable) => variable.kind === 'regular').length,
    dualHarder.variables.length,
    dualHarder.rows.filter((row) => row.basisId !== null).length,
  ], [2, 3, 5, 2]);
  assert.deepEqual(load('unrestricted-split').variables.slice(0, 2).map((variable) => variable.kind), [
    'split-positive',
    'split-negative',
  ]);
});
