import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseScenario } from '../../src/sim/schema';

const fixture = parseScenario(
  JSON.parse(readFileSync(new URL('../../scenarios/single-amr.json', import.meta.url), 'utf8')),
);

test('renders the real warehouse and transports pallets using engine time', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const canvas = page.locator('canvas[aria-label^="3D 창고"]');
  await expect(canvas).toHaveAttribute('data-renderer-ready', 'true');
  expect(Number(await canvas.getAttribute('data-triangles'))).toBeGreaterThan(1000);
  await expect(page.getByTestId('completed-count')).toHaveText('0 / 3');
  await page.getByRole('button', { name: '10초 전진', exact: true }).click();
  await expect(page.getByTestId('sim-time')).toContainText('00:10');
  await expect(canvas).toHaveAttribute('data-robot-x', '6');
  await expect(canvas).toHaveAttribute('data-robot-z', '12');
  await page.getByRole('button', { name: '10초 전진', exact: true }).click();
  await expect(page.getByTestId('carrying')).toHaveText('MOVE-001');
  await expect(canvas).toHaveAttribute('data-pallet-owners', 'robot,pickup,pickup');
  await page.screenshot({ path: 'artifacts/warehouse-transport.png', fullPage: true });
  await page.getByRole('button', { name: '끝까지 계산', exact: true }).click();
  await expect(page.getByTestId('completed-count')).toHaveText('3 / 3');
  await expect(page.getByTestId('distance')).toHaveText('146 m');
  await expect(canvas).toHaveAttribute('data-pallet-owners', 'dropoff,dropoff,dropoff');
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.getByTestId('completed-count')).toHaveText('0 / 3');
  await expect(canvas).toHaveAttribute('data-robot-x', '3');
  await page.getByRole('button', { name: '위에서', exact: true }).click();
  await expect(page.getByRole('button', { name: '위에서', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '로봇 추적', exact: true }).click();
  await page.getByRole('button', { name: '재생', exact: true }).click();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: '일시정지', exact: true }).click();
  expect(Number(await canvas.getAttribute('data-robot-z'))).toBeGreaterThan(3);
  await page.screenshot({ path: 'artifacts/warehouse-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('validates scenario files and preserves the active scene on errors', async ({ page }) => {
  await page.goto('/');
  const file = page.getByLabel('시나리오 JSON 파일');
  await file.setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole('alert')).toContainText('시나리오 오류');
  await expect(page.getByTestId('completed-count')).toHaveText('0 / 3');
  await file.setInputFiles({
    name: 'good.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...fixture, name: '가져온 창고 시나리오' })),
  });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('가져온 창고 시나리오', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-renderer-ready', 'true');
});

test('exports a scenario and recalculates physical travel speed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-renderer-ready', 'true');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '시나리오 저장', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('single-amr.json');
  await page.getByLabel('로봇 이동 속도').fill('1.5');
  await page.getByRole('button', { name: '적용·초기화', exact: true }).click();
  await expect(page.getByTestId('sim-time')).toContainText('/ 01:58');
  await page.getByRole('button', { name: '끝까지 계산', exact: true }).click();
  await expect(page.getByTestId('completed-count')).toHaveText('3 / 3');
  await expect(page.getByTestId('distance')).toHaveText('146 m');
});

test('keeps the 3D scene and controls usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-renderer-ready', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: '10초 전진', exact: true }).click();
  await expect(page.getByTestId('sim-time')).toContainText('00:10');
  await page.screenshot({ path: 'artifacts/warehouse-mobile.png', fullPage: true });
});
