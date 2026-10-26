/**
 * Where the board sits on screen. Cells keep the original's 16:12 shape (ADR-0009), and the board
 * is scaled uniformly to fit the space left after the HUD (ADR-0006).
 */
export interface BoardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  cellW: number;
  cellH: number;
}

export const CELL_ASPECT = 16 / 12;

export function layoutBoard(cols: number, rows: number, areaX: number, areaY: number, areaW: number, areaH: number): BoardLayout {
  const boardAspect = (cols * CELL_ASPECT) / rows;
  let width = areaW;
  let height = width / boardAspect;
  if (height > areaH) {
    height = areaH;
    width = height * boardAspect;
  }
  return {
    x: areaX + (areaW - width) / 2,
    y: areaY + (areaH - height) / 2,
    width,
    height,
    cellW: width / cols,
    cellH: height / rows,
  };
}

/** The cell under a screen point, or null when the point is off the board. */
export function cellAt(layout: BoardLayout, cols: number, rows: number, px: number, py: number): { x: number; y: number } | null {
  const x = Math.floor((px - layout.x) / layout.cellW);
  const y = Math.floor((py - layout.y) / layout.cellH);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
  return { x, y };
}

/**
 * The cell to give the simulation for a wall placed at a screen point. A wall splits between two
 * cells: half A grows from the given cell and half B from the next one right (or down)
 * (docs/classic-rules.md). Splitting at the cell edge nearest the point, rather than always after the
 * cell under it, puts the split where the player clicked. It stays inside the board, so both halves
 * can start. Null when the point is off the board.
 */
export function wallOriginAt(
  layout: BoardLayout,
  cols: number,
  rows: number,
  px: number,
  py: number,
  orientation: 'horizontal' | 'vertical',
): { x: number; y: number } | null {
  const cell = cellAt(layout, cols, rows, px, py);
  if (!cell) return null;
  // The nearest edge across the wall's direction, as the index of the cell after it.
  const edge = (pos: number, size: number, count: number) => Math.min(Math.max(Math.round(pos / size), 1), count - 1);
  return orientation === 'horizontal'
    ? { x: edge(px - layout.x, layout.cellW, cols) - 1, y: cell.y }
    : { x: cell.x, y: edge(py - layout.y, layout.cellH, rows) - 1 };
}
