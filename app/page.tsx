'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { registerServiceWorker } from './pivotlab/app/serviceWorker';

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
  useEffect(() => { registerServiceWorker(); }, []);

  return <SimplexAssistant />;
}
