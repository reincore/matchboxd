# Matchboxd

<p align="center">
  <img src="./public/icon.svg" alt="Matchboxd icon" width="96" />
</p>

<p align="center">
  <strong>Find tonight's movie without the 45-minute debate.</strong>
</p>

<p align="center">
  🍿 Movies you both want to watch, with ratings and where to stream.
</p>

<p align="center">
  <a href="https://matchboxd.com/">Live app</a>
  ·
  <a href="https://github.com/reincore/matchboxd">Repository</a>
</p>

Matchboxd is a mobile-first web app for couples choosing a movie together from their public Letterboxd watchlists. Enter two usernames, get a shared shortlist, and stop scrolling forever.

Live at [matchboxd.com](https://matchboxd.com).

## What It Does

- 💘 Finds films that overlap across two watchlists
- 🎯 Adds near-miss picks from each person's list
- ⚡ Loads fast with progressive enrichment
- 🧾 Shows ratings, runtime, genres, directors, and poster art
- 📺 Links out to where to stream in Turkey

## How It Feels

- Username-only flow
- No account setup
- Mobile-first design
- Sticky filters and sorting
- Clean shortlist view instead of endless browsing

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Cloudflare Workers
- GitHub Pages

## Architecture

- `src/app/SessionContext.tsx` keeps the small persisted session state plus the in-memory pairing run state.
- `src/features/onboarding` owns username entry and validation.
- `src/features/pair` owns the loading/results flow, shared results filters, and UI hooks.
- `src/services/letterboxd/` contains the proxy client, watchlist scraping, film scraping, and list-page metadata cache.
- `src/services/pairWatchlists/` contains candidate selection, progress reporting, and enrichment helpers.
- `worker/` contains the Cloudflare Worker used as the controlled production proxy.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

For the smoothest local Letterboxd fetches, run the local proxy too:

```bash
node worker/local-proxy.mjs
```

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `VITE_LETTERBOXD_PROXY_MODE` | `auto` uses the controlled defaults, `custom` prepends your own proxy | `auto` |
| `VITE_LETTERBOXD_PROXY_BASE_URL` | Base URL for the custom proxy/Worker | *(empty)* |
| `VITE_ENABLE_PUBLIC_PROXY_FALLBACKS` | Enables public proxy fallbacks after the controlled chain fails | `false` |
| `VITE_APP_BASE_PATH` | Base path for the deployed app | `/` |

Deprecated but still supported for one migration pass:

- `VITE_RSS_ADAPTER`
- `VITE_RSS_BASE_URL`

## Deploy

The frontend is deployed to GitHub Pages at [matchboxd.com](https://matchboxd.com).

For the preferred production proxy path, deploy the Cloudflare Worker in `worker/`:

```bash
cd worker
npx wrangler deploy
```

Then point the app at it:

```bash
VITE_LETTERBOXD_PROXY_MODE=custom
VITE_LETTERBOXD_PROXY_BASE_URL=https://<your-worker>.workers.dev/
```

## Current Notes

- Matchboxd currently reads public Letterboxd HTML pages rather than an official public API.
- The controlled proxy path improves reliability and speed, but it does not remove Letterboxd scraping legal risk.
- Public proxy fallbacks are available, but they are opt-in.
- The live app flow is:
  `landing -> pair-loading -> pair-results`

## Testing

```bash
npm run lint
npm test
npm run build
```

CI runs on `pull_request` and `push` via `.github/workflows/ci.yml`.

## License

MIT
