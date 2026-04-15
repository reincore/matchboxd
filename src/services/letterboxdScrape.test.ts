// @vitest-environment happy-dom
//
// Canary tests for Letterboxd HTML parsing. These use realistic HTML fixtures
// that mirror Letterboxd's page structure. If Letterboxd changes their DOM,
// these tests should fail and alert us before users notice.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Realistic fixture: includes markers that looksLikeLetterboxd() checks for
// (letterboxd.com in body + application/ld+json) and enough content length.
const FILM_DETAIL_HTML = `
<html>
<head>
  <meta property="og:site_name" content="Letterboxd" />
  <meta property="og:title" content="Past Lives (2023)" />
  <meta property="og:image" content="https://a.ltrbxd.com/resized/poster.jpg" />
  <meta property="og:description" content="Two childhood friends reconnect after decades apart." />
  <link rel="canonical" href="https://letterboxd.com/film/past-lives/" />
  <script type="application/ld+json">
  {
    "@context": "http://schema.org",
    "@type": "Movie",
    "name": "Past Lives",
    "url": "https://letterboxd.com/film/past-lives/",
    "releasedEvent": [{"startDate": "2023-06-02"}],
    "image": "https://a.ltrbxd.com/resized/poster-hq.jpg",
    "director": [{"name": "Celine Song"}],
    "genre": ["Drama", "Romance"],
    "aggregateRating": {
      "ratingValue": 4.12,
      "ratingCount": 450000
    }
  }
  </script>
</head>
<body>
  <div id="film-page-wrapper">
    <p class="text-footer">105 mins &nbsp;more info at letterboxd.com</p>
    <a href="/films/genre/drama/">Drama</a>
    <a href="/films/genre/romance/">Romance</a>
  </div>
</body>
</html>`;

const RUNTIME_HM_HTML = `
<html>
<head>
  <meta property="og:site_name" content="Letterboxd" />
  <meta property="og:title" content="Oppenheimer (2023)" />
  <link rel="canonical" href="https://letterboxd.com/film/oppenheimer/" />
  <script type="application/ld+json">
  {"@type":"Movie","name":"Oppenheimer","url":"https://letterboxd.com/film/oppenheimer/"}
  </script>
</head>
<body>
  <div id="film-page-wrapper">
    <p class="text-footer">3h 1m &nbsp;more info at letterboxd.com</p>
  </div>
  ${'<!-- padding to pass length check -->'.repeat(20)}
</body>
</html>`;

// Intercept global fetch before module import. happy-dom provides its own
// fetch, so we need vi.spyOn to intercept it.
const fetchSpy = vi.spyOn(globalThis, 'fetch');

import { scrapeFilm, upscalePoster } from './letterboxdScrape';

function mockProxyResponse(html: string) {
  fetchSpy.mockResolvedValueOnce(
    new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  );
}

describe('upscalePoster', () => {
  it('scales Letterboxd poster URLs from default to target width', () => {
    const url = 'https://a.ltrbxd.com/resized/something-0-230-0-345-crop.jpg';
    const result = upscalePoster(url, 460);
    expect(result).toBe('https://a.ltrbxd.com/resized/something-0-460-0-690-crop.jpg');
  });

  it('returns undefined for undefined input', () => {
    expect(upscalePoster(undefined)).toBeUndefined();
  });

  it('returns non-Letterboxd URLs unchanged', () => {
    const url = 'https://other.com/poster.jpg';
    expect(upscalePoster(url, 460)).toBe(url);
  });
});

describe('scrapeFilm — HTML parsing canary', () => {
  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it('extracts all expected fields from a representative film detail page', async () => {
    mockProxyResponse(FILM_DETAIL_HTML);

    const result = await scrapeFilm('past-lives-canary');

    expect(result.slug).toBe('past-lives-canary');
    expect(result.title).toBe('Past Lives');
    expect(result.year).toBe(2023);
    expect(result.posterUrl).toContain('ltrbxd.com');
    expect(result.synopsis).toBe('Two childhood friends reconnect after decades apart.');
    expect(result.runtime).toBe(105);
    expect(result.genres).toContain('Drama');
    expect(result.genres).toContain('Romance');
    expect(result.directors).toContain('Celine Song');
    expect(result.lbRating).toBeCloseTo(4.12, 1);
    expect(result.lbRatingCount).toBe(450000);
  });

  it('parses "Xh Ym" runtime format', async () => {
    mockProxyResponse(RUNTIME_HM_HTML);

    const result = await scrapeFilm('oppenheimer-canary');
    expect(result.runtime).toBe(181);
  });

  it('returns a stub when all proxies fail', async () => {
    // Make every fetch call reject
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await scrapeFilm('unknown-film-canary');

    expect(result.slug).toBe('unknown-film-canary');
    expect(result.title).toBeTruthy();
    expect(result.genres).toEqual([]);
    expect(result.directors).toEqual([]);
  }, 30_000);
});
