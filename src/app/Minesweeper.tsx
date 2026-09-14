'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import {
  Cell,
  GameState,
  clampMines,
  makeEmptyBoard,
  placeMinesFirstSafe,
  floodRevealBFS,
  chordAt,
  checkWin,
  revealAllMines,
} from './game';

// Compact board symbols carry game state; controls use explicit text labels.
function MineMark() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="4" fill="currentColor" />
      <path
        d="M10 2v4m0 8v4M2 10h4m8 0h4M4 4l3 3m6 6 3 3M4 16l3-3m6-6 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function FlagMark() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M5 17V3m0 0h10l-3 4 3 4H5M2 17h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Config = { rows: number; cols: number; mines: number };
const PRESETS = [
  { name: 'Beginner', rows: 9, cols: 9, mines: 10 },
  { name: 'Intermediate', rows: 16, cols: 16, mines: 40 },
  { name: 'Expert', rows: 16, cols: 30, mines: 99 },
];

// The clock owns its updates so a timer tick never rerenders the board.
function GameClock({ running }: { running: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const interval = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      250
    );
    return () => window.clearInterval(interval);
  }, [running]);
  return (
    <span data-testid="timer">
      {Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0')}
      :{(seconds % 60).toString().padStart(2, '0')}
    </span>
  );
}

// Stable component identity and plain text keep revealed numbers still.
function CellView({
  cell,
  r,
  c,
  lost,
  exploded,
  focused,
  onReveal,
  onFlag,
  onChord,
  onFocus,
}: {
  cell: Cell;
  r: number;
  c: number;
  lost: boolean;
  exploded: boolean;
  focused: boolean;
  onReveal: () => void;
  onFlag: () => void;
  onChord: () => void;
  onFocus: () => void;
}) {
  const wrongFlag = lost && cell.flagged && !cell.mine;
  const description = cell.revealed
    ? cell.mine
      ? 'mine'
      : cell.adj
        ? `${cell.adj} adjacent mines`
        : 'empty'
    : cell.flagged
      ? 'flagged'
      : 'covered';
  return (
    <button
      type="button"
      tabIndex={focused ? 0 : -1}
      onFocus={onFocus}
      aria-label={`Row ${r + 1}, column ${c + 1}: ${wrongFlag ? 'incorrect flag' : description}`}
      data-testid={`cell-${r}-${c}`}
      data-number={cell.revealed && !cell.mine ? cell.adj : undefined}
      className={`cell ${cell.revealed ? 'revealed' : 'covered'} ${cell.flagged ? 'flagged' : ''} ${cell.revealed && cell.mine ? 'mine' : ''} ${exploded ? 'exploded' : ''} ${wrongFlag ? 'wrong-flag' : ''}`}
      onClick={onReveal}
      onContextMenu={e => {
        e.preventDefault();
        onFlag();
      }}
      onDoubleClick={onChord}
    >
      {cell.revealed && cell.mine ? (
        <MineMark />
      ) : wrongFlag ? (
        <span aria-hidden="true">×</span>
      ) : cell.flagged ? (
        <FlagMark />
      ) : cell.revealed && cell.adj > 0 ? (
        <span>{cell.adj}</span>
      ) : null}
    </button>
  );
}

