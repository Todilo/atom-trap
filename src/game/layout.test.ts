import { describe, expect, it } from 'vitest';
import { cellAt, layoutBoard } from './layout';

describe('layoutBoard', () => {
  it('keeps the 28 × 20 board at ≈1.87:1 and fits the limiting side', () => {
    const wide = layoutBoard(28, 20, 0, 0, 2000, 600);
    expect(wide.height).toBe(600);
    expect(wide.width / wide.height).toBeCloseTo(448 / 240, 5);
    expect(wide.cellW / wide.cellH).toBeCloseTo(16 / 12, 5);

    const tall = layoutBoard(28, 20, 0, 0, 800, 800);
    expect(tall.width).toBe(800);
    expect(tall.y).toBeGreaterThan(0);
  });

  it('maps screen points to cells', () => {
    const l = layoutBoard(28, 20, 10, 20, 448, 240);
    expect(cellAt(l, 28, 20, 10.5, 20.5)).toEqual({ x: 0, y: 0 });
    expect(cellAt(l, 28, 20, 10 + 16 * 3 + 1, 20 + 12 * 2 + 1)).toEqual({ x: 3, y: 2 });
    expect(cellAt(l, 28, 20, 10 + 447.5, 20 + 239.5)).toEqual({ x: 27, y: 19 });
    expect(cellAt(l, 28, 20, 5, 30)).toBeNull();
  });
});
