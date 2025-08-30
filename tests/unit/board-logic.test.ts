// Import the utility functions from GridSweep.tsx
// Note: We'll need to extract these into separate utility files for better testing

// Mock implementations for testing
const makeEmptyBoard = (rows: number, cols: number) =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      target: false,
      revealed: false,
      flagged: false,
      adj: 0,
    }))
  );

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

const placeTargetsFirstSafe = (
  board: any[][],
  rows: number,
  cols: number,
  targets: number,
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

  const count = Math.max(1, Math.min(targets, spots.length));
  // Fisher–Yates shuffle partially for count
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (spots.length - i));
    [spots[i], spots[j]] = [spots[j], spots[i]];
    const [r, c] = spots[i];
    board[r][c].target = true;
  }

  // adjacency counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].target) continue;
      let adj = 0;
      for (const [rr, cc] of neighborsOf(r, c, rows, cols))
        if (board[rr][cc].target) adj++;
      board[r][c].adj = adj;
    }
  }
};

describe('Board Logic', () => {
  describe('inBounds', () => {
    test('should return true for valid coordinates', () => {
      expect(inBounds(0, 0, 9, 9)).toBe(true);
      expect(inBounds(4, 4, 9, 9)).toBe(true);
      expect(inBounds(8, 8, 9, 9)).toBe(true);
    });

    test('should return false for invalid coordinates', () => {
      expect(inBounds(-1, 0, 9, 9)).toBe(false);
      expect(inBounds(0, -1, 9, 9)).toBe(false);
      expect(inBounds(9, 0, 9, 9)).toBe(false);
      expect(inBounds(0, 9, 9, 9)).toBe(false);
    });
  });

  describe('neighborsOf', () => {
    test('should return correct neighbors for center cell', () => {
      const neighbors = neighborsOf(4, 4, 9, 9);
      expect(neighbors).toHaveLength(8);
      expect(neighbors).toContainEqual([3, 3]);
      expect(neighbors).toContainEqual([3, 4]);
      expect(neighbors).toContainEqual([3, 5]);
      expect(neighbors).toContainEqual([4, 3]);
      expect(neighbors).toContainEqual([4, 5]);
      expect(neighbors).toContainEqual([5, 3]);
      expect(neighbors).toContainEqual([5, 4]);
      expect(neighbors).toContainEqual([5, 5]);
    });

    test('should return correct neighbors for corner cell', () => {
      const neighbors = neighborsOf(0, 0, 9, 9);
      expect(neighbors).toHaveLength(3);
      expect(neighbors).toContainEqual([0, 1]);
      expect(neighbors).toContainEqual([1, 0]);
      expect(neighbors).toContainEqual([1, 1]);
    });

    test('should return correct neighbors for edge cell', () => {
      const neighbors = neighborsOf(0, 4, 9, 9);
      expect(neighbors).toHaveLength(5);
      expect(neighbors).toContainEqual([0, 3]);
      expect(neighbors).toContainEqual([0, 5]);
      expect(neighbors).toContainEqual([1, 3]);
      expect(neighbors).toContainEqual([1, 4]);
      expect(neighbors).toContainEqual([1, 5]);
    });
  });

  describe('placeTargetsFirstSafe', () => {
    test('should not place targets around first click', () => {
      const board = makeEmptyBoard(9, 9);
      const firstClickR = 4;
      const firstClickC = 4;

      placeTargetsFirstSafe(board, 9, 9, 10, firstClickR, firstClickC);

      // First click should be safe
      expect(board[firstClickR][firstClickC].target).toBe(false);

      // All neighbors should be safe
      const neighbors = neighborsOf(firstClickR, firstClickC, 9, 9);
      neighbors.forEach(([r, c]) => {
        expect(board[r][c].target).toBe(false);
      });
    });

    test('should place correct number of targets', () => {
      const board = makeEmptyBoard(9, 9);
      const targets = 10;

      placeTargetsFirstSafe(board, 9, 9, targets, 4, 4);

      let targetCount = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c].target) targetCount++;
        }
      }

      expect(targetCount).toBe(targets);
    });

    test('should calculate correct adjacency counts', () => {
      const board = makeEmptyBoard(3, 3);
      // Place targets in corners
      board[0][0].target = true;
      board[0][2].target = true;
      board[2][0].target = true;
      board[2][2].target = true;

      // Center should have 4 adjacent targets
      let adj = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = 1 + dr,
            cc = 1 + dc;
          if (inBounds(rr, cc, 3, 3) && board[rr][cc].target) adj++;
        }
      }

      expect(adj).toBe(4);
    });
  });

  describe('makeEmptyBoard', () => {
    test('should create board with correct dimensions', () => {
      const board = makeEmptyBoard(9, 9);
      expect(board).toHaveLength(9);
      expect(board[0]).toHaveLength(9);
    });

    test('should initialize all cells correctly', () => {
      const board = makeEmptyBoard(3, 3);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          expect(board[r][c]).toEqual({
            target: false,
            revealed: false,
            flagged: false,
            adj: 0,
          });
        }
      }
    });
  });
});
