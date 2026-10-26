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
