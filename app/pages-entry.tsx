/// <reference types="vite/client" />
import { createRoot } from 'react-dom/client';
import App from './pivotlab/App';
import { registerServiceWorker } from './pivotlab/app/serviceWorker';
import './globals.css';

createRoot(document.getElementById('root')!).render(<App />);

if (import.meta.env.PROD) registerServiceWorker(import.meta.env.BASE_URL);
