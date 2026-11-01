# ProxySmart Node.js Proxy Health Check

A small, security-focused example for monitoring an HTTP proxy from Node.js.
It validates the exit IP, records latency, classifies failures, and retries only
temporary errors with exponential backoff and jitter.

This repository contains **no working proxy credentials or API keys**.

## Features

- HTTP/HTTPS proxy support through `https-proxy-agent`
- 12-second hard timeout
- Exit IP validation
- Structured JSON health results
- Retry classification for network and HTTP failures
- Secret-safe proxy labels for logs
- Tests built with the Node.js test runner

## Requirements

- Node.js 20 or newer
- An HTTP proxy you are authorised to use

## Install

```bash
npm install
```

Set the proxy URL with an environment variable. Do not commit the value:

```bash
export PROXY_URL='http://username:password@proxy.example:3128'
npm start
```

PowerShell:

```powershell
$env:PROXY_URL = 'http://username:password@proxy.example:3128'
npm start
```

Example result:

```json
{
  "checkedAt": "2026-08-13T09:00:00.000Z",
  "status": "healthy",
  "latencyMs": 417,
  "exitIp": "203.0.113.10",
  "attempts": 1
}
```

The address above belongs to a documentation range and is not a working proxy.

## Test

```bash
npm test
```

The test suite verifies that credentials are removed from log labels,
authentication failures are not retried, and transient failures can recover.

## Observe exit IP continuity separately from request health

The dependency-free `summarizeObservations` example in
[`analyze-session.mjs`](analyze-session.mjs) summarizes ordered
`{ ok, exitIp, latencyMs }` records without making network requests.
A failed request or a missing/invalid IP breaks continuity; only neighboring
successful observations with valid IPs can be compared. Zero comparable pairs
returns `null`, not evidence of stability. Equivalent supported IPv6 spellings
are normalized before comparison.

```bash
node session-fixture.mjs
node --test analyze-session.test.mjs
```

The fixture uses reserved documentation addresses and synthetic timings, not
service credentials or measured proxy performance. Its six requests contain
five successes, one failure and one observed IP change across three comparable
pairs. The summary contains aggregate counts and a successful-request latency
median, not raw IPs. Keep the collector's HTTP status, authentication, timeout
and retry policies separate from this analysis.

Only test proxies and destinations you are authorized to use. Do not log
authenticated URLs, passwords or customer traffic; restrict access and retention
for real observations. An observed IP does not prove carrier, city, address type,
user identity or application-session persistence.

### Match the connection type to the QA plan

If an authorized test specifically requires a Vietnamese mobile or residential
connection, ProxySmart maintains separate catalogues for
[mobile 4G connections](https://proxysmart.net/proxy-4g) and
[residential connections](https://proxysmart.net/proxy-dan-cu). These are our own
commercial catalogues, not independent recommendations. Check the particular
package's protocols, authentication, rotation policy and duration against the
test plan. This HTTP health-check example and the offline analyzer are
provider-independent and do not require purchasing either connection type.

The continuity example was prepared with AI assistance and checked with
automated tests.

## Failure policy

| Failure | Retry? | Reason |
|---|---:|---|
| HTTP 401/407 | No | Credentials or permissions must be fixed |
| HTTP 429/502/503/504 | Yes | Usually temporary; respect `Retry-After` |
| `ECONNRESET`, `ETIMEDOUT` | Yes | May recover after backoff |
| Invalid response schema | No | Requires investigation |

## Production recommendations

- Run checks on a schedule instead of on every customer request.
- Use bounded concurrency and more than one destination endpoint.
- Alert on sustained failure rates, not a single timeout.
- Never log proxy passwords, API keys, or complete configuration URLs.
- Keep provisioning operations separate from read-only health monitoring.
- Use proxies only for systems and data you are authorised to access.

## ProxySmart API resources

For a real-world OpenAPI example with Bearer authentication and documented rate
limits, see the [ProxySmart developer portal](https://proxysmart.net/developers)
and the public [OpenAPI 3.1 specification](https://proxysmart.net/api/v1/openapi.json).

The API documentation covers provisioning operations. This repository performs
only a read-only connectivity check and does not purchase, renew, or rotate a
proxy resource.

## License

MIT © 2026 ProxySmart
