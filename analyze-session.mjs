import { isIP } from 'node:net';

function normalizedIp(value) {
  if (typeof value !== 'string') return null;
  const family = isIP(value);
  if (family === 4) return value;
  if (family !== 6) return null;
  try {
    return new URL(`http://[${value}]/`).hostname;
  } catch {
    return null;
  }
}

export function summarizeObservations(samples) {
  if (!Array.isArray(samples) || samples.length > 10_000) {
    throw new TypeError('Expected an array of at most 10000 samples');
  }
  let successes = 0;
  let validIpSamples = 0;
  let comparablePairs = 0;
  let observedChanges = 0;
  let previousIp = null;
  const latencies = [];
  for (const sample of samples) {
    if (!sample || typeof sample.ok !== 'boolean') {
      throw new TypeError('Each sample needs a boolean ok field');
    }
    if (!sample.ok) {
      previousIp = null;
      continue;
    }
    successes++;
    if (Number.isFinite(sample.latencyMs) && sample.latencyMs >= 0) {
      latencies.push(sample.latencyMs);
    }
    const ip = normalizedIp(sample.exitIp);
    if (ip) {
      validIpSamples++;
      if (previousIp !== null) {
        comparablePairs++;
        if (ip !== previousIp) observedChanges++;
      }
    }
    previousIp = ip;
  }
  latencies.sort((a, b) => a - b);
  const middle = Math.floor(latencies.length / 2);
  const medianLatencyMs = latencies.length === 0 ? null
    : latencies.length % 2 ? latencies[middle]
    : latencies[middle - 1] + (latencies[middle] - latencies[middle - 1]) / 2;
  return {
    requests: samples.length,
    successes,
    failures: samples.length - successes,
    validIpSamples,
    comparablePairs,
    observedChanges,
    changeFraction: comparablePairs ? observedChanges / comparablePairs : null,
    medianLatencyMs,
  };
}
