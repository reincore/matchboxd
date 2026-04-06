# Matchboxd

<p align="center">
  <img src="./public/logo.svg" alt="Matchboxd logo" width="320" />
</p>

<p align="center">
  Find tonight's movie without the 45-minute debate.
</p>

<p align="center">
  <a href="https://reincore.github.io/matchboxd/">Live app</a>
  ·
  <a href="https://github.com/reincore/matchboxd">Repository</a>
</p>

Matchboxd is a mobile-first React app for couples choosing a movie together
from their public Letterboxd watchlists. Enter two usernames, fetch the shared
overlap, sprinkle in near-miss picks from each person's list, then sort and
filter a poster-forward shortlist.

The app currently ships as a static Vite site on GitHub Pages, with a
Cloudflare Worker used as the preferred production CORS proxy for Letterboxd
HTML pages.

## Current product

- Username-only flow: no account, no backend database, no setup for users
- Shared-watchlist matcher with near-miss picks from each person's list
- Progressive results: stubs render early, metadata enriches in place
- Lazy watched filter: "Hide watched" fetches watched lists only when needed
- Mobile-first UI with sticky filter bar and poster grid
- JustWatch Turkey outbound links for each title
- Pink-on-ink visual identity with custom Matchboxd logo and icons

## How it works

1. Two users enter their Letterboxd usernames.
2. Matchboxd reads both public watchlists through a proxy.
3. It computes:
   - strict overlap: films on both watchlists
   - near-misses: films from only one watchlist, capped and source-tagged
4. It emits lightweight film stubs immediately so results can render fast.
5. It enriches those films progressively with detail-page metadata:
   - poster
   - Letterboxd rating
   - runtime
   - genres
   - directors
6. If the user toggles `Hide watched`, the app lazily fetches both watched
   lists and filters them out.

## Stack

- React 18
- TypeScript 5
- Vite 5
- Tailwind CSS 3
- Framer Motion 11
- Cloudflare Workers
- GitHub Pages

## Project status

This repo has changed substantially from its original concept.

What the app is now:

- a shortlist builder around shared Letterboxd watchlists
- optimized for speed and low-friction usage
- progressively hydrated rather than fully blocking on detail scraping

What still exists in the repo but is no longer the main product:

- the older recommendation/swipe/taste-profile flow
- legacy TMDB-based recommendation services
- scoring tests for the retired recommendation engine

Those files are still useful as historical context, but the live app path is
the `landing -> pair-loading -> pair-results` flow.

## Repo map

```text
src/
├── app/
│   └── SessionContext.tsx         # Active app/session state
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Poster.tsx
│   └── StepShell.tsx
├── features/
│   ├── onboarding/
│   │   └── LandingPage.tsx
│   └── pair/
│       ├── PairLoadingPage.tsx
│       └── PairResultsPage.tsx
├── services/
│   ├── letterboxdScrape.ts        # HTML scraping, caching, throttling, proxies
│   └── pairWatchlists.ts          # Pairing, stub emission, enrichment, watched filter
├── styles/
└── utils/

worker/
├── index.js                       # Cloudflare Worker proxy
├── local-proxy.mjs                # Local Node proxy for development
└── wrangler.toml
```

## Progressive loading architecture

The current app is tuned to feel much faster than a naive "scrape everything,
then render" flow.

Key ideas:

- Watchlists are scraped first and intersected quickly.
- Stubs are built from list-page metadata and rendered immediately.
- Film detail pages enrich cards progressively in the background.
- The final results page keeps accepting streamed updates after navigation.
- Poster fallbacks recover when a better poster URL arrives later.

This means users can start interacting with the shortlist before every film has
finished enriching.

## Proxy strategy

Matchboxd reads public Letterboxd HTML pages, not an official public API.

Proxy order:

1. Local proxy on `localhost:8787` during local development
2. Configured custom proxy via `VITE_RSS_BASE_URL`
3. Public fallbacks such as `allorigins`, `codetabs`, and `corsproxy.io`

Production recommendation:

- use the Cloudflare Worker in `worker/`
- point `VITE_RSS_ADAPTER=custom`
- set `VITE_RSS_BASE_URL` to your deployed Worker URL

The Worker is currently a lightweight pass-through proxy with origin and target
restrictions plus short edge caching.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open the app locally and, if you want the fastest and most reliable local
Letterboxd fetches, run the local proxy in a second terminal:

```bash
node worker/local-proxy.mjs
```

## Environment variables

All `VITE_*` variables are bundled into the frontend, so treat them as public.

| Variable | Purpose | Default |
|---|---|---|
| `VITE_RSS_ADAPTER` | Proxy mode: `rss2json`, `allorigins`, or `custom` | `allorigins` |
| `VITE_RSS_BASE_URL` | Required for `custom`; should accept `?url=<encoded-target>` | *(empty)* |
| `VITE_APP_BASE_PATH` | Vite base path for GitHub Pages or custom domains | `/matchboxd/` |

Notes:

- The current shortlist flow does not require TMDB.
- Some older files still reference `VITE_TMDB_API_KEY`, but that is legacy
  surface area rather than the active product path.

## Development commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Type-check without emitting |
| `npm test` | Run Vitest tests |

## Deploying

### GitHub Pages

This repo is set up to deploy the frontend to GitHub Pages via GitHub Actions.

Expected base path:

- `/matchboxd/` for project pages like `https://<user>.github.io/matchboxd/`
- `/` for root-level custom domains

### Cloudflare Worker

Deploy the Worker separately from the static site.

```bash
cd worker
npx wrangler deploy
```

Then configure the frontend to use it:

```bash
VITE_RSS_ADAPTER=custom
VITE_RSS_BASE_URL=https://<your-worker>.workers.dev/
```

## Known limitations

- Letterboxd scraping is still dependent on public HTML structure.
- Public fallback proxies can still be rate-limited.
- The `Hide watched` filter is intentionally lazy, so it is not applied during
  the first instant render.
- The README now reflects the current shortlist app, but the repo still
  contains legacy recommendation-engine code that has not yet been removed.

## Legal note

Matchboxd reads only public Letterboxd pages and does not require users to log
in or expose private data. That said, scraping public pages still carries legal
and platform-risk questions, especially if the product grows beyond hobby use.

For the current state of the app:

- the public hobby deployment uses the current scraping/proxy path
- the Cloudflare Worker improves reliability, not legal clearance
- a safer long-term data strategy is still worth pursuing

## Testing

```bash
npm test
npm run build
```

Current automated tests mostly cover legacy scoring utilities. The live
shortlist flow is validated primarily through type-checking, build success, and
manual product testing.

## License

MIT
