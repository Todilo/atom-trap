import './style.css';
import { registerSW } from 'virtual:pwa-register';

// M0 skeleton (ADR-0010): an empty board, installable and offline. The game itself arrives in M1–M3.
registerSW({ immediate: true });

// Best effort only: browsers allow the orientation lock just in fullscreen / installed mode.
const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
orientation.lock?.('landscape').catch(() => {});
