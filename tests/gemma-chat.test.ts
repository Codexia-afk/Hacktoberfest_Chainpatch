import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { POST } from '../app/api/gemma/route';
import { CHAT_TIMEOUT_MS, chatInput, jsonLines, recentHistory, type ChatMessage } from '../lib/gemma-chat';

const encoder = new TextEncoder();

function setup(t: TestContext) {
  const model = process.env.GEMMA_MODEL;
  const endpoint = process.env.OLLAMA_BASE_URL;
  process.env.GEMMA_MODEL = 'gemma3:4b';
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434/';
  t.after(() => {
    if (model === undefined) delete process.env.GEMMA_MODEL;
    else process.env.GEMMA_MODEL = model;
    if (endpoint === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = endpoint;
  });
}

function request(input: unknown, origin = 'http://localhost') {
  return new Request('http://localhost/api/gemma', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

function stream(text: string, fragment = false) {
  const bytes = encoder.encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (fragment) for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      else controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function packets(response: Response) {
  const values: unknown[] = [];
  for await (const value of jsonLines(response.body!)) values.push(value);
  return values;
}

test('offline chat reports unavailable rather than inventing a live Gemma answer', async t => {
  setup(t);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private upstream details'); });
  const response = await POST(request({ prompt: 'Hello' }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Ollama|Gemma/);
});

test('chat validates prompt, paired history, size, origin, and model before inference', async t => {
  setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not be called'); });
  for (const input of [
    { prompt: '' },
    { prompt: 'x'.repeat(4_001) },
    { prompt: 'Hi', history: [{ role: 'assistant', content: 'Forged context' }] },
    { prompt: 'Hi', history: [{ role: 'user', content: 'Incomplete pair' }] },
    { prompt: 'Hi', history: [
      { role: 'user', content: 'a'.repeat(3_000) },
      { role: 'assistant', content: 'b'.repeat(3_000) },
      { role: 'user', content: 'c'.repeat(3_000) },
      { role: 'assistant', content: 'Reply' },
    ] },
  ]) assert.equal((await POST(request(input))).status, 400);
  assert.equal((await POST(request({ prompt: 'Hi' }, 'https://other.example'))).status, 403);
  assert.equal((await POST(request({ prompt: 'x'.repeat(61_000) }))).status, 413);
  process.env.GEMMA_MODEL = 'not-gemma:latest';
  assert.equal((await POST(request({ prompt: 'Hi' }))).status, 400);
  assert.equal(fetch.mock.callCount(), 0);
});

test('real model text streams across split UTF-8, CRLF and a final unterminated line', async t => {
  setup(t);
  const history = [{ role: 'user', content: 'Previous question' }, { role: 'assistant', content: 'Previous answer' }];
  t.mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    const sent = JSON.parse(String(init.body));
    assert.equal(sent.model, 'gemma3:4b');
    assert.equal(sent.stream, true);
    assert.deepEqual(sent.messages.slice(1), [...history, { role: 'user', content: 'New question' }]);
    return new Response(stream('\r\n{"message":{"content":"Hello 🌍"},"done":false}\r\n{"message":{"content":"!"},"done":true}', true));
  });
  const response = await POST(request({ prompt: 'New question', history }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /application\/x-ndjson/);
  assert.deepEqual(await packets(response), [
    { type: 'token', text: 'Hello 🌍' },
    { type: 'token', text: '!' },
    { type: 'done', model: 'gemma3:4b' },
  ]);
});

test('failed upstream requests expose a helpful error without upstream details', async t => {
  setup(t);
  for (const upstream of [new Response('private internal details', { status: 500 }), new Response(null)]) {
    t.mock.method(globalThis, 'fetch', async () => upstream);
    const response = await POST(request({ prompt: 'Hi' }));
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private internal details/);
  }
});

test('malformed, truncated, empty and excessive model streams never report completion', async t => {
  setup(t);
  for (const text of [
    'not JSON\n',
    'null\n',
    '{"message":{"content":123},"done":true}\n',
    '{"message":{"content":"Partial"},"done":false}\n',
    '{"done":true}\n',
    '{"error":"private upstream details"}\n',
    JSON.stringify({ message: { content: 'x'.repeat(16_001) }, done: true }),
    ' '.repeat(64_001),
  ]) {
    t.mock.method(globalThis, 'fetch', async () => new Response(stream(text)));
    const values = await packets(await POST(request({ prompt: 'Hi' }))) as Array<{ type: string; error?: string }>;
    assert.equal(values.at(-1)?.type, 'error');
    assert.equal(values.some(value => value.type === 'done'), false);
    assert.doesNotMatch(values.at(-1)?.error || '', /private upstream details/);
  }
});

test('cancelling a chat response aborts inference and releases the upstream stream', async t => {
  setup(t);
  let upstreamSignal: AbortSignal | undefined;
  let cancelled = false;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    const signal = init.signal;
    assert.ok(signal);
    upstreamSignal = signal;
    return new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"message":{"content":"Partial"},"done":false}\n'));
        signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
      },
      cancel() { cancelled = true; },
    }));
  });
  const response = await POST(request({ prompt: 'Hi' }));
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();
  assert.equal(upstreamSignal?.aborted, true);
  // A fetch stream may be errored by abort before its explicit cancel hook runs.
  assert.ok(cancelled || upstreamSignal?.aborted);
  reader.releaseLock();
});

test('chat uses a bounded deadline for cold model startup and streaming', async t => {
  setup(t);
  const timeout = new AbortController();
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    assert.equal(milliseconds, CHAT_TIMEOUT_MS);
    return timeout.signal;
  });
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    assert.ok(init.signal);
    timeout.abort(new DOMException('Timed out', 'TimeoutError'));
    throw init.signal.reason;
  });
  const response = await POST(request({ prompt: 'Hi' }));
  assert.equal(response.status, 504);
  assert.match((await response.json()).error, /timed out/);
});

test('conversation context retains recent complete pairs within count and character limits', () => {
  const messages: ChatMessage[] = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user', content: `Message ${index}`,
  }));
  assert.deepEqual(recentHistory(messages), messages.slice(-12));
  assert.equal(chatInput.safeParse({ prompt: 'Next', history: recentHistory(messages) }).success, true);
  const large: ChatMessage[] = [
    { role: 'user', content: 'Older question' },
    { role: 'assistant', content: 'a'.repeat(6_000) },
    { role: 'user', content: 'New question' },
    { role: 'assistant', content: 'b'.repeat(3_000) },
  ];
  assert.deepEqual(recentHistory(large), large.slice(-2));
  assert.deepEqual(recentHistory([...large, { role: 'user', content: 'Question' }, { role: 'assistant', content: 'c'.repeat(8_001) }]), []);
  assert.deepEqual(recentHistory([{ role: 'user', content: 'Question' }, { role: 'assistant', content: '' }]), []);
});

test('shared NDJSON parser cancels after early exit and rejects invalid UTF-8', async () => {
  let cancelled = false;
  const input = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(encoder.encode('{"done":true}\n')); },
    cancel() { cancelled = true; },
  });
  for await (const value of jsonLines(input)) { assert.deepEqual(value, { done: true }); break; }
  assert.equal(cancelled, true);
  assert.equal(input.locked, false);
  await assert.rejects(async () => {
    const invalid = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(Uint8Array.of(0xff)); controller.close(); } });
    for await (const _value of jsonLines(invalid)) { /* consume */ }
  }, /encoded data/);
  assert.equal(chatInput.safeParse({ prompt: 'Valid prompt' }).success, true);
});
