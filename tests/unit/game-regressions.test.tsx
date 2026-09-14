import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import GridSweepApp from '../../src/app/Minesweeper';
import { makeEmptyBoard, placeMinesFirstSafe } from '../../src/app/game';

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function begin() {
  render(<GridSweepApp />);
  // Keep one safe square covered so this deliberately clustered board stays in play.
  fireEvent.contextMenu(screen.getByTestId('cell-1-1'));
  fireEvent.click(screen.getByTestId('cell-4-4'));
}

test('timer ticks preserve every cell and number DOM node without board mutations', () => {
  begin();
  const board = screen.getByTestId('game-board');
  const cell = board.querySelector('[data-number="1"]')!;
  const number = cell.querySelector('span');
  expect(number).not.toBeNull();
  const observer = new MutationObserver(() => {});
  observer.observe(board, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
  act(() => {
    jest.advanceTimersByTime(3000);
  });
  expect(screen.getByTestId('timer')).toHaveTextContent('00:03');
  expect(board.querySelector('[data-number="1"]')).toBe(cell);
  expect(cell.querySelector('span')).toBe(number);
  expect(observer.takeRecords()).toHaveLength(0);
  observer.disconnect();
});

test('direct loss reveals all mines, including flagged mines, and freezes the clock', () => {
  begin();
  fireEvent.contextMenu(screen.getByTestId('cell-0-1'));
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  fireEvent.click(screen.getByTestId('cell-0-0'));
  expect(screen.getByRole('status')).toHaveTextContent(
    'All mines are revealed'
  );
  expect(document.querySelectorAll('.cell.mine.revealed')).toHaveLength(10);
  expect(screen.getByTestId('cell-0-1')).toHaveClass('mine', 'revealed');
  expect(screen.getByTestId('cell-0-0')).toHaveClass('exploded');
  act(() => {
    jest.advanceTimersByTime(3000);
  });
  expect(screen.getByTestId('timer')).toHaveTextContent('00:02');
  fireEvent.click(screen.getByTestId('reset-button'));
  expect(document.querySelectorAll('.cell.revealed')).toHaveLength(0);
  expect(screen.getByTestId('timer')).toHaveTextContent('00:00');
});

test('incorrect chord reveals all mines and identifies an incorrect flag', () => {
  begin();
  // With deterministic placement, row 2 column 3 has three adjacent mines.
  const clue = screen.getByTestId('cell-1-2');
  expect(clue).toHaveTextContent('3');
  fireEvent.contextMenu(screen.getByTestId('cell-0-1'));
  fireEvent.contextMenu(screen.getByTestId('cell-0-2'));
  fireEvent.doubleClick(clue);
  expect(screen.getByRole('status')).toHaveTextContent(
    'All mines are revealed'
  );
  expect(document.querySelectorAll('.cell.mine.revealed')).toHaveLength(10);
  expect(screen.getByTestId('cell-1-1')).toHaveClass('wrong-flag');
});

test('flag mode works on tap and keyboard movement retains focus', () => {
  render(<GridSweepApp />);
  fireEvent.click(screen.getByRole('button', { name: 'Flag' }));
  fireEvent.click(screen.getByTestId('cell-0-0'));
  expect(screen.getByTestId('cell-0-0')).toHaveClass('flagged');
  expect(screen.getByTestId('mine-counter')).toHaveTextContent('09');
  fireEvent.keyDown(screen.getByTestId('cell-0-0'), { key: 'd' });
  expect(screen.getByTestId('cell-0-1')).toHaveFocus();
});

test('first move keeps its neighbors safe with the exact configured mine count', () => {
  for (const [rows, cols, mines] of [
    [5, 5, 12],
    [9, 9, 10],
    [16, 16, 40],
    [16, 30, 99],
    [30, 30, 450],
  ]) {
    const board = makeEmptyBoard(rows, cols);
    const r = Math.floor(rows / 2),
      c = Math.floor(cols / 2);
    placeMinesFirstSafe(board, rows, cols, mines, r, c);
    expect(board.flat().filter(cell => cell.mine)).toHaveLength(mines);
    expect(board[r][c].mine).toBe(false);
    expect(board[r][c].adj).toBe(0);
  }
});
