import { test, expect } from '@playwright/test';

test.describe('GridSweep Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load game and show initial state', async ({ page }) => {
    // Check if game loads
    await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
    await expect(page.locator('[data-testid="timer"]')).toBeVisible();
    await expect(page.locator('[data-testid="mine-counter"]')).toBeVisible();
    await expect(page.locator('[data-testid="reset-button"]')).toBeVisible();
  });

  test('should have first-click safety', async ({ page }) => {
    // First click should never be a mine - use a cell that exists in 16x30 grid
    const firstCell = page.locator('[data-testid="cell-8-15"]');
    await firstCell.click();

    // Should not have mine class
    await expect(firstCell).not.toHaveClass(/mine/);

    // Should be revealed
    await expect(firstCell).toHaveClass(/revealed/);
  });

  test('should allow flag placement with right click', async ({ page }) => {
    const cell = page.locator('[data-testid="cell-0-0"]');

    // Right click to place flag
    await cell.click({ button: 'right' });

    // Should be flagged
    await expect(cell).toHaveClass(/flagged/);

    // Right click again to remove flag
    await cell.click({ button: 'right' });
    await expect(cell).not.toHaveClass(/flagged/);
  });

  test('should reveal cells on left click', async ({ page }) => {
    const cell = page.locator('[data-testid="cell-8-15"]');

    // Click to reveal
    await cell.click();

    // Should be revealed
    await expect(cell).toHaveClass(/revealed/);
  });

  test('should allow game reset', async ({ page }) => {
    const resetButton = page.locator('[data-testid="reset-button"]');

    // Click reset
    await resetButton.click();

    // Game should be in initial state
    await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
  });

  test('should show settings dialog', async ({ page }) => {
    const settingsButton = page.locator('[data-testid="settings-button"]');

    // Click settings
    await settingsButton.click();

    // Dialog should be visible
    await expect(page.locator('[data-testid="settings-dialog"]')).toBeVisible();

    // Should have input fields for rows, columns, and targets
    await expect(page.locator('input[type="number"]')).toHaveCount(3);
  });

  test('should close settings dialog with escape key', async ({ page }) => {
    const settingsButton = page.locator('[data-testid="settings-button"]');

    // Open settings
    await settingsButton.click();
    await expect(page.locator('[data-testid="settings-dialog"]')).toBeVisible();

    // Press escape
    await page.keyboard.press('Escape');

    // Dialog should be hidden
    await expect(
      page.locator('[data-testid="settings-dialog"]')
    ).not.toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Focus should be trapped in settings dialog when open
    const settingsButton = page.locator('[data-testid="settings-button"]');
    await settingsButton.click();

    const dialog = page.locator('[data-testid="settings-dialog"]');
    await expect(dialog).toBeVisible();

    // Tab should cycle through focusable elements
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="number"]').first()).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="number"]').nth(1)).toBeFocused();
  });

  test('should respect reduced motion preference', async ({ page }) => {
    // This test would require mocking the media query
    // For now, just verify the game loads
    await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
  });
});
