import { test, expect } from '@playwright/test';

test('F1: mobile bottom navigation leaves the full workspace width available', async ({ page }, info) => {
  await page.goto('/app/playground');
  const sidebar = page.getByLabel('Workspace sidebar');
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(sidebar).toBeVisible();
  await expect(nav.getByRole('link', { name: 'ML Playground' })).toBeVisible();
  const rail = await sidebar.boundingBox();
  const main = await page.locator('#main-content').boundingBox();
  expect(rail).toBeTruthy();
  expect(main).toBeTruthy();
  if (info.project.name === 'mobile') {
    expect(rail.width).toBeGreaterThan(350);
    expect(rail.y).toBeGreaterThan(700);
    expect(main.x).toBeLessThan(5);
    await nav.getByRole('link', { name: 'Neural Studio' }).click();
    await expect(page).toHaveURL(/\/app\/studio$/);
  } else {
    expect(rail.width).toBeLessThan(250);
    expect(rail.x).toBeLessThan(5);
  }
});

test('F1: touching or clicking the dataset invalidates a measured model', async ({ page }, info) => {
  await page.goto('/app/playground');
  const canvas = page.getByRole('img', { name: 'Interactive dataset canvas' });
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: 'Recalculate Model Boundary', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save Run', exact: true })).toBeEnabled();
  const draw = page.getByRole('button', { name: 'Draw New Points' });
  await draw.click();
  await expect(draw).toHaveAttribute('aria-pressed', 'true');
  const rect = await canvas.boundingBox();
  expect(rect.width).toBeGreaterThan(200);
  const x = Math.round(rect.x + rect.width * 0.68);
  const y = Math.round(rect.y + rect.height * 0.65);
  if (info.project.name === 'mobile') await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(page.getByRole('button', { name: 'Save Run', exact: true })).toBeDisabled();
  await expect(page.getByText(/Inputs changed: Boundary is stale reference/)).toBeVisible();
});

test('F1: mobile analysis dock grows to display its metrics cards', async ({ page }, info) => {
  await page.goto('/app/playground');
  await page.getByRole('button', { name: 'Recalculate Model Boundary', exact: true }).click();
  const dock = page.locator('.lab-workspace > footer');
  await expect(dock).toBeVisible();
  if (info.project.name === 'mobile') {
    // F1 uses a semantic button for the header, followed by the metrics content div.
    await expect(dock.getByRole('button', { name: 'Collapse Playground analysis' })).toHaveAttribute('aria-expanded', 'true');
    const content = dock.locator(':scope > div').first();
    await expect(content).toBeVisible();
    const height = await content.evaluate(element => element.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(200);
  }
});
