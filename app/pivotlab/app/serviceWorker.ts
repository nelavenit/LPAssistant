export function registerServiceWorker(base = './') {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register(new URL(`${base}sw.js`, document.baseURI), { updateViaCache: 'none' })
    .then((registration) => registration.update())
    .catch(() => undefined);
}
