import { test, expect } from '@playwright/test';

test('workspace themes change real surface colors and persist across reloads', async ({ page }) => {
  await page.goto('/app');
  const selector = page.getByRole('combobox', { name: 'Visual theme' });
  const workspace = page.locator('#main-content');
  const sidebar = page.getByLabel('Workspace sidebar');
  const heading = page.locator('header h1');

  await expect(selector).toBeVisible();
  await expect(workspace).toBeVisible();

  const palettes = [
    { id: 'midnight', canvas: 'rgb(8, 13, 24)', sidebar: 'rgb(13, 20, 34)' },
    { id: 'slate', canvas: 'rgb(20, 27, 38)', sidebar: 'rgb(26, 37, 50)' },
    { id: 'forest', canvas: 'rgb(16, 28, 27)', sidebar: 'rgb(20, 39, 35)' },
    { id: 'paper', canvas: 'rgb(243, 245, 244)', sidebar: 'rgb(249, 251, 250)' },
  ];

  for (const { id, canvas, sidebar: panel } of palettes) {
    await selector.selectOption(id);
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    await expect.poll(() => workspace.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(canvas);
    await expect.poll(() => sidebar.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(panel);
  }

  // Light mode also adapts semantic text, not just the background.
  await expect.poll(() => heading.evaluate(el => getComputedStyle(el).color)).toBe('rgb(29, 48, 54)');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('neuroforge-theme-v1'))).toBe('paper');
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);

  await page.reload();
  await expect(selector).toHaveValue('paper');
  await expect.poll(() => workspace.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(243, 245, 244)');

  await selector.selectOption('midnight');
  await expect.poll(() => workspace.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(8, 13, 24)');
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
});
