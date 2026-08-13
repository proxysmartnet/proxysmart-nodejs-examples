import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyFailure,
  safeProxyLabel,
  withRetry,
} from './check-proxy.js';

test('safeProxyLabel removes credentials', () => {
  const label = safeProxyLabel(
    'http://demo-user:secret-password@proxy.example:3128'
  );

  assert.equal(label, 'http://proxy.example:3128');
  assert.doesNotMatch(label, /demo-user|secret-password/);
});

test('authentication failures are not retried', () => {
  const error = new Error('Proxy Authentication Required');
  error.response = { status: 407 };

  assert.deepEqual(classifyFailure(error), {
    kind: 'authentication',
    retryable: false,
  });
});

test('temporary network failures are retryable', () => {
  const error = new Error('Connection reset');
  error.code = 'ECONNRESET';

  assert.deepEqual(classifyFailure(error), {
    kind: 'transient',
    retryable: true,
  });
});

test('withRetry returns after a temporary failure', async () => {
  let calls = 0;

  const result = await withRetry(async () => {
    calls += 1;

    if (calls === 1) {
      const error = new Error('Temporary timeout');
      error.code = 'ETIMEDOUT';
      throw error;
    }

    return 'ok';
  });

  assert.equal(result.value, 'ok');
  assert.equal(result.attempts, 2);
});
