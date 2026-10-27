import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

/**
 * Stands in for vite-plugin-pwa's `virtual:pwa-register` in the Android app build (ADR-0020), which
 * has no service worker: Google Play delivers updates, so Updates sees no registration.
 */
export function registerSW(_options?: RegisterSWOptions): (reload?: boolean) => Promise<void> {
  return async () => {};
}
