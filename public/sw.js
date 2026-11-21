const scope = new URL(self.registration.scope);
const prefix = `simplex-assistant:${scope.pathname}:`;
const cacheName = `${prefix}${self.PAGES_RELEASE?.version ?? 'sites-v18'}`;
const files = new Set(['./', 'manifest.webmanifest', 'icon.svg', ...(self.PAGES_RELEASE?.files ?? [])]
  .map((path) => new URL(path, scope).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(
    [...files].map((url) => new Request(url, { cache: 'reload' })),
  )));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(prefix) && key !== cacheName)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (request.mode !== 'navigate' && !files.has(url.href) && (self.PAGES_RELEASE || !['script', 'style', 'font'].includes(request.destination))) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    if (request.mode !== 'navigate') {
      // Browsers may send different Origin headers for prefetches and module loads.
      const cached = await cache.match(request, { ignoreVary: Boolean(self.PAGES_RELEASE) });
      if (cached) return cached;
    }
    try {
      const response = await fetch(request);
      // Keep the pre-cached entry point and its hashed assets from the same build.
      if (!self.PAGES_RELEASE && response.ok && response.type === 'basic') {
        await cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    } catch {
      return await cache.match(request)
        ?? (request.mode === 'navigate' ? await cache.match(scope.href) : undefined)
        ?? Response.error();
    }
  })());
});
