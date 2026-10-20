const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const fixture = path.join(__dirname, 'fixtures', 'chronos-test.webm');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('entry point loads and the command console responds', async ({ page }) => {
  await expect(page).toHaveTitle(/CHRONOS/i);
  await expect(page.locator('#screen')).toBeVisible();
  await expect(page.locator('#emptyState')).toBeVisible();
  await page.locator('#commandInput').fill('help');
  await page.locator('#commandForm button[type="submit"]').click();
  await expect(page.locator('#commandResult')).toContainText('Available now');
});

test('settings save non-secret preferences but never persist the API key', async ({ page }) => {
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settingsModal')).toHaveClass(/open/);
  await page.locator('#modelSelect').selectOption('none');
  await page.locator('#modelId').fill('example/provider-model');
  await page.locator('#apiKey').fill('test-only-not-a-real-key');
  await page.locator('#saveSettings').click();
  await expect(page.locator('#settingsModal')).not.toHaveClass(/open/);
  expect(await page.evaluate(() => localStorage.getItem('chronos-provider'))).toBe('none');
  expect(await page.evaluate(() => localStorage.getItem('chronos-model-id'))).toBe('example/provider-model');
  expect(await page.locator('#apiKey').inputValue()).toBe('');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('test-only-not-a-real-key');
});

test('local video upload enables playback and timeline navigation', async ({ page }) => {
  expect(fs.existsSync(fixture), 'CI should generate a short WebM test fixture').toBeTruthy();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#fileInput').setInputFiles({
    name: 'chronos-test.webm',
    mimeType: 'video/webm',
    buffer: fs.readFileSync(fixture)
  });
  await expect.poll(() => page.locator('#video').evaluate(v => v.readyState)).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#timeline')).toBeEnabled();
  await expect(page.locator('#resolutionStat')).toContainText('160×90');
  await page.locator('#playBtn').click();
  await expect.poll(() => page.locator('#video').evaluate(v => !v.paused)).toBeTruthy();
  await page.locator('#pauseBtn').click().catch(async () => {
    // This interface uses the same play button to toggle pause.
    await page.locator('#playBtn').click();
  });
  await expect.poll(() => page.locator('#video').evaluate(v => v.paused)).toBeTruthy();
  await page.locator('#timeline').evaluate(el => {
    el.value = String(Math.floor(Number(el.max) * 0.5));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(() => page.locator('#video').evaluate(v => v.currentTime)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('commands safely explain unavailable media and seek after a video is loaded', async ({ page }) => {
  await page.locator('#commandInput').fill('play');
  await page.locator('#commandForm button[type="submit"]').click();
  await expect(page.locator('#commandResult')).toContainText('Load a recording');
  await page.locator('#fileInput').setInputFiles({
    name: 'chronos-test.webm',
    mimeType: 'video/webm',
    buffer: fs.readFileSync(fixture)
  });
  await expect.poll(() => page.locator('#video').evaluate(v => v.readyState)).toBeGreaterThanOrEqual(1);
  await page.locator('#commandInput').fill('jump to 00:01');
  await page.locator('#commandForm button[type="submit"]').click();
  await expect(page.locator('#commandResult')).toContainText('Moved to');
  await expect.poll(() => page.locator('#video').evaluate(v => v.currentTime)).toBeGreaterThan(0);
});

test('responsive viewport remains within the screen at desktop and mobile widths', async ({ page }) => {
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const metrics = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      screenWidth: document.querySelector('#screen').getBoundingClientRect().width
    }));
    expect(metrics.scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.screenWidth).toBeGreaterThan(0);
  }
});
