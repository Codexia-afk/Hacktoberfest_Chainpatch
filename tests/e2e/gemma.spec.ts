import { expect, test, type Page } from '@playwright/test';

const promptLabel = 'Ask Gemma a question';
const answer = 'Test model answer: require an approved summary at the publisher boundary.';
// Next also has a global route-announcer alert; inspect only console errors.
const chatError = (page: Page) => page.getByRole('region', { name: 'Live Gemma conversation', exact: true }).getByRole('alert');

// These response fixtures exercise the browser, not live model inference.
async function availableModel(page: Page) {
  await page.route('**/api/model', route => route.fulfill({ json: {
    model: 'gemma3:4b', connected: true, message: 'Test Ollama model available.',
  } }));
}

function completedAnswer() {
  return [
    { type: 'token', text: answer.slice(0, 24) },
    { type: 'token', text: answer.slice(24) },
    { type: 'done', model: 'gemma3:4b' },
  ].map(value => JSON.stringify(value)).join('\n');
}

async function send(page: Page, prompt: string) {
  await page.getByRole('textbox', { name: promptLabel }).fill(prompt);
  await page.getByRole('button', { name: 'Send to Gemma', exact: true }).click();
}

test('offline Gemma preserves the prompt and never invents an answer', async ({ page }) => {
  // The isolated test server uses an unavailable Ollama endpoint. No API mock.
  await page.goto('/gemma');
  await expect(page.locator('.gemma-connection')).toContainText('Gemma connection not confirmed');
  const prompt = 'Explain the publisher policy.';
  await send(page, prompt);
  await expect(chatError(page)).toContainText('Gemma is unavailable');
  await expect(page.getByRole('textbox', { name: promptLabel })).toHaveValue(prompt);
  await expect(page.locator('.gemma-message')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send to Gemma', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('Gemma console renders answers, sends completed history, clears and forgets chat on reload', async ({ page }) => {
  await availableModel(page);
  const requests: unknown[] = [];
  await page.route('**/api/gemma', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'application/x-ndjson', body: completedAnswer() });
  });
  await page.goto('/gemma');
  const input = page.getByRole('textbox', { name: promptLabel });
  await expect(input).toHaveAttribute('maxlength', '4000');
  await page.getByRole('button', { name: 'Generate Guardrail Policy', exact: false }).click();
  const firstPrompt = await input.inputValue();
  expect(firstPrompt).toContain('Generate a boundary guardrail policy');
  await page.getByRole('button', { name: 'Send to Gemma', exact: true }).click();
  await expect(page.locator('.gemma-message.assistant')).toHaveText(`GEMMA${answer}`);
  await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeEnabled();
  await input.fill('Explain that answer.');
  await input.press('Control+Enter');
  await expect(page.locator('.gemma-message.assistant')).toHaveCount(2);
  await expect(page.locator('.gemma-message.assistant').last()).toContainText(answer);
  await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeEnabled();
  expect(requests).toEqual([
    { prompt: firstPrompt, history: [] },
    { prompt: 'Explain that answer.', history: [
      { role: 'user', content: firstPrompt }, { role: 'assistant', content: answer },
    ] },
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('.gemma-message')).toHaveCount(0);
  await send(page, 'Start again.');
  await expect(page.locator('.gemma-message.assistant')).toContainText(answer);
  expect(requests.at(-1)).toEqual({ prompt: 'Start again.', history: [] });
  await page.reload();
  await expect(page.locator('.gemma-message')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: promptLabel })).toHaveValue('');
});

for (const [name, body] of [
  ['truncated', JSON.stringify({ type: 'token', text: 'Incomplete answer' })],
  ['malformed', 'not JSON\n'],
  ['upstream error', JSON.stringify({ type: 'error', error: 'Gemma timed out after 60 seconds. Please try again.' })],
]) {
  test(`${name} Gemma response restores the prompt without corrupting completed history`, async ({ page }) => {
    await availableModel(page);
    let calls = 0;
    const requests: unknown[] = [];
    await page.route('**/api/gemma', route => {
      calls += 1;
      requests.push(route.request().postDataJSON());
      return route.fulfill({ contentType: 'application/x-ndjson', body: calls === 2 ? body : completedAnswer() });
    });
    await page.goto('/gemma');
    await send(page, 'First question.');
    await expect(page.locator('.gemma-message.assistant')).toContainText(answer);
    await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeEnabled();
    await send(page, 'Follow-up question.');
    await expect(chatError(page)).toBeVisible();
    await expect(page.getByRole('textbox', { name: promptLabel })).toHaveValue('Follow-up question.');
    await expect(page.locator('.gemma-message')).toHaveCount(2);
    await expect(page.locator('.gemma-message.assistant')).toContainText(answer);
    await page.getByRole('button', { name: 'Send to Gemma', exact: true }).click();
    await expect(page.locator('.gemma-message.assistant')).toHaveCount(2);
    await expect(page.locator('.gemma-message.assistant').last()).toContainText(answer);
    await expect(chatError(page)).toHaveCount(0);
    expect(requests.at(-1)).toEqual({ prompt: 'Follow-up question.', history: [
      { role: 'user', content: 'First question.' }, { role: 'assistant', content: answer },
    ] });
  });
}

test('stopping generation restores the prompt and permits a fresh retry', async ({ page }) => {
  await availableModel(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/api/gemma', async route => {
    calls += 1;
    if (calls === 1) await pending;
    await route.fulfill({ contentType: 'application/x-ndjson', body: completedAnswer() });
  });
  try {
    await page.goto('/gemma');
    const request = page.waitForRequest('**/api/gemma');
    await send(page, 'A cancellable question.');
    await request;
    await expect(page.getByRole('textbox', { name: promptLabel })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Stop generating', exact: true }).click();
    await expect(chatError(page)).toContainText('Generation stopped');
    await expect(page.getByRole('textbox', { name: promptLabel })).toHaveValue('A cancellable question.');
    await expect(page.locator('.gemma-message')).toHaveCount(0);
    release();
    await page.getByRole('button', { name: 'Send to Gemma', exact: true }).click();
    await expect(page.locator('.gemma-message.assistant')).toContainText(answer);
    await expect(chatError(page)).toHaveCount(0);
  } finally {
    release();
  }
});
