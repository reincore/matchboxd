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
| `VITE_RSS_ADAPTER` | Proxy mode: `rss2json`, `allorigins`, or `custom` | `allorigins` |
| `VITE_RSS_BASE_URL` | Base URL for the custom proxy/Worker | *(empty)* |
| `VITE_APP_BASE_PATH` | Base path for the deployed app | `/` |

## Deploy

The frontend is deployed to GitHub Pages.

For the preferred production proxy path, deploy the Cloudflare Worker in `worker/`:

```bash
cd worker
npx wrangler deploy
```

Then point the app at it:

```bash
VITE_RSS_ADAPTER=custom
VITE_RSS_BASE_URL=https://<your-worker>.workers.dev/
```

## Current Notes

- Matchboxd currently reads public Letterboxd HTML pages rather than an official public API.
- A Cloudflare Worker improves reliability and speed, but it does not remove Letterboxd scraping legal risk.
- Some legacy recommendation-engine files still exist in the repo, but the live app flow is:
  `landing -> pair-loading -> pair-results`

## Testing

```bash
npm test
npm run build
```

## License

MIT
