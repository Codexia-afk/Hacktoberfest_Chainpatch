import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sameOrigin } from '../lib/http';

test('origin checks use the actual Host when Next normalizes the server URL', () => {
  for (const host of ['127.0.0.1:3000', 'localhost:3000', '[::1]:3000']) {
    assert.doesNotThrow(() => sameOrigin(new Request('http://localhost:3000/api/reviews', {
      headers: { host, origin: `http://${host}`, referer: `http://${host}/playground` },
    })));
  }
});

test('actual destination still rejects other origins, ports, protocols, referers and forged forwarding headers', () => {
  const cases: Record<string, string>[] = [
    { origin: 'https://evil.example' },
    { origin: 'http://localhost:3000' },
    { origin: 'http://127.0.0.1:3001' },
    { origin: 'https://127.0.0.1:3000' },
    { origin: 'null' },
    { origin: 'http://127.0.0.1:3000', referer: 'https://evil.example/' },
    { origin: 'https://evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https' },
    { origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000/anything' },
  ];
  for (const headers of cases) {
    assert.throws(() => sameOrigin(new Request('http://localhost:3000/api/reviews', {
      headers: { host: '127.0.0.1:3000', ...headers },
    })), /Cross-origin/);
  }
});
