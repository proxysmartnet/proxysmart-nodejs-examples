import { summarizeObservations } from './analyze-session.mjs';

// Synthetic documentation addresses, not measured proxy traffic.
const samples = [
  { ok: true, exitIp: '192.0.2.10', latencyMs: 80 },
  { ok: true, exitIp: '192.0.2.10', latencyMs: 90 },
  { ok: false, latencyMs: 5000 },
  { ok: true, exitIp: '198.51.100.20', latencyMs: 110 },
  { ok: true, exitIp: '203.0.113.30', latencyMs: 120 },
  { ok: true, exitIp: '203.0.113.30', latencyMs: 130 },
];
console.log(summarizeObservations(samples));
