import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://todilo.github.io/atom-trap/ (ADR-0011), so every URL is relative to this base.
const base = '/atom-trap/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.svg'],
      manifest: {
        name: 'Atom Trap',
        short_name: 'Atom Trap',
        description: 'Atom Trap: a neon tribute to JezzBall (1992)',
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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
});
