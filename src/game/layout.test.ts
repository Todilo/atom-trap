import { describe, expect, it } from 'vitest';
import { cellAt, layoutBoard, wallOriginAt } from './layout';

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

  it('splits a wall at the cell edge nearest the point', () => {
    // 16 × 12 px cells starting at (10, 20).
    const l = layoutBoard(28, 20, 10, 20, 448, 240);
    const at = (cx: number, cy: number, o: 'horizontal' | 'vertical') => wallOriginAt(l, 28, 20, 10 + cx, 20 + cy, o);
    // In cell (5, 3): the left part splits on its left edge (half A starts in cell 4), the right part on its right edge.
    expect(at(5 * 16 + 3, 3 * 12 + 6, 'horizontal')).toEqual({ x: 4, y: 3 });
    expect(at(5 * 16 + 13, 3 * 12 + 6, 'horizontal')).toEqual({ x: 5, y: 3 });
    // Vertical walls use the nearest top or bottom edge, and keep the clicked column.
    expect(at(5 * 16 + 3, 3 * 12 + 2, 'vertical')).toEqual({ x: 5, y: 2 });
    expect(at(5 * 16 + 3, 3 * 12 + 10, 'vertical')).toEqual({ x: 5, y: 3 });
    // Never split on the board's own edge, so both halves can start.
    expect(at(2, 50, 'horizontal')).toEqual({ x: 0, y: 4 });
    expect(at(447, 50, 'horizontal')).toEqual({ x: 26, y: 4 });
    expect(at(100, 239, 'vertical')).toEqual({ x: 6, y: 18 });
    expect(at(-5, 50, 'horizontal')).toBeNull();
  });
});
