import type { CapacitorConfig } from '@capacitor/cli';

// The Android app (ADR-0020): the game built with `npm run build:app`, packaged by Capacitor.
const config: CapacitorConfig = {
  appId: 'com.todilo.atomtrapneon',
  appName: 'Atom Trap: Neon',
  webDir: 'dist-app',
  backgroundColor: '#05060f',
  android: {
    // The game shows nothing a player needs to copy or debug in a release build.
    webContentsDebuggingEnabled: false,
  },
};

export default config;
