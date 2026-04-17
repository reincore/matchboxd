# Matchboxd

<p align="center">
  <img src="./public/icon.svg" alt="Matchboxd icon" width="96" />
</p>

<p align="center">
  <strong>Find tonight's movie without the 45-minute debate.</strong>
</p>

<p align="center">
  Movies you both want to watch, with ratings and where to stream.
</p>

<p align="center">
  <a href="https://matchboxd.com/">Live app</a>
  ·
  <a href="https://github.com/reincore/matchboxd">Repository</a>
</p>

Matchboxd is a lightweight web app that compares two public Letterboxd watchlists and builds one shortlist you can actually use. Enter two usernames, get the overlap first, add a few near-miss picks from each person, and open JustWatch searches in the detected or selected country.

## What The App Does

- Reads two public Letterboxd watchlists
- Finds the shared overlap between them
- Adds a balanced set of near-miss picks from each person's list
- Progressively enriches each film with poster, rating, rating count, runtime, genres, and directors
- Lets users filter by mood, source, runtime, and rating
- Builds JustWatch search links using detected country with a manual override

## Current Product Flow

The live app intentionally keeps the product small:

`landing -> pair-loading -> pair-results`

There are no accounts, no database-backed history, and no saved matches beyond the small session state stored in local storage for the current browser.

## How Matching Works

1. Matchboxd fetches both users' public watchlists through a proxy path because browsers cannot read Letterboxd HTML directly.
2. It finds the overlap between the two lists.
3. It adds near-miss candidates from each person's non-overlapping titles, alternating between users so one side does not dominate the list.
4. It renders stubs quickly, then progressively enriches them with detail-page data.
5. The results page lets the user filter, sort, and switch JustWatch country before opening streaming searches.

By default, the pairing logic caps enrichment to:

- up to 60 overlapping titles
- up to 40 near-miss titles

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Vitest
- Cloudflare Workers
- GitHub Pages

## Project Layout

```text
src/
  app/
    SessionContext.tsx        persisted session + in-memory pairing state
  features/
    onboarding/               landing page and username validation
    pair/                     loading/results flow, filters, and hooks
  components/                 shared layout and UI primitives
  services/
    letterboxd/               proxy client, watchlist scraping, film scraping
    pairWatchlists/           candidate selection, progress, enrichment helpers
    countryDetection.ts       JustWatch region detection and override logic
worker/
  index.js                    Cloudflare Worker proxy for production
  local-proxy.mjs             tiny local proxy for development
.github/workflows/
  ci.yml                      typecheck, test, build
  deploy.yml                  GitHub Pages deploy
```

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Run The App

```bash
npm install
cp .env.example .env
npm run dev
```

The app will be available at the local Vite URL printed in the terminal.

### Recommended: run the local proxy too

Letterboxd scraping is more reliable in local development when the proxy is running:

```bash
node worker/local-proxy.mjs
```

With the default `VITE_LETTERBOXD_PROXY_MODE=auto`, the app will prefer the local proxy on `http://localhost:8787` during development when it is available.

## Environment Variables

Important: Matchboxd is a client-side app. Any `VITE_*` variable ends up in the shipped JavaScript bundle and should be treated as public.

| Variable | Purpose | Default |
|---|---|---|
| `VITE_LETTERBOXD_PROXY_MODE` | `auto` uses the local proxy in dev and the hosted worker/default chain elsewhere; `custom` prepends your own proxy base URL | `auto` |
| `VITE_LETTERBOXD_PROXY_BASE_URL` | Base URL for a custom proxy or Worker that accepts `?url=` and returns raw HTML | *(empty)* |
| `VITE_ENABLE_PUBLIC_PROXY_FALLBACKS` | Allows public proxy fallbacks after controlled proxies fail | `false` |
| `VITE_APP_BASE_PATH` | Base path for the deployed SPA | `/` |

Deprecated aliases are still supported for one migration pass:

- `VITE_RSS_ADAPTER`
- `VITE_RSS_BASE_URL`

## Available Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite development server |
| `npm run build` | Type-checks and builds the production bundle |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs TypeScript type-checking with no emit |
| `npm test` | Runs the full Vitest suite once |
| `npm run test:watch` | Runs Vitest in watch mode |

## Testing And CI

Run the main checks locally with:

```bash
npm run lint
npm test
npm run build
```

The repository also includes:

- integration coverage for the app flow
- service tests for filtering, pairing, country detection, and proxy behavior
- worker tests for origin and target allowlists

GitHub Actions runs these checks on `pull_request` and on pushes to `main` via `.github/workflows/ci.yml`.

## Deployment

### Frontend

The frontend deploys to GitHub Pages through `.github/workflows/deploy.yml`.

That workflow:

1. installs dependencies
2. builds the app
3. copies `dist/index.html` to `dist/404.html` for SPA fallback
4. publishes the build through GitHub Pages

### Proxy Worker

For the preferred production proxy path, deploy the Cloudflare Worker in `worker/`:

```bash
cd worker
npx wrangler deploy
```

The worker:

- only allows approved origins
- only proxies `https://letterboxd.com/...` targets
- returns `X-Client-Country` so the frontend can derive the default JustWatch region

After deploying your own worker, point the app at it with:

```bash
VITE_LETTERBOXD_PROXY_MODE=custom
VITE_LETTERBOXD_PROXY_BASE_URL=https://<your-worker>.workers.dev/
```

## Operational Notes

- Matchboxd scrapes public Letterboxd HTML pages. It does not use an official Letterboxd API.
- Public profiles and public watchlists are required.
- JustWatch links are search URLs, not guaranteed deep links to an exact title page.
- The controlled worker path is the preferred production setup.
- Public proxy fallbacks are intentionally opt-in.

## Common Failure Modes

- `Couldn't find @user on Letterboxd`
  Usually means the username is misspelled or does not exist.
- `@user's watchlist is set to private`
  The profile may exist, but the watchlist is not publicly readable.
- `Couldn't read one or both watchlists`
  A proxy may be blocked or rate-limited. Retry after a short wait or switch to a controlled proxy.

## License

MIT
