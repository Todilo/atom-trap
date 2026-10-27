import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// Served from https://todilo.github.io/atom-trap/ (ADR-0011), so every URL is relative to this base.
const base = '/atom-trap/';

// `vite build --mode app` builds the Android app (ADR-0020): the files load from inside the app, so
// paths are relative, and there's no service worker; Google Play delivers updates instead.
export default defineConfig(({ mode }) => mode === 'app' ? appConfig : webConfig);

const appConfig = defineConfig({
  base: './',
  build: { outDir: 'dist-app' },
  resolve: { alias: { 'virtual:pwa-register': fileURLToPath(new URL('src/shell/noServiceWorker.ts', import.meta.url)) } },
});

const webConfig = defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon.svg'],
      manifest: {
        name: 'Atom Trap: Neon',
        short_name: 'Atom Trap: Neon',
        description: 'Atom Trap: Neon. Build walls, trap bouncing atoms, clear the board.',
        start_url: base,
        scope: base,
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#05060f',
        theme_color: '#05060f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,txt}'],
      },
    }),
  ],
});
