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
});
