import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index.js';

describe('Matchboxd worker allowlists', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it('rejects disallowed origins', async () => {
    const request = new Request(
      'https://matchboxd-proxy.reincore.workers.dev/?url=https%3A%2F%2Fletterboxd.com%2Ffilm%2Fpast-lives%2F',
      {
        headers: { Origin: 'https://evil.example' },
      },
    );

    const response = await worker.fetch(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: 'Origin not allowed' });
  });

  it('rejects non-Letterboxd targets', async () => {
    const request = new Request(
      'https://matchboxd-proxy.reincore.workers.dev/?url=https%3A%2F%2Fexample.com%2F',
      {
        headers: { Origin: 'https://matchboxd.com' },
      },
    );

    const response = await worker.fetch(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: 'Only letterboxd.com URLs are allowed' });
  });

  it('returns a preflight response with the exposed country header', async () => {
    const request = new Request(
      'https://matchboxd-proxy.reincore.workers.dev/?url=https%3A%2F%2Fletterboxd.com%2Ffilm%2Fpast-lives%2F',
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://matchboxd.com',
          'cf-ipcountry': 'TR',
        },
      },
    );

    const response = await worker.fetch(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://matchboxd.com');
    expect(response.headers.get('X-Client-Country')).toBe('TR');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('proxies allowed Letterboxd requests with diagnostic headers', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('<html>Letterboxd</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }));

    const request = new Request(
      'https://matchboxd-proxy.reincore.workers.dev/?url=https%3A%2F%2Fletterboxd.com%2Ffilm%2Fpast-lives%2F',
      {
        headers: {
          Origin: 'https://matchboxd.com',
          'cf-ipcountry': 'TR',
        },
      },
    );

    const response = await worker.fetch(request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<html>Letterboxd</html>');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://matchboxd.com');
    expect(response.headers.get('X-Client-Country')).toBe('TR');
    expect(response.headers.get('X-Matchboxd-Proxy')).toBe('cloudflare');
    expect(response.headers.get('X-Upstream-Status')).toBe('200');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://letterboxd.com/film/past-lives/',
      expect.objectContaining({
        redirect: 'follow',
        headers: expect.objectContaining({
          Accept: 'text/html,application/xhtml+xml,*/*',
        }),
      }),
    );
  });

  it('serves health checks without touching upstream', async () => {
    const response = await worker.fetch(
      new Request('https://matchboxd-proxy.reincore.workers.dev/healthz'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, proxy: 'cloudflare' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
