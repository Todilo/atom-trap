// Captures the Google Play store graphics from the running game (ADR-0020): phone screenshots at
// 1920×1080 and the 1024×500 feature graphic, into store/. It starts the dev server (for the
// `atomTrap` dev helpers) and a headless Edge or Chrome, and drives the game over the DevTools
// protocol. Run with `npm run store-capture`.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = 4317;
const DEBUG_PORT = 9333;
const URL = `http://127.0.0.1:${PORT}/atom-trap/`;
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // Not up yet.
    }
    await sleep(200);
  }
  throw new Error(`gave up waiting for ${url}`);
}

/** A minimal DevTools protocol client for one page. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const run = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  return { send, run, close: () => ws.close() };
}

// Progress for the screenshots, so the puzzle and achievement pages look like a player's.
const PUZZLE_BEST = {
  'first-trap': 3, pillars: 4, 'two-rooms': 5, teeth: 3, crossroads: 7, diamond: 6, 'picture-frame': 5,
  'busy-crossing': 10, 'room-service': 8, 'crowded-pillars': 12, shark: 9, 'full-frame': 14, 'plus-signs': 5,
  'four-corners': 9,
};
const STATS = {
  wallsPlaced: 640, atomsCaptured: 74, bestCapturesOnBoard: 4, cleanSweeps: 2, bestChain: 6, bestArcadeBoard: 8,
  bestClassicLevel: 11, bestClassicScore: 38_000, classicTraps: 1,
};
const SEED = {
  hintSeen: true,
  introSeen: { classic: true, arcade: true, puzzle: true, daily: true },
  puzzleBest: PUZZLE_BEST,
  stats: STATS,
  prefs: { mode: 'classic' },
};

async function main() {
  const browser = BROWSERS.find((b) => existsSync(b));
  if (!browser) throw new Error('no Edge or Chrome found');
  mkdirSync('store/screenshots', { recursive: true });

  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    stdio: 'ignore',
  });
  const chrome = spawn(
    browser,
    ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'store-capture-'))}`, '--no-first-run', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank'],
    { stdio: 'ignore' },
  );
  try {
    await waitFor(URL);
    const targets = await (await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    const page = await connect(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    const { send, run } = page;

    const open = async (width, height, scale) => {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await send('Page.navigate', { url: URL });
      await sleep(1500);
      await run(`(() => { localStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(SEED)})) localStorage.setItem('atom-trap:' + k, JSON.stringify(v)); })()`);
      await send('Page.reload');
      await sleep(2500);
    };
    const shot = async (file) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log('wrote', file);
    };
    const click = (action) => run(`document.querySelector('[data-action="${action}"]').click()`);
    const menu = async () => {
      await click('wake');
      await sleep(600);
    };
    const play = async (mode) => {
      await menu();
      await click(`mode:${mode}`);
      await sleep(300);
      await click('play');
      await sleep(800);
    };

    // Phones in landscape: 800×450 CSS pixels (a phone's compact layout) at 2.4× is 1920×1080.
    const phone = () => open(800, 450, 2.4);

    await phone();
    await sleep(5000);
    await shot('store/screenshots/01-attract.png');

    // Gameplay: the bot plays a stretch of steps at once (headless frames are too slow to watch it).
    await phone();
    await play('classic');
    await run('atomTrap.level(7); atomTrap.autoplay(200)');
    await sleep(1500);
    await shot('store/screenshots/02-classic.png');

    await phone();
    await play('arcade');
    // The bot clears Arcade boards fast: play in small bites and stop mid-chain, with walls up.
    await run(`(() => {
      for (let i = 0; i < 300; i++) {
        atomTrap.autoplay(2);
        const sim = atomTrap.run.sim;
        if (atomTrap.mode === 'playing' && sim.chain >= 2 && sim.wallsPlaced >= 3) return;
      }
    })()`);
    await sleep(1500);
    await shot('store/screenshots/03-arcade.png');

    await phone();
    await menu();
    await click('mode:puzzle');
    await sleep(300);
    await click('puzzles');
    await sleep(500);
    await click('puzzle:13');
    await sleep(800);
    await run('atomTrap.autoplay(140)');
    await sleep(1500);
    await shot('store/screenshots/04-puzzle-solved.png');

    await phone();
    await menu();
    await click('mode:puzzle');
    await sleep(300);
    await click('puzzles');
    await sleep(800);
    await shot('store/screenshots/05-puzzles.png');

    await phone();
    await menu();
    await click('mode:arcade');
    await sleep(500);
    await shot('store/screenshots/06-modes.png');

    await phone();
    await menu();
    await click('achievements');
    await sleep(800);
    await shot('store/screenshots/07-achievements.png');

    // The feature graphic: its own page, store/feature-graphic.html.
    await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 500, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: pathToFileURL('store/feature-graphic.html').href });
    await sleep(1500);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('store/feature-graphic.png', Buffer.from(data, 'base64'));
    console.log('wrote store/feature-graphic.png');

    page.close();
  } finally {
    chrome.kill();
    server.kill();
  }
}

await main();
