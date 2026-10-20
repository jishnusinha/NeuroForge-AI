import { test, expect } from '@playwright/test';

test('F1: command palette is navigable, announces choices, contains focus and restores launcher', async ({ page }) => {
  await page.goto('/app');
  const launcher = page.getByRole('button', { name: 'Command Palette (Ctrl+K)' });
  await expect(launcher).toBeVisible();
  await launcher.focus();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Quick commands' });
  await expect(dialog).toBeVisible();

  const input = dialog.getByRole('combobox', { name: 'Search commands' });
  await expect(input).toBeFocused();
  await input.fill('Neural');
  const option = dialog.getByRole('option', { name: /Neural Network Studio/ });
  await expect(option).toBeVisible();
  await expect(option).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByRole('status')).toContainText('Selected: Neural Network Studio');
  await page.keyboard.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', /ws-studio|exp-xor/);

  await input.fill('nothing-matches-neuroforge');
  await expect(dialog.getByRole('status')).toContainText('No matching commands');
  await expect(dialog.getByRole('option')).toHaveCount(0);

  await input.fill('Neural Network Studio');
  await input.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('option', { name: /Neural Network Studio/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(launcher).toBeFocused();

  await page.keyboard.press('Control+k');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('option', { name: /Neural Network Studio/ }).click();
  await expect(page).toHaveURL(/\/app\/studio$/);
});

test('F1: skip control focuses main workspace without altering the router location', async ({ page }) => {
  await page.goto('/app');
  const skip = page.getByRole('button', { name: 'Skip to main content' });
  await skip.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page).toHaveURL(/\/app$/);
});

test('F1: palette closes on backdrop without activating underlying links', async ({ page }) => {
  await page.goto('/app');
  // Use the visible launcher: this scenario tests backdrop dismissal rather than shortcut focus.
  await page.getByRole('button', { name: 'Command Palette (Ctrl+K)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Quick commands' });
  await expect(dialog).toBeVisible();
  await page.mouse.click(3, 3);
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
});
