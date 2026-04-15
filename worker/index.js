// Cloudflare Worker: lightweight CORS proxy for Matchboxd.
// Only allows requests to letterboxd.com to prevent abuse.
//
// Deploy:
//   cd worker && npx wrangler deploy
//
// Usage from the browser:
//   fetch('https://<your-worker>.workers.dev/?url=<encoded-letterboxd-url>')

const ALLOWED_ORIGINS =
  /^https?:\/\/(localhost|127\.0\.0\.1|reincore\.github\.io|matchboxd\.com|www\.matchboxd\.com)/;
const ALLOWED_TARGET = /^https:\/\/(www\.)?letterboxd\.com\//;

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    if (origin && !ALLOWED_ORIGINS.test(origin)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('url');

    if (!target) {
      return json({ error: 'Missing ?url= parameter' }, 400, request);
    }

    if (!ALLOWED_TARGET.test(target)) {
      return json({ error: 'Only letterboxd.com URLs are allowed' }, 403, request);
    }

    try {
      const res = await fetch(target, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; Matchboxd/1.0; +https://github.com/reincore/matchboxd)',
          Accept: 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });

      const body = await res.text();

      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders(request),
          'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300', // 5 min edge cache
        },
      });
    } catch (err) {
      return json({ error: 'Upstream fetch failed', detail: String(err) }, 502, request);
    }
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.test(origin)) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json',
    },
  });
}
