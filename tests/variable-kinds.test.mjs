import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let tableauModel;
let projectModel;
let resultModel;
let rationalModel;

before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  [tableauModel, projectModel, resultModel, rationalModel] = await Promise.all([
    server.ssrLoadModule('/app/pivotlab/model/tableau.ts'),
    server.ssrLoadModule('/app/pivotlab/model/project.ts'),
    server.ssrLoadModule('/app/pivotlab/model/result.ts'),
    server.ssrLoadModule('/app/pivotlab/math/rational.ts'),
  ]);
});

after(async () => server?.close());

test('split variable kinds survive projects and remain result coordinates', () => {
  const tableau = tableauModel.createBlankTableau(1, 3, 'Split variable');
  tableau.variables[1].kind = 'split-positive';
  tableau.variables[2].kind = 'split-negative';
  tableau.rows[0].basisId = tableau.variables[1].id;
  tableau.rows[0].values[1] = rationalModel.Rational.ONE;
  tableau.rows[0].values[3] = rationalModel.Rational.parse('5');
  const history = [{ id: 'h0', label: 'Initial tableau', tableau }];
  const loaded = projectModel.deserializeProject(projectModel.serializeProject(history, 0));
  assert.deepEqual(loaded.history[0].tableau.variables.map((variable) => variable.kind), [
    'regular',
    'split-positive',
    'split-negative',
  ]);
  assert.equal(resultModel.getSolutionResult(loaded.history[0].tableau).values.length, 3);
});
