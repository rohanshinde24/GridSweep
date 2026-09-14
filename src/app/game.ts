export type GameState = 'ready' | 'running' | 'won' | 'lost';

export type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adj: number; // adjacent mines
};

// ------------------------------------------------------------
// Utilities (pure)
// ------------------------------------------------------------

export const clampMines = (rows: number, cols: number, mines: number) => {
  const cap = Math.max(1, Math.floor((rows * cols) / 2));
  return Math.max(1, Math.min(mines, cap));
};

const inBounds = (r: number, c: number, rows: number, cols: number) =>
  r >= 0 && r < rows && c >= 0 && c < cols;

const neighborsOf = (r: number, c: number, rows: number, cols: number) => {
  const res: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr,
        cc = c + dc;
      if (inBounds(rr, cc, rows, cols)) res.push([rr, cc]);
    }
  }
  return res;
};

export const makeEmptyBoard = (rows: number, cols: number): Cell[][] =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adj: 0,
    }))
  );

export const placeMinesFirstSafe = (
  board: Cell[][],
  rows: number,
  cols: number,
  mines: number,
  safeR: number,
  safeC: number
) => {
  const forbidden = new Set<string>();
  forbidden.add(`${safeR},${safeC}`);
  for (const [rr, cc] of neighborsOf(safeR, safeC, rows, cols))
    forbidden.add(`${rr},${cc}`);

  const spots: [number, number][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!forbidden.has(`${r},${c}`)) spots.push([r, c]);

  const count = Math.max(1, Math.min(mines, spots.length));
  // Fisher–Yates shuffle partially for count
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (spots.length - i));
    [spots[i], spots[j]] = [spots[j], spots[i]];
    const [r, c] = spots[i];
    board[r][c].mine = true;
  }

  // adjacency counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let adj = 0;
      for (const [rr, cc] of neighborsOf(r, c, rows, cols))
        if (board[rr][cc].mine) adj++;
      board[r][c].adj = adj;
    }
  }
};

export const floodRevealBFS = (
  board: Cell[][],
  rows: number,
  cols: number,
  r0: number,
  c0: number
): { changed: [number, number][]; hitMine: boolean } => {
  const changed: [number, number][] = [];
  const cell = board[r0][c0];

  if (cell.flagged || cell.revealed) return { changed, hitMine: false };
  if (cell.mine) {
    cell.revealed = true;
    changed.push([r0, c0]);
    return { changed, hitMine: true };
  }

  const q: [number, number][] = [];
  const pushReveal = (r: number, c: number) => {
    const ce = board[r][c];
    if (!ce.revealed && !ce.flagged) {
      ce.revealed = true;
      changed.push([r, c]);
      if (ce.adj === 0) q.push([r, c]);
    }
  };

  pushReveal(r0, c0);
  while (q.length) {
    const [r, c] = q.shift()!;
    for (const [rr, cc] of neighborsOf(r, c, rows, cols)) {
      const nb = board[rr][cc];
      if (!nb.revealed && !nb.flagged && !nb.mine) {
        nb.revealed = true;
        changed.push([rr, cc]);
        if (nb.adj === 0) q.push([rr, cc]);
      }
    }
  }

  return { changed, hitMine: false };
};

export const chordAt = (
  board: Cell[][],
  rows: number,
  cols: number,
  r: number,
  c: number
): { changed: [number, number][]; hitMine: boolean } => {
  const cell = board[r][c];
  if (!cell.revealed || cell.adj <= 0) return { changed: [], hitMine: false };
  const flagged = neighborsOf(r, c, rows, cols).filter(
    ([rr, cc]) => board[rr][cc].flagged
  ).length;
  if (flagged !== cell.adj) return { changed: [], hitMine: false };
  const changed: [number, number][] = [];
  let hitMine = false;
  for (const [rr, cc] of neighborsOf(r, c, rows, cols)) {
    const ce = board[rr][cc];
    if (!ce.revealed && !ce.flagged) {
      if (ce.mine) {
        ce.revealed = true;
        changed.push([rr, cc]);
        hitMine = true;
      } else {
        const res = floodRevealBFS(board, rows, cols, rr, cc);
        changed.push(...res.changed);
        hitMine = hitMine || res.hitMine;
      }
    }
  }
  return { changed, hitMine };
};

export const checkWin = (
  board: Cell[][],
  rows: number,
  cols: number,
  mines: number
) => {
  let revealed = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (board[r][c].revealed) revealed++;
  return revealed === rows * cols - mines;
};

export function revealAllMines(board: Cell[][]) {
  for (const row of board) {
    for (const cell of row) {
      if (cell.mine) cell.revealed = true;
    }
  }
}
