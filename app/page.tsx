'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

const SimplexAssistant = dynamic(() => import('./pivotlab/App'), {
  ssr: false,
  loading: () => (
    <main className="app-loading" aria-label="Loading Simplex Assistant">
      <div className="brand-mark"><span className="loading-grid" /></div>
      <strong>Simplex Assistant</strong>
      <span>Preparing exact arithmetic…</span>
    </main>
  ),
});

export default function Home() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reloading = false;
    const adoptUpdate = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', adoptUpdate);
    navigator.serviceWorker
      .register(new URL('sw.js', window.location.href), { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch(() => undefined);

    return () => navigator.serviceWorker.removeEventListener('controllerchange', adoptUpdate);
  }, []);

  return <SimplexAssistant />;
}
