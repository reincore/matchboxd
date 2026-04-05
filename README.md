# Matchboxd

> Find tonight's movie without the 45-minute debate. Built from your public Letterboxd taste.

Matchboxd is a mobile-first, client-side React web app for couples choosing a
movie together. Both people enter their Letterboxd usernames, the app reads
their public RSS activity, builds taste profiles, applies a mood/constraint
filter, generates ~15 candidate films, then lets each person independently
swipe yes/no. The app reveals mutual matches and picks the winner.

- Dark, cinematic, poster-forward UI
- Mobile swipe + desktop button fallback
- Deterministic vs inferred recommendation categories
- Confidence-aware scoring and sparse-data fallback
- TR (Turkey) watch providers via TMDB
- 100% client-side static app — deploys to GitHub Pages

## What Matchboxd reads

Matchboxd only reads **public** Letterboxd data through the per-user RSS feed
at `https://letterboxd.com/<user>/rss/`. That feed exposes recent watched,
rated, liked, and reviewed activity, and a separate watchlist RSS exposes
public watchlist items.

Because Letterboxd does not send CORS headers, browsers cannot fetch the RSS
feed directly. Matchboxd proxies through a configurable adapter
(`rss2json`, `allorigins`, or a custom proxy you host).

### Limitations of public data

- Only items the user has chosen to make public are visible.
- Private profiles, unlisted lists, and DM-level activity are never touched.
- The feed is capped (usually last ~50 entries), so very active users have
  their "recent" window read, not their full history.
- If a user has limited activity, Matchboxd switches to **sparse-data mode**:
  fewer strong claims, broader consensus picks, and more weight on the mood
  filter.

## Quick start

```bash
# 1. Install deps
npm install

# 2. Configure environment
cp .env.example .env
# edit .env and set VITE_TMDB_API_KEY

# 3. Run locally
npm run dev

# 4. Build for production
npm run build

# 5. Preview the production build
npm run preview
```

## Environment variables

All variables must start with `VITE_` to be bundled. Remember: **any
`VITE_*` value is shipped to the browser and publicly visible** in the
compiled JavaScript. Only use keys you're willing to expose.

| Variable | Purpose | Default |
|---|---|---|
| `VITE_TMDB_API_KEY` | TMDB v3 API key. Without it, posters/synopses/providers are unavailable and the app runs in a limited mode. | *(empty)* |
| `VITE_RSS_ADAPTER` | `rss2json` · `allorigins` · `custom` | `rss2json` |
| `VITE_RSS_BASE_URL` | Required when `VITE_RSS_ADAPTER=custom`. Your proxy must accept `?url=<letterboxd-rss>` and return raw XML. | *(empty)* |
| `VITE_APP_BASE_PATH` | Vite base path. `/matchboxd/` for GitHub Pages project sites, `/` for custom domains. | `/matchboxd/` |

### TMDB

Get a free v3 API key at https://www.themoviedb.org/settings/api. The app
uses TMDB for posters, backdrops, synopses, genres, runtime, directors, and
TR watch providers.

> **TMDB attribution is required.** This product uses the TMDB API but is
> not endorsed or certified by TMDB. The attribution is shown in the app's
> footer and retained in the project README per TMDB's terms.

### RSS adapters

- **rss2json** *(default)*: Uses `api.rss2json.com`. No key. Rate-limited
  to ~10 requests/hour for anonymous callers, which is usually enough for
  one matchmaking session.
- **allorigins**: Uses `api.allorigins.win`. A public CORS pass-through.
  Slower and occasionally flaky.
- **custom**: Host your own tiny proxy (Cloudflare Worker, Vercel Edge
  Function, etc.) and point `VITE_RSS_BASE_URL` at it. Recommended for
  production-scale use.

## Deploy to GitHub Pages

This repo ships with a GitHub Actions workflow that builds and deploys to
Pages on every push to `main`.

1. Push the repo to `github.com/<user>/matchboxd`.
2. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. (Optional) In **Settings → Secrets and variables → Actions**:
   - Add repository secret `VITE_TMDB_API_KEY`.
   - Add repository variable `VITE_RSS_ADAPTER` if you want to override the
     default (`rss2json`).
4. Push to `main`. The workflow builds, tests, and deploys. The app will
   appear at `https://<user>.github.io/matchboxd/`.

