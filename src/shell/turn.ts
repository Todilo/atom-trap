/**
 * Picks which way the portrait stage is turned (ADR-0013) from the device's gravity sensor. The
 * stage is drawn turned clockwise by default, which reads upright when the phone's right edge is up;
 * when the left edge is clearly up instead, `data-turn="left"` on <html> turns it the other way.
 * Without sensor readings (desktops, iOS without motion permission) it stays clockwise.
 */
const portrait = window.matchMedia('(orientation: portrait)');

/** Gravity along the screen's x axis (m/s²) needed to count as turned; well past a casual tilt. */
const SIDEWAYS = 6;

export function watchTurn(): void {
  window.addEventListener('devicemotion', (e) => {
    const g = e.accelerationIncludingGravity;
    if (!portrait.matches || g?.x == null || g.y == null) return;
    // Only switch when the phone is clearly on its side; anything in between keeps the last choice.
    if (Math.abs(g.x) < SIDEWAYS || Math.abs(g.y) > Math.abs(g.x) / 2) return;
    // The sensor reports the push against gravity, so x is positive when the right edge is up.
    if (g.x < 0) document.documentElement.dataset.turn = 'left';
    else delete document.documentElement.dataset.turn;
  });
}