function CustomDialog({
  config,
  onClose,
  onApply,
}: {
  config: Config;
  onClose: () => void;
  onApply: (config: Config) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(config);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const cap = Math.floor((draft.rows * draft.cols) / 2);
  return (
    <dialog
      ref={dialog}
      className="settings-dialog"
      aria-labelledby="settings-title"
      data-testid="settings-dialog"
      onCancel={onClose}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          onApply({
            ...draft,
            mines: clampMines(draft.rows, draft.cols, draft.mines),
          });
        }}
      >
        <div className="dialog-heading">
          <div>
            <h2 id="settings-title">Custom game</h2>
          </div>
          <button
            type="button"
            className="text-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="muted">Choose a board from 5 × 5 to 30 × 30.</p>
        <div className="fields">
          {(['rows', 'cols', 'mines'] as const).map(field => (
            <label key={field}>
              {field === 'cols'
                ? 'Columns'
                : field === 'rows'
                  ? 'Rows'
                  : 'Mines'}
              <input
                type="number"
                required
                min={field === 'mines' ? 1 : 5}
                max={field === 'mines' ? cap : 30}
                value={draft[field]}
                onChange={e =>
                  setDraft({
                    ...draft,
                    [field]:
                      e.target.value === '' ? '' : Number(e.target.value),
                  } as Config)
                }
              />
            </label>
          ))}
        </div>
        <p className="muted small">
          Up to {cap} mines. Your first square and its neighbors are always
          safe.
        </p>
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Start game
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function GridSweepApp() {
  const [config, setConfig] = useState<Config>(PRESETS[0]);
  const [board, setBoard] = useState<Cell[][]>(() => makeEmptyBoard(9, 9));
  const [state, setState] = useState<GameState>('ready');
  const [gameId, setGameId] = useState(0);
  const [mode, setMode] = useState<'reveal' | 'flag'>('reveal');
  const [dark, setDark] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const [exploded, setExploded] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const customButton = useRef<HTMLButtonElement>(null);
  const { rows, cols, mines } = config;
  const flags = board.flat().filter(cell => cell.flagged).length;
  const cleared = board
    .flat()
    .filter(cell => cell.revealed && !cell.mine).length;
  const totalSafe = rows * cols - mines;
  const difficulty =
    PRESETS.find(p => p.rows === rows && p.cols === cols && p.mines === mines)
      ?.name ?? 'Custom';
  const finished = state === 'won' || state === 'lost';

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gridsweep-theme');
      setDark(
        saved
          ? saved === 'dark'
          : window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    } catch {
      /* Theme still works without storage. */
    }
  }, []);

  const toggleTheme = () => {
    setDark(!dark);
    try {
      localStorage.setItem('gridsweep-theme', dark ? 'light' : 'dark');
    } catch {
      /* Storage is optional. */
    }
  };
  const reset = (next: Config = config) => {
    setConfig(next);
    setBoard(makeEmptyBoard(next.rows, next.cols));
    setState('ready');
    setGameId(id => id + 1);
    setFocus([0, 0]);
    setExploded(null);
    setMode('reveal');
  };
  const flag = (r: number, c: number) => {
    if (finished || board[r][c].revealed) return;
    const next = board.map(row => row.map(cell => ({ ...cell })));
    next[r][c].flagged = !next[r][c].flagged;
    setBoard(next);
  };
  const reveal = (r: number, c: number, chord = false) => {
    if (finished || board[r][c].flagged || (chord && state === 'ready')) return;
    if (!chord && board[r][c].revealed) return;
    const next = board.map(row => row.map(cell => ({ ...cell })));
    if (state === 'ready') placeMinesFirstSafe(next, rows, cols, mines, r, c);
    const result = chord
      ? chordAt(next, rows, cols, r, c)
      : floodRevealBFS(next, rows, cols, r, c);
    if (!result.changed.length) return;
    if (result.hitMine) {
      const hit = result.changed.find(([rr, cc]) => next[rr][cc].mine);
      if (hit) setExploded(`${hit[0]},${hit[1]}`);
      revealAllMines(next);
      setState('lost');
    } else setState(checkWin(next, rows, cols, mines) ? 'won' : 'running');
    setBoard(next);
  };
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = e => {
    const [r, c] = focus;
    const key = e.key.toLowerCase();
    let target: [number, number] = [r, c];
    if (['arrowleft', 'a'].includes(key)) target = [r, Math.max(0, c - 1)];
    else if (['arrowright', 'd'].includes(key))
      target = [r, Math.min(cols - 1, c + 1)];
    else if (['arrowup', 'w'].includes(key)) target = [Math.max(0, r - 1), c];
    else if (['arrowdown', 's'].includes(key))
      target = [Math.min(rows - 1, r + 1), c];
    else if (key === 'f') {
      e.preventDefault();
      flag(r, c);
      return;
    } else if (key === 'c') {
      e.preventDefault();
      reveal(r, c, true);
      return;
    } else if (key === ' ' || key === 'enter') {
      e.preventDefault();
      reveal(r, c);
      return;
    } else return;
    e.preventDefault();
    setFocus(target);
    grid.current
      ?.querySelector<HTMLButtonElement>(
        `[data-testid="cell-${target[0]}-${target[1]}"]`
      )
      ?.focus();
  };
  const closeSettings = () => {
    setSettingsOpen(false);
    customButton.current?.focus();
  };

  return (
    <main className={`gridsweep ${dark ? 'theme-dark' : ''}`}>
      <div className="app-shell">
        <header className="site-header">
          <div>
            <h1 className="brand">
              <span className="brand-mark" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              GridSweep
            </h1>
            <p className="game-description">
              Reveal every safe square. Numbers count neighboring mines.
            </p>
          </div>
          <button
            className="theme-button"
            onClick={toggleTheme}
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
          >
            {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
        </header>
        <section className="play-area" aria-label="Play GridSweep">
          <div className="game-options">
            <div className="difficulty-tabs" aria-label="Difficulty">
              {PRESETS.map(p => (
                <button
                  key={p.name}
                  className={difficulty === p.name ? 'active' : ''}
                  aria-pressed={difficulty === p.name}
                  onClick={() => reset(p)}
                >
                  {p.name}
                </button>
              ))}
              <button
                ref={customButton}
                className={difficulty === 'Custom' ? 'active' : ''}
                aria-pressed={difficulty === 'Custom'}
                data-testid="settings-button"
                onClick={() => setSettingsOpen(true)}
              >
                Custom
              </button>
            </div>
            <span className="board-size">
              {rows} × {cols} <span> / </span> {mines} mines
            </span>
          </div>
          <div className="game-card">
            <div className="game-toolbar">
              <div className="stats">
                <div className="stat">
                  <div>
                    <span className="stat-label">MINES LEFT</span>
                    <strong data-testid="mine-counter">
                      {String(mines - flags).padStart(2, '0')}
                    </strong>
                  </div>
                </div>
                <div className="stat">
                  <div>
                    <span className="stat-label">TIME</span>
                    <strong>
                      <GameClock key={gameId} running={state === 'running'} />
                    </strong>
                  </div>
                </div>
              </div>
              <button
                className="primary-button"
                data-testid="reset-button"
                onClick={() => reset()}
              >
                <span>New game</span>
              </button>
            </div>
            <div className={`game-status ${state}`} role="status">
              {state === 'lost' ? (
                <>
                  <span>
                    <strong>Mine hit.</strong> All mines are revealed. Select
                    New game to try again.
                  </span>
                </>
              ) : state === 'won' ? (
                <>
                  <span>
                    <strong>Board cleared.</strong> Every safe square is clear.
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {state === 'ready'
                      ? 'Start anywhere. Your first move is always safe.'
                      : 'Reveal safe squares or flag suspected mines.'}
                  </span>
                </>
              )}
            </div>
            <div className="board-scroll">
              <div
                ref={grid}
                className="board"
                aria-label="GridSweep board"
                data-testid="game-board"
                onKeyDown={onKeyDown}
                style={{
                  gridTemplateColumns: `repeat(${cols}, var(--cell-size))`,
                }}
              >
                {board.map((row, r) =>
                  row.map((cell, c) => (
                    <CellView
                      key={`${r}-${c}`}
                      cell={cell}
                      r={r}
                      c={c}
                      lost={state === 'lost'}
                      exploded={exploded === `${r},${c}`}
                      focused={focus[0] === r && focus[1] === c}
                      onFocus={() => setFocus([r, c])}
                      onReveal={() =>
                        mode === 'flag' ? flag(r, c) : reveal(r, c)
                      }
                      onFlag={() => flag(r, c)}
                      onChord={() => reveal(r, c, true)}
                    />
                  ))
                )}
              </div>
            </div>
            <div className="board-footer">
              <div className="input-mode" aria-label="Tap action">
                <button
                  className={mode === 'reveal' ? 'active' : ''}
                  aria-pressed={mode === 'reveal'}
                  onClick={() => setMode('reveal')}
                >
                  Reveal
                </button>
                <button
                  className={mode === 'flag' ? 'active' : ''}
                  aria-pressed={mode === 'flag'}
                  onClick={() => setMode('flag')}
                >
                  Flag
                </button>
              </div>
              <span className="progress-label">
                <strong>{cleared}</strong> / {totalSafe} cleared
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Safe squares cleared"
              aria-valuemin={0}
              aria-valuemax={totalSafe}
              aria-valuenow={cleared}
            >
              <div style={{ width: `${(cleared / totalSafe) * 100}%` }} />
            </div>
          </div>
          <details className="how-to">
            <summary>
              How to play <span>Rules & keyboard shortcuts</span>
            </summary>
            <div className="instructions">
              <div>
                <h3>Follow the numbers</h3>
                <p>
                  Each number counts mines in the eight surrounding squares.
                  Reveal every safe square to win; flags help you mark suspected
                  mines.
                </p>
              </div>
              <div>
                <h3>Choose your move</h3>
                <p>
                  Click or tap to reveal. Right-click to flag, or use the Reveal
                  / Flag switch above. Double-click a number when its
                  neighboring flags match it to reveal the remaining neighbors
                  (a chord). Incorrect flags can trigger a mine.
                </p>
              </div>
              <div>
                <h3>Keep your hands on the keys</h3>
                <p>
                  <kbd>↑ ↓ ← →</kbd> or <kbd>W A S D</kbd> move.{' '}
                  <kbd>Space</kbd> / <kbd>Enter</kbd> reveal, <kbd>F</kbd>{' '}
                  flags, and <kbd>C</kbd> chords.
                </p>
              </div>
            </div>
          </details>
        </section>
      </div>
      {settingsOpen && (
        <CustomDialog
          config={config}
          onClose={closeSettings}
          onApply={next => {
            reset(next);
            closeSettings();
          }}
        />
      )}
    </main>
  );
}
