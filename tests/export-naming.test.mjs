import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;
let naming;

before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  naming = await server.ssrLoadModule('/app/pivotlab/export/naming.ts');
});

after(async () => server?.close());

test('every export filename states its problem, scope, and result choice', () => {
  assert.equal(naming.exportFileStem('  Example 7.4.1  ', {
    completeSolution: true,
    includeResult: true,
  }), 'Example-7.4.1-solution-with-result');
  assert.equal(naming.exportFileStem('Two / variables', {
    completeSolution: false,
    includeResult: false,
  }), 'Two-variables-initial-without-result');
});
