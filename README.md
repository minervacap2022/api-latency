# api-latency

API response time tester - ping endpoints and get avg/p50/p95/p99 latency stats with ASCII load distribution charts.

## Install

```bash
npm install -g api-latency
```

Or run directly with `node index.js`.

## Usage

```bash
api-latency [options] <url> [url...]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-c, --count <n>` | Number of requests per endpoint | 10 |
| `-p, --parallel <n>` | Concurrent parallel requests | 1 |
| `-m, --method <method>` | HTTP method (GET POST PUT DELETE) | GET |
| `-b, --body <data>` | Request body | - |
| `-H, --header <k:v>` | Add custom header | - |

### Examples

```bash
# Single endpoint, 10 requests
api-latency https://api.github.com

# Multiple endpoints
api-latency https://api.github.com https://httpbin.org/get

# 50 requests, 5 in parallel
api-latency -c 50 -p 5 https://jsonplaceholder.typicode.com/posts/1

# POST with JSON body
api-latency -m POST -b '{"name":"test"}' -H "Content-Type:application/json" https://httpbin.org/post

# Crypto API latency check
api-latency -c 100 -p 10 "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
```

## Output

```
api-latency - API Latency Tester
==================================================
Endpoints : 2  |  Requests per endpoint : 10  |  Concurrency : 1
==================================================

[api.github.com/]
  Requests : 10 OK  |  0 errors
  Min      : 87.23 ms
  Avg      : 124.56 ms
  Max      : 201.34 ms
  p50      : 112.45 ms
  p95      : 198.12 ms
  p99      : 201.34 ms
  Load     : 0-20ms       |#
                  20-40ms  |
                  40-60ms  |
                  60-80ms  |#
                  80-100ms |##
                  100-120ms|##
                  120-140ms|##
                  140-160ms|
                  160-180ms|
                  180-202ms|#
```

## License

MIT


<!-- minervacap-pre-hiklik-promotion -->
> **Discover Klik:** https://pre.hiklik.ai/
<!-- /minervacap-pre-hiklik-promotion -->
