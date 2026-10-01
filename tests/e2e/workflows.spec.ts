import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Review } from '../../lib/types';
import { narrowPolicy } from '../../lib/types';

test('deployment serves security headers and static assets', async ({ request }) => {
  const response = await request.get('/');
  expect(response.ok()).toBe(true);
  const headers = response.headers();
  expect(headers['x-powered-by']).toBeUndefined();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  if (process.env.CHAINPATCH_E2E_MODE !== 'development') {
    expect(headers['content-security-policy']).not.toContain("'unsafe-eval'");
  }
  expect((await request.get('/favicon.svg')).ok()).toBe(true);
  const html = await response.text();
  const asset = html.match(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/);
  expect(asset).not.toBeNull();
  expect((await request.get(asset![1].replaceAll('&amp;', '&'))).ok()).toBe(true);
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect((await health.json()).status).toBe('ok');
});

test('workspace verification changes when the applied policy stops passing', async ({ page, request }) => {
  const demo = await (await request.get('/api/reviews/demo')).json();
  const created = await request.post('/api/reviews', { data: {
    title: 'Current policy verification regression',
    current: demo.current,
    proposed: demo.proposed,
    installed: demo.installed,
  } });
  expect(created.ok()).toBe(true);
  const review = await created.json();
  expect((await request.post(`/api/reviews/${review.id}/patch`, { data: narrowPolicy })).ok()).toBe(true);
  await page.goto('/workspace');
  const row = page.locator(`a.review-row[href="/review/${review.id}"]`);
  await expect(row).toContainText('Repair verified');
  expect((await request.post(`/api/reviews/${review.id}/patch`, { data: { ...narrowPolicy, action: 'disable' } })).ok()).toBe(true);
  await page.reload();
  await expect(row).not.toContainText('Repair verified');
  await page.getByRole('button', { name: 'Verified repairs' }).click();
  await expect(row).toHaveCount(0);
});

async function screenshot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
}

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

