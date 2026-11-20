import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('the service worker installs the whole release, scopes caches, and serves offline navigation', async () => {
  const scope = 'https://example.test/LPAssistant/';
  const release = { version: 'current', files: ['index.html', 'assets/app.js'] };
  const handlers = new Map();
  const files = new Map();
  const removed = [];
  let claimed = false;
  let online = true;
  const cache = {
    addAll: async (requests) => requests.forEach(({ url }) => files.set(url, new Response(url))),
    match: async (request) => files.get(request.url ?? request)?.clone(),
  };
  runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL, Request, Response,
    self: {
      registration: { scope },
      PAGES_RELEASE: release,
      addEventListener: (type, handler) => handlers.set(type, handler),
      clients: { claim: async () => { claimed = true; } },
    },
    caches: {
      open: async (name) => { assert.equal(name, 'simplex-assistant:/LPAssistant/:current'); return cache; },
      keys: async () => ['simplex-assistant:/LPAssistant/:old', 'simplex-assistant:/LPAssistant/:current', 'unrelated'],
      delete: async (name) => removed.push(name),
    },
    fetch: async () => {
      if (!online) throw new Error('offline');
      return new Response('network');
    },
  });
  function fire(type, event = {}) {
    let work;
    handlers.get(type)({ ...event, waitUntil(promise) { work = promise; }, respondWith(promise) { work = promise; } });
    return work;
  }
  await fire('install');
  assert.ok(files.has(scope + 'assets/app.js'));
  await fire('activate');
  assert.equal(claimed, true);
  assert.deepEqual(removed, ['simplex-assistant:/LPAssistant/:old']);
  const request = { url: scope + '?lesson=1', mode: 'navigate', method: 'GET' };
  assert.equal(await (await fire('fetch', { request })).text(), 'network');
  online = false;
  assert.equal(await (await fire('fetch', { request })).text(), scope);
  const asset = new Request(scope + 'assets/app.js');
  assert.equal(await (await fire('fetch', { request: asset })).text(), asset.url);
  assert.equal(fire('fetch', { request: new Request('https://example.test/unrelated') }), undefined);
});
