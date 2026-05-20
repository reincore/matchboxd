const ALLOWED_ORIGINS =
  /^https?:\/\/(localhost|127\.0\.0\.1|reincore\.github\.io|matchboxd\.com|www\.matchboxd\.com)/;
const ALLOWED_TARGET = /^https:\/\/(www\.)?letterboxd\.com\//;
const USER_AGENT =
  'Mozilla/5.0 (compatible; Matchboxd/1.0; +https://github.com/reincore/matchboxd)';

export async function handleProxyRequest(
  request,
  { proxyName = 'proxy', cacheControl = 'public, max-age=300' } = {},
) {
  const origin = request.headers.get('Origin') || '';
  const ipCountry = readCountryFromHeaders(request.headers);
  const url = new URL(request.url);

  if (origin && !ALLOWED_ORIGINS.test(origin)) {
    return json(
      { error: 'Origin not allowed' },
      403,
      request,
      proxyName,
      ipCountry,
      '0',
    );
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: diagnosticHeaders(request, proxyName, ipCountry, '0'),
    });
  }

  if (url.pathname === '/healthz') {
    return json(
      { ok: true, proxy: proxyName },
      200,
      request,
      proxyName,
      ipCountry,
      '0',
    );
  }

  const target = url.searchParams.get('url');
  if (!target) {
    return json(
      { error: 'Missing ?url= parameter' },
      400,
      request,
      proxyName,
      ipCountry,
      '0',
    );
  }

  if (!ALLOWED_TARGET.test(target)) {
    return json(
      { error: 'Only letterboxd.com URLs are allowed' },
      403,
      request,
      proxyName,
      ipCountry,
      '0',
    );
  }

  try {
    const upstreamResponse = await fetch(target, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    const body = await upstreamResponse.text();
    const upstreamStatus = String(upstreamResponse.status);

    return new Response(body, {
      status: upstreamResponse.status,
      headers: {
        ...diagnosticHeaders(request, proxyName, ipCountry, upstreamStatus),
        'Content-Type':
          upstreamResponse.headers.get('Content-Type') || 'text/html; charset=utf-8',
        'Cache-Control': cacheControl,
      },
    });
  } catch (error) {
    return json(
      { error: 'Upstream fetch failed', detail: String(error) },
      502,
      request,
      proxyName,
      ipCountry,
      '0',
    );
  }
}

export function toNodeRequest(req, pathnameOverride) {
  const protocol = firstHeader(req.headers['x-forwarded-proto']) || 'https';
  const host = firstHeader(req.headers.host) || 'localhost';
  const originalUrl = new URL(req.url || '/', `${protocol}://${host}`);

  if (pathnameOverride) {
    originalUrl.pathname = pathnameOverride;
    originalUrl.search = '';
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  return new Request(originalUrl, {
    method: req.method || 'GET',
    headers,
  });
}

export async function sendNodeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

function readCountryFromHeaders(headers) {
  return headers.get('cf-ipcountry') || headers.get('x-vercel-ip-country') || '';
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.test(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers':
      'X-Client-Country, X-Matchboxd-Proxy, X-Upstream-Status',
    'Access-Control-Max-Age': '86400',
  };
}

function diagnosticHeaders(request, proxyName, ipCountry, upstreamStatus) {
  return {
    ...corsHeaders(request),
    'X-Client-Country': ipCountry,
    'X-Matchboxd-Proxy': proxyName,
    'X-Upstream-Status': upstreamStatus,
  };
}

function json(data, status, request, proxyName, ipCountry, upstreamStatus) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...diagnosticHeaders(request, proxyName, ipCountry, upstreamStatus),
      'Content-Type': 'application/json',
    },
  });
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}
