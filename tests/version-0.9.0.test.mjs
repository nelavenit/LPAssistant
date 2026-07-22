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