### Using a custom domain

If you're deploying to the root of a custom domain, set
`VITE_APP_BASE_PATH=/` in the workflow's `env:` block (or in repo variables).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server with HMR |
| `npm run build` | Type-check and build production bundle |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Type-check without emitting |
| `npm test` | Run unit tests (vitest) |

## Architecture

```
src/
├── app/                    # App shell + session context
├── components/             # Reusable UI primitives (Button, Poster, Badge…)
├── features/
│   ├── onboarding/         # Landing page + username entry
│   ├── analysis/           # Fetch + profile-building loading UI
│   ├── filters/            # Mood + constraint picker
│   ├── swipe/              # Card stack + swipe gestures
│   └── results/            # Reveal, categories, featured pick
├── services/               # TMDB, Letterboxd, taste profile, scoring, engine
├── hooks/                  # useLocalStorage, useMediaQuery
├── types/                  # Domain types
├── data/                   # Fallback movies, genre maps, mood/constraint lists
├── utils/                  # cn, env, confidence helpers, slug utils
└── styles/
```

### Recommendation engine

The scoring engine is deliberately transparent. No black-box "AI" — just
heuristics you can read and adjust in `src/services/scoring.ts` and
`src/services/recommendationEngine.ts`.

Signals used:
- **Genre affinity** — overlap of each user's top genres with a candidate's
  genres (cosine-like over a normalized map).
- **Decade affinity** — do both users like this era?
- **Director affinity** — quietly strong when data is rich.
- **Mood fit** — deterministic genre/runtime heuristics per mood.
- **Availability fit** — TR watch provider presence when "available tonight
  in Turkey" is selected.
- **Balance** — we reward candidates with a high *minimum* affinity
  between the two profiles, not just a high average. This keeps the app
  from recommending films that leave one person out.

### Recommendation categories

Matchboxd draws a clear line between **deterministic** and **inferred** picks.

| Category | Kind | Logic |
|---|---|---|
| Watchlist overlap | deterministic | On both public watchlists |
| Shared rewatch | deterministic | Both seen and both rated ≥ 3.5 |
| Taste match | inferred | TMDB discover via shared top genres |
| Stretch pick | inferred | Closer to one person's zone; ownership is shown |

Deterministic picks are ranked above inferred picks at equal score.

### Confidence

Each candidate gets one of: **high**, **moderate**, **exploratory**.
Deterministic picks are high. Inferred picks reflect the lower of the two
user confidences. Cold-start fallback picks are always **exploratory** and
include a "broadly loved, safe start" tag.

### Result categories

After swiping:

- **Best mutual fit** — highest-scored mutual yes, with super-like boost
- **Safest pick** — hard to regret, high confidence
- **Adventure pick** — stretchier but still plausible
- **One in @A's zone** / **One in @B's zone** — where each person leans
- **True overlap** — mutual watchlist or shared rewatch
- **All mutuals** — every mutual yes

If you want a tie-breaker, the **Final duel** button runs a one-shot
comparison between the top two mutuals, weighted by super-likes.

### Sparse-data fallback

When either profile has fewer than ~8 public entries, the app:
- adds a visible note on the filters screen,
- weakens the taste engine's contribution,
- pulls more from the fallback seed list (`src/data/fallbackMovies.ts`),
- tags those candidates "broadly loved, safe start",
- leans more on mood filters for candidate selection.

### Persistence

LocalStorage keys:

| Key | Contents |
|---|---|
| `matchboxd:session:v1` | usernames, current step, filters, candidates (including swipe progress) |
| `matchboxd:history:v1` | last 20 finished sessions with the winning pick |

Session resumes automatically on reload, including mid-swipe.

## Testing

```bash
npm test
```

Unit tests in `src/services/scoring.test.ts` cover the clamp helper,
similarity, candidate affinity, mood fit, hard-constraint filtering,
ownership labelling, and full score aggregation.

## Contributing notes

- Type-safe throughout. `npm run lint` must pass.
- All heuristics live in `src/services/scoring.ts`. Changing a weight
  there propagates to the whole engine.
- The Letterboxd adapter is swappable — you can drop in a JSON API or
  GraphQL gateway later by implementing `fetchUserActivity` / `fetchUserWatchlist`.

## License

MIT — do whatever you like, just keep the TMDB attribution.
