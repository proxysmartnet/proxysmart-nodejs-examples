import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeObservations } from './analyze-session.mjs';

const sample = (exitIp, latencyMs = 100) => ({ ok: true, exitIp, latencyMs });

test('median remains finite for finite nonnegative input extremes', () => {
  assert.equal(summarizeObservations([
    sample('192.0.2.10', Number.MAX_VALUE),
    sample('192.0.2.10', Number.MAX_VALUE),
  ]).medianLatencyMs, Number.MAX_VALUE);
});

test('synthetic fixture keeps request failures separate and does not bridge gaps', () => {
  const result = summarizeObservations([
    sample('192.0.2.10', 80),
    sample('192.0.2.10', 90),
    { ok: false, latencyMs: 5000 },
    sample('198.51.100.20', 110),
    sample('203.0.113.30', 120),
    sample('203.0.113.30', 130),
  ]);
  assert.deepEqual(result, {
    requests: 6, successes: 5, failures: 1, validIpSamples: 5,
    comparablePairs: 3, observedChanges: 1, changeFraction: 1 / 3,
    medianLatencyMs: 110,
  });
});

test('a changed address is not a request failure', () => {
  const result = summarizeObservations([sample('192.0.2.1'), sample('192.0.2.2')]);
  assert.equal(result.failures, 0);
  assert.equal(result.observedChanges, 1);
});

test('empty or failed-only runs do not manufacture evidence of stability', () => {
  for (const input of [[], [{ ok: false }], [{ ok: false }, { ok: false }]]) {
    const result = summarizeObservations(input);
    assert.equal(result.changeFraction, null);
    assert.equal(result.medianLatencyMs, null);
    assert.equal(result.validIpSamples, 0);
  }
});

test('a single successful observation has no comparable pair', () => {
  const result = summarizeObservations([sample('192.0.2.1')]);
  assert.equal(result.comparablePairs, 0);
  assert.equal(result.changeFraction, null);
});

test('missing, invalid and hostname values break continuity but preserve request status', () => {
  for (const exitIp of [undefined, '', 'not-an-ip', 'proxy.example', 123, '192.0.2.999']) {
    const result = summarizeObservations([
      sample('192.0.2.1'), sample(exitIp), sample('192.0.2.2'),
    ]);
    assert.equal(result.successes, 3);
    assert.equal(result.validIpSamples, 2);
    assert.equal(result.comparablePairs, 0);
    assert.equal(result.observedChanges, 0);
  }
});

test('equivalent IPv6 spellings are the same observed address', () => {
  const result = summarizeObservations([
    sample('2001:DB8:0:0:0:0:0:1'), sample('2001:db8::1'),
  ]);
  assert.equal(result.validIpSamples, 2);
  assert.equal(result.comparablePairs, 1);
  assert.equal(result.observedChanges, 0);
});

test('IPv4 and IPv6 observations differ without implying a failure', () => {
  const result = summarizeObservations([sample('192.0.2.1'), sample('2001:db8::1')]);
  assert.equal(result.observedChanges, 1);
  assert.equal(result.failures, 0);
});

test('only finite nonnegative successful-request latency values enter the median', () => {
  const result = summarizeObservations([
    sample('192.0.2.1', 20), sample('192.0.2.1', 10),
    sample('192.0.2.1', -1), sample('192.0.2.1', NaN),
    sample('192.0.2.1', Infinity), sample('192.0.2.1', '100'),
    { ok: false, latencyMs: 1000 },
  ]);
  assert.equal(result.medianLatencyMs, 15);
});

test('missing latency does not change request or IP counts', () => {
  const result = summarizeObservations([{ ok: true, exitIp: '192.0.2.1' }]);
  assert.equal(result.successes, 1);
  assert.equal(result.validIpSamples, 1);
  assert.equal(result.medianLatencyMs, null);
});

test('input contract is bounded and explicit', () => {
  for (const input of [null, {}, [null], [{}], [{ ok: 'yes' }], new Array(10001)]) {
    assert.throws(() => summarizeObservations(input), TypeError);
  }
});

test('input records are not mutated and result contains no raw addresses or credentials', () => {
  const input = Object.freeze([Object.freeze({
    ok: true, exitIp: '192.0.2.1', latencyMs: 12,
    proxyUrl: 'http://redacted:placeholder@proxy.example:3128',
  })]);
  const result = summarizeObservations(input);
  assert.equal(result.successes, 1);
  assert.doesNotMatch(JSON.stringify(result), /192\.0\.2\.1|redacted|placeholder|proxyUrl/);
});
