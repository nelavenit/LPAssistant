import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const offlineFiles = ['icon.svg', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? process.env.PAGES_BASE_PATH || '/LPAssistant/' : '/',
  plugins: [
    react(),
    {
      name: 'pages-offline-assets',
      apply: 'build',
      async writeBundle(output, bundle) {
        const directory = resolve(output.dir ?? 'dist/pages');
        const files = [...Object.keys(bundle), ...offlineFiles].sort();
        const worker = await readFile(new URL('./public/sw.js', import.meta.url), 'utf8');
        const publicAssets = await Promise.all(['index.html', ...offlineFiles].map((file) => readFile(join(directory, file))));
        const digest = createHash('sha256').update(JSON.stringify(files)).update(worker);
        publicAssets.forEach((asset) => digest.update(asset));
        const version = digest.digest('hex').slice(0, 16);
        await writeFile(join(directory, 'sw.js'), `self.PAGES_RELEASE = ${JSON.stringify({ version, files })};\n${worker}`);
        await writeFile(join(directory, '.nojekyll'), '');
      },
    },
  ],
  build: {
    outDir: 'dist/pages',
    emptyOutDir: true,
    // BigInt is native in these engines. The existing CSS uses color-mix().
    target: ['chrome111', 'safari16.4', 'ios16.4', 'firefox113'],
  },
}));