for (const host of ['localhost', '127.0.0.1']) {
  test(`judge lab runs user input through all stages at ${host}`, async ({ page }, info) => {
    await page.goto(`http://${host}:3101/playground`);
    await page.getByRole('textbox', { name: 'Private report', exact: true }).fill('Fictional confidential judge code CUSTOM-789');
    await page.getByRole('textbox', { name: 'Approved public summary', exact: true }).fill('The judge approved this public message.');
    await page.getByRole('button', { name: 'Run full presentation', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Repair verified for these inputs');
    await page.getByRole('button', { name: 'Pause presentation' }).click();
    const stage = page.locator('.presentation-outcome');
    await expect(stage).toContainText('The judge approved this public message.');
    await page.getByRole('button', { name: '02 After the update' }).click();
    await expect(stage).toContainText('CUSTOM-789');
    await page.getByRole('button', { name: '03 Repair: private source' }).click();
    await expect(stage).toContainText('Nothing published in this run.');
    await noPageOverflow(page);
    await screenshot(page, info, `hands-on-lab-${host}`);
    await page.getByLabel('Choose the publishing rule').selectOption('disable');
    await expect(page.getByText('Inputs have changed.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Run full presentation', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Repair not verified');
    await page.getByRole('link', { name: 'Open full review' }).click();
    await page.getByRole('tab', { name: 'Replay evidence' }).click();
    await expect(page.locator('.destination-panel')).toContainText('No document published.');
  });
}

test('automatic presentation advances to the last stage and can restart', async ({ page }) => {
  await page.goto('/playground');
  await page.getByRole('button', { name: 'Run full presentation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause presentation' })).toBeVisible();
  const last = page.getByRole('button', { name: '04 Repair: normal task' });
  await expect(last).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Play presentation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play presentation', exact: true }).click();
  await expect(page.getByRole('button', { name: '01 Before the update' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Pause presentation' }).click();
});

async function applyPolicy(page: Page, name: string) {
  await page.getByRole('button', { name, exact: false }).click();
  await page.getByRole('button', { name: 'Apply & test both paths' }).click();
  await expect(page.getByText('Policy applied. Both the unsafe probe and the legitimate task were rerun.')).toBeVisible();
}

async function downloadReport(page: Page, info: TestInfo, name: 'JSON' | 'Markdown') {
  const event = page.waitForEvent('download');
  await page.getByRole('link', { name, exact: true }).click();
  const download = await event;
  const extension = name === 'JSON' ? 'json' : 'md';
  expect(download.suggestedFilename()).toMatch(new RegExp(`^chainpatch-.+\\.${extension}$`));
  expect(await download.failure()).toBeNull();
  const file = info.outputPath(download.suggestedFilename());
  await download.saveAs(file);
  return readFile(file, 'utf8');
}

test('landing, safe baseline, exposed update, narrow repair, persisted evidence and downloads', async ({ page, request }, info) => {
  expect((await request.delete('/api/reviews/demo')).ok()).toBe(true);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A small update.');
  await noPageOverflow(page);
  await screenshot(page, info, 'landing');
  await page.getByRole('link', { name: 'Run the interactive demo' }).click();
  await expect(page).toHaveURL('/review/demo');
  await page.getByRole('button', { name: 'Before Update' }).click();
  const destination = page.locator('.destination-panel');
  await expect(destination.getByRole('heading', { name: 'An approved update is public.' })).toBeVisible();
  await expect(destination).not.toContainText('paper-moon-47');
  await page.getByRole('tab', { name: 'Skill diff' }).click();
  await expect(page.getByRole('heading', { name: 'Small diff. Different behavior.' })).toBeVisible();
  await expect(page.locator('.code-line.added').filter({ hasText: 'private' }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Interaction map' }).click();
  await page.getByRole('button', { name: 'After Update', exact: false }).click();
  await expect(destination.getByRole('heading', { name: 'An internal report is public.' })).toBeVisible();
  await expect(destination).toContainText('paper-moon-47');
  await noPageOverflow(page);
  await screenshot(page, info, 'after-update-exposure');
  await page.getByRole('tab', { name: 'Patch Lab' }).click();
  await applyPolicy(page, 'Allow approved summaries only');
  await expect(page.locator('.test-card').filter({ hasText: 'Unsafe source probe' })).toContainText('PASS');
  await expect(page.locator('.test-card').filter({ hasText: 'Legitimate summary task' })).toContainText('PASS');
  await expect(page.getByText('Narrow repair verified', { exact: true })).toBeVisible();
  await noPageOverflow(page);
  await screenshot(page, info, 'narrow-repair');
  await page.getByRole('button', { name: 'Inspect After Fix' }).click();
  await expect(destination.getByRole('heading', { name: 'No document published.' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Replay task' }).selectOption('legitimate');
  await page.getByRole('button', { name: 'Run replay' }).click();
  await expect(destination.getByRole('heading', { name: 'An approved update is public.' })).toBeVisible();
  await expect(destination).not.toContainText('paper-moon-47');
  await page.reload();
  await expect(page.getByText('Narrow repair verified', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Evidence report' }).click();
  const json = JSON.parse(await downloadReport(page, info, 'JSON')) as Review & { schemaVersion: number; limitations: string };
  expect(json.schemaVersion).toBe(1);
  expect(json.policy?.allowedInputs).toEqual(['approved-summary']);
  expect(json.runs).toEqual(expect.arrayContaining([
    expect.objectContaining({ scenario: 'before', outcome: 'summary-published' }),
    expect.objectContaining({ scenario: 'after', outcome: 'private-exposed' }),
    expect.objectContaining({ scenario: 'fixed', task: 'unsafe-probe', outcome: 'blocked', destination: [] }),
    expect.objectContaining({ scenario: 'fixed', task: 'legitimate', outcome: 'summary-published' }),
  ]));
  expect(json.limitations).toContain('Fictional');
  const markdown = await downloadReport(page, info, 'Markdown');
  expect(markdown).toContain('# ChainPatch evidence report');
  expect(markdown).toContain('Outcome: private-exposed');
  expect(markdown).toContain('Outcome: blocked');
  expect(markdown).toContain('## Limits');
  await screenshot(page, info, 'evidence-report');
  expect(errors).toEqual([]);
});

test('alternative policies and invalid JSON cannot masquerade as a useful repair', async ({ page, request }, info) => {
  expect((await request.delete('/api/reviews/demo')).ok()).toBe(true);
  await page.goto('/review/demo');
  await page.getByRole('tab', { name: 'Patch Lab' }).click();
  await page.getByRole('textbox', { name: 'Permission rule JSON' }).fill('{not JSON');
  await page.getByRole('button', { name: 'Apply & test both paths' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'valid JSON' })).toBeVisible();
  await applyPolicy(page, 'Require human approval');
  await expect(page.locator('.test-card').filter({ hasText: 'Unsafe source probe' })).toContainText('FAIL');
  await expect(page.locator('.test-card').filter({ hasText: 'Legitimate summary task' })).toContainText('FAIL');
  await expect(page.getByText('Narrow repair verified', { exact: true })).toHaveCount(0);
  await applyPolicy(page, 'Disable publication');
  await expect(page.locator('.test-card').filter({ hasText: 'Unsafe source probe' })).toContainText('PASS');
  await expect(page.locator('.test-card').filter({ hasText: 'Legitimate summary task' })).toContainText('FAIL');
  await expect(page.getByText('Narrow repair verified', { exact: true })).toHaveCount(0);
  await screenshot(page, info, 'disabled-publication-fails-legitimate-task');
  await applyPolicy(page, 'Allow approved summaries only');
  await expect(page.getByText('Narrow repair verified', { exact: true })).toBeVisible();
});

test('judge walkthrough executes and persists runs and exposes an overbroad repair', async ({ page, request }, info) => {
  expect((await request.delete('/api/reviews/demo')).ok()).toBe(true);
  await page.goto('/review/demo');
  const guide = page.getByRole('region', { name: 'Show the judges how ChainPatch works.' });
  await expect(guide.getByRole('button', { name: '4. Publish with the repair' })).toBeDisabled();
  await guide.getByRole('button', { name: '1. Publish the safe summary' }).click();
  await expect(guide.getByRole('status')).toContainText('Latest run: Approved summary published');
  await guide.getByRole('button', { name: '2. Run the unsafe update' }).click();
  await expect(guide.getByRole('status')).toContainText('Latest run: Private source exposed');
  await expect(page.locator('.destination-panel')).toContainText('paper-moon-47');
  await guide.getByRole('button', { name: '3. Apply the narrow repair' }).click();
  await expect(guide.getByRole('status')).toContainText('private source blocked; normal summary published');
  await guide.getByRole('button', { name: '4. Publish with the repair' }).click();
  await expect(guide.getByRole('status')).toContainText('Latest run: Approved summary published');
  await expect(page.locator('.destination-panel')).not.toContainText('paper-moon-47');
  await guide.getByRole('button', { name: 'Try blocking everything' }).click();
  await expect(guide.getByRole('status')).toContainText('normal summary not published');
  await expect(page.getByText('Narrow repair verified', { exact: true })).toHaveCount(0);
  await guide.getByRole('button', { name: '3. Apply the narrow repair' }).click();
  await expect(page.getByText('Narrow repair verified', { exact: true })).toBeVisible();
  await page.reload();
  await expect(guide).toContainText('9 saved runs');
  const saved = await (await request.get('/api/reviews/demo')).json() as Review;
  expect(saved.runs).toHaveLength(9);
  expect(saved.runs.filter(run => run.policy?.action === 'disable')).toHaveLength(2);
  await noPageOverflow(page);
  await screenshot(page, info, 'judge-walkthrough');
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await expect(guide).toContainText('0 saved runs');
  await expect(guide.getByRole('button', { name: '4. Publish with the repair' })).toBeDisabled();
});

test('create review validates content, persists across navigation, and exports supplied instructions', async ({ page }, info) => {
  await page.goto('/create');
  await page.getByRole('button', { name: 'Create review' }).click();
  await expect(page).toHaveURL('/create');
  expect(await page.locator('#title').evaluate((element: HTMLInputElement) => element.validity.valueMissing)).toBe(true);
  await page.getByRole('button', { name: 'Load example' }).click();
  const proposed = await page.getByLabel('Proposed SKILL.md').inputValue();
  await page.getByLabel('Proposed SKILL.md').fill(await page.getByLabel('Current SKILL.md').inputValue());
  await page.getByRole('button', { name: 'Create review' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'must differ' })).toBeVisible();
  const title = `Browser review ${info.project.name}`;
  await page.getByLabel('Review name').fill(title);
  await page.getByLabel('Proposed SKILL.md').fill(proposed);
  await page.getByRole('button', { name: 'Create review' }).click();
  await expect(page).toHaveURL(/\/review\/[a-f0-9-]+$/);
  const url = page.url();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Skill diff' }).click();
  await expect(page.getByText('Local keyword analysis', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.goto('/workspace');
  await page.getByRole('textbox', { name: 'Search reviews' }).fill(title);
  await page.getByRole('link').filter({ hasText: title }).click();
  await expect(page).toHaveURL(url);
  await page.getByRole('tab', { name: 'Evidence report' }).click();
  const json = JSON.parse(await downloadReport(page, info, 'JSON'));
  expect(json.title).toBe(title);
  expect(json.proposed).toBe(proposed);
  expect(json.analysis.origin).toBe('heuristic');
  expect(json.runs).toEqual([]);
  const markdown = await downloadReport(page, info, 'Markdown');
  expect(markdown).toContain(title);
  expect(markdown).toContain(proposed);
  await noPageOverflow(page);
  await screenshot(page, info, 'persisted-custom-review');
});
