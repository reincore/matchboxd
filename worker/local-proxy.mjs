// Tiny local CORS proxy for development/testing.
// Start: node worker/local-proxy.mjs
// Then set VITE_RSS_ADAPTER=custom VITE_RSS_BASE_URL=http://localhost:8787

import http from 'node:http';
import https from 'node:https';

const PORT = 8787;

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const target = url.searchParams.get('url');
  if (!target) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
    return;
  }

  try {
    const parsed = new URL(target);
    if (!parsed.hostname.endsWith('letterboxd.com')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Only letterboxd.com URLs allowed' }));
      return;
    }

    const body = await fetchUrl(target);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const proto = targetUrl.startsWith('https') ? https : http;
    proto.get(
      targetUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      (response) => {
        // Follow redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          fetchUrl(response.headers.location).then(resolve, reject);
          return;
        }
        const chunks = [];
        response.on('data', (c) => chunks.push(c));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        response.on('error', reject);
      },
    ).on('error', reject);
  });
}

server.listen(PORT, () => {
  console.log(`Local CORS proxy running at http://localhost:${PORT}`);
  console.log(`Test: http://localhost:${PORT}/?url=https://letterboxd.com/denizsaglam/watchlist/page/1/`);
});
