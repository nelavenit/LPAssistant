import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("service worker checks the network before its offline cache", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

  assert.match(source, /simplex-assistant-shell-v14/);
  assert.match(source, /self\.registration\.scope/);
  assert.match(source, /fetch\(event\.request, \{ cache: 'no-store' \}\)/);
  assert.ok(
    source.indexOf("fetch(event.request") < source.indexOf("caches.match(event.request)"),
    "the network lookup must precede the offline-cache fallback",
  );
  assert.match(source, /client\.navigate\(client\.url\)/);
});
