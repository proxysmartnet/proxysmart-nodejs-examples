import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EAI_AGAIN',
]);

const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);

export function safeProxyLabel(rawUrl) {
  const url = new URL(rawUrl);
  return `${url.protocol}//${url.hostname}:${url.port}`;
}

export function classifyFailure(error) {
  const status = error.response?.status;

  if (status === 401 || status === 407) {
    return { kind: 'authentication', retryable: false };
  }

  if (TRANSIENT_STATUS.has(status) || TRANSIENT_CODES.has(error.code)) {
    return { kind: 'transient', retryable: true };
  }

  return { kind: 'permanent', retryable: false };
}

const sleep = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

export async function withRetry(operation, maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return { value: await operation(), attempts: attempt };
    } catch (error) {
      lastError = error;
      const failure = classifyFailure(error);

      if (!failure.retryable || attempt === maxAttempts) {
        error.failureKind = failure.kind;
        error.attempts = attempt;
        throw error;
      }

      const exponential = 400 * (2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 200);
      await sleep(exponential + jitter);
    }
  }

  throw lastError;
}

export function createProxyClient(proxyUrl) {
  const agent = new HttpsProxyAgent(proxyUrl);

  return axios.create({
    httpAgent: agent,
    httpsAgent: agent,
    proxy: false,
    timeout: 12_000,
    maxRedirects: 3,
    validateStatus: status => status >= 200 && status < 500,
  });
}

export async function checkProxy(client) {
  const startedAt = performance.now();

  try {
    const { value: response, attempts } = await withRetry(() =>
      client.get('https://api.ipify.org?format=json')
    );
    const latencyMs = Math.round(performance.now() - startedAt);
    const exitIp = response.data?.ip;

    if (!exitIp) {
      throw new Error('The IP endpoint returned no exit IP');
    }

    return {
      checkedAt: new Date().toISOString(),
      status: latencyMs < 5_000 ? 'healthy' : 'degraded',
      latencyMs,
      exitIp,
      attempts,
    };
  } catch (error) {
    return {
      checkedAt: new Date().toISOString(),
      status: 'unhealthy',
      latencyMs: Math.round(performance.now() - startedAt),
      failureKind: error.failureKind ?? 'validation',
      attempts: error.attempts ?? 1,
    };
  }
}

async function main() {
  const proxyUrl = process.env.PROXY_URL;

  if (!proxyUrl) {
    throw new Error('Set PROXY_URL before running this example.');
  }

  console.error(`Checking ${safeProxyLabel(proxyUrl)}`);
  const result = await checkProxy(createProxyClient(proxyUrl));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'unhealthy' ? 1 : 0;
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
