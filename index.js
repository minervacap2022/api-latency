#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { URL } = require('url');

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = { endpoints: [], count: 10, concurrency: 1, headers: {} };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-c' || args[i] === '--count') {
      flags.count = parseInt(args[++i], 10);
    } else if (args[i] === '-p' || args[i] === '--parallel') {
      flags.concurrency = parseInt(args[++i], 10);
    } else if (args[i] === '-H' || args[i] === '--header') {
      const [k, v] = args[++i].split(':');
      flags.headers[k.trim()] = v.trim();
    } else if (args[i] === '-m' || args[i] === '--method') {
      flags.method = args[++i].toUpperCase();
    } else if (args[i] === '-b' || args[i] === '--body') {
      flags.body = args[++i];
    } else if (!args[i].startsWith('-')) {
      flags.endpoints.push(args[i]);
    }
  }
  return flags;
}

function ping(urlStr, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const protocol = url.protocol === 'https:' ? https : http;
    const start = process.hrtime.bigint();
    
    const req = protocol.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'api-latency/1.0.0',
        ...options.headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const latencyNs = Number(end - start);
        resolve({ latencyMs: latencyNs / 1e6, status: res.statusCode, error: null });
      });
    });
    
    req.on('error', (e) => {
      const end = process.hrtime.bigint();
      const latencyNs = Number(end - start);
      resolve({ latencyMs: latencyNs / 1e6, status: 0, error: e.message });
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      resolve({ latencyMs: null, status: 0, error: 'TIMEOUT' });
    });
    
    if (options.body) req.write(options.body);
    req.end();
  });
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runBenchmarks(endpoints, count, concurrency, options) {
  console.log(`\napi-latency - API Latency Tester`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Endpoints : ${endpoints.length}  |  Requests per endpoint : ${count}  |  Concurrency : ${concurrency}`);
  if (options.method) console.log(`Method    : ${options.method}`);
  if (options.body) console.log(`Body      : ${options.body}`);
  console.log(`${'='.repeat(50)}\n`);

  for (const endpoint of endpoints) {
    const results = [];
    const errors = [];

    // Run in batches of concurrency
    for (let i = 0; i < count; i += concurrency) {
      const batch = Array(Math.min(concurrency, count - i)).fill(null);
      const batchPromises = batch.map(() => ping(endpoint, options));
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(r => {
        if (r.error) {
          errors.push(r.error);
        } else {
          results.push(r.latencyMs);
        }
      });
    }

    const url = new URL(endpoint);
    const host = url.hostname + url.pathname;
    
    if (results.length === 0) {
      console.log(`[${host}]`);
      console.log(`  ERROR: All ${errors.length} requests failed`);
      errors.slice(0, 3).forEach(e => console.log(`  - ${e}`));
      console.log('');
      continue;
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    const p50 = percentile(results, 50);
    const p95 = percentile(results, 95);
    const p99 = percentile(results, 99);

    console.log(`[${host}]`);
    console.log(`  Requests : ${results.length} OK  |  ${errors.length} errors`);
    console.log(`  Min      : ${min.toFixed(2)} ms`);
    console.log(`  Avg      : ${avg.toFixed(2)} ms`);
    console.log(`  Max      : ${max.toFixed(2)} ms`);
    console.log(`  p50      : ${p50.toFixed(2)} ms`);
    console.log(`  p95      : ${p95.toFixed(2)} ms`);
    console.log(`  p99      : ${p99.toFixed(2)} ms`);
    
    // ASCII bar chart
    const barMax = 60;
    const buckets = Array(10).fill(0);
    results.forEach(v => {
      const b = Math.min(9, Math.floor((v / max) * 10));
      buckets[b]++;
    });
    console.log(`  Load     : ${buckets.map((b, i) => {
      const bar = '#'.repeat(Math.round((b / results.length) * barMax));
      const range = `${(max/10*i).toFixed(0)}-${(max/10*(i+1)).toFixed(0)}ms`;
      return `${range.padEnd(14)} |${bar}`;
    }).join(`\n${' '.repeat(22)}|`)}`);
    console.log('');
  }
}

function showHelp() {
  console.log(`
api-latency - API Response Time Tester

Usage: api-latency [options] <url> [url...]

Options:
  -c, --count <n>       Number of requests per endpoint (default: 10)
  -p, --parallel <n>    Concurrent requests in parallel (default: 1)
  -m, --method <method> HTTP method: GET POST PUT DELETE (default: GET)
  -b, --body <data>     Request body (for POST/PUT)
  -H, --header <k:v>    Add custom header

Examples:
  api-latency https://api.github.com https://httpbin.org/get
  api-latency -c 50 -p 5 https://jsonplaceholder.typicode.com/posts/1
  api-latency -m POST -b '{"name":"test"}' -H "Content-Type:application/json" https://httpbin.org/post
  api-latency -c 100 -p 10 https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
`);
}

async function main() {
  const argv = process.argv;
  
  if (argv.includes('-h') || argv.includes('--help') || argv.includes('help')) {
    showHelp();
    return;
  }

  const flags = parseArgs(argv);
  
  if (flags.endpoints.length === 0) {
    console.error('Error: at least one endpoint URL required');
    showHelp();
    process.exit(1);
  }

  for (const url of flags.endpoints) {
    try {
      new URL(url);
    } catch {
      console.error(`Invalid URL: ${url}`);
      process.exit(1);
    }
  }

  await runBenchmarks(flags.endpoints, flags.count, flags.concurrency, {
    method: flags.method,
    body: flags.body,
    headers: flags.headers,
  });
}

main().catch(e => { console.error(e); process.exit(1); });
