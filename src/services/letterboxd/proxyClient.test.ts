// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchHtml, resetProxyClientState } from './proxyClient';

const VALID_HTML = `
  <html>
    <head>
      <meta property="og:site_name" content="Letterboxd" />
    </head>
    <body>
      letterboxd.com
      <div data-item-slug="test-film"></div>
      ${'<!-- padding -->'.repeat(120)}
    </body>
  </html>
`;

describe('fetchHtml proxy client', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    fetchSpy.mockReset();
    sessionStorage.clear();
    resetProxyClientState();
  });

  afterEach(() => {
    resetProxyClientState();
  });

  it('falls back to the next proxy and cools the failed proxy down', async () => {
    fetchSpy
      .mockRejectedValueOnce(new Error('local proxy unavailable'))
      .mockResolvedValueOnce(new Response(VALID_HTML, { status: 200 }));

    const html = await fetchHtml('https://letterboxd.com/alice/watchlist/page/1/');
    expect(html).toContain('data-item-slug');

    fetchSpy.mockClear();
    fetchSpy.mockResolvedValueOnce(new Response(VALID_HTML, { status: 200 }));

    await fetchHtml('https://letterboxd.com/bob/watchlist/page/1/');

    const firstUrl = String(fetchSpy.mock.calls[0][0]);
    expect(firstUrl).toContain('matchboxd-proxy.reincore.workers.dev');
  });

  it('reuses the in-memory HTML cache for repeat requests', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(VALID_HTML, { status: 200 }));

    await fetchHtml('https://letterboxd.com/alice/watchlist/page/1/');
    await fetchHtml('https://letterboxd.com/alice/watchlist/page/1/');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('hydrates from sessionStorage without refetching', async () => {
    const targetUrl = 'https://letterboxd.com/alice/watchlist/page/2/';
    sessionStorage.setItem(
      `matchboxd:html:${targetUrl}`,
      JSON.stringify({ ts: Date.now(), body: VALID_HTML }),
    );

    const html = await fetchHtml(targetUrl);

    expect(html).toContain('data-item-slug');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
