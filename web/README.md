# Battiti Playlist Browser

A Next.js web app that lets users browse Battiti radio show playlists and import them to their own TIDAL account.

Live at [music-playlist-scraper.vercel.app](https://music-playlist-scraper.vercel.app).

## Features

- Browse all Battiti episodes with track listings
- Filter playlists by genre (sorted by genre family)
- Import any playlist (global, per-genre, per-episode) directly to TIDAL
- TIDAL OAuth 2.1 PKCE — fully client-side, no backend required
- Import buttons disabled until TIDAL is connected
- Duplicate detection: already-present tracks are skipped
- Auto-recreates playlists if they were deleted on TIDAL
- TIDAL API proxied via Next.js rewrites (avoids CORS)

## Setup

### 1. Clone and install

```bash
cd web
npm install
```

### 2. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your TIDAL credentials:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_TIDAL_CLIENT_ID=your_client_id_here
NEXT_PUBLIC_TIDAL_REDIRECT_URI=http://localhost:3000/callback/tidal
```

Register your app at [developer.tidal.com](https://developer.tidal.com/):
- Platform preset: **WEB**
- Add `http://localhost:3000/callback/tidal` (and your production URL) as allowed redirect URIs
- Scope: `playlists.read playlists.write user.read`

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Import the repo into Vercel, set the **root directory** to `web/`.
2. In Vercel project settings, add environment variables:
   - `NEXT_PUBLIC_TIDAL_CLIENT_ID`
   - `NEXT_PUBLIC_TIDAL_REDIRECT_URI` — set to `https://your-deployment.vercel.app/callback/tidal`
3. In your TIDAL developer app settings, add the production redirect URI to the allowed list.
4. Deploy.

## Architecture

| Concern | Approach |
|---|---|
| Data | Fetched at build-time from GitHub raw URLs, revalidated every hour |
| Auth | TIDAL OAuth 2.1 PKCE (`https://login.tidal.com/authorize`), token in `sessionStorage` |
| Playlist IDs | Persisted in `localStorage` per-user |
| TIDAL API | Proxied via Next.js `rewrites()` → `https://openapi.tidal.com/v2/` |
| Routing | Single page `/` + `/callback/tidal` |
| Styling | Tailwind CSS v4, dark theme |
| Framework | Next.js 16 App Router, TypeScript strict |

## Project structure

```
web/
├── app/
│   ├── layout.tsx              Root layout (dark theme)
│   ├── page.tsx                Main page (SSR, fetches data)
│   └── callback/tidal/
│       ├── page.tsx            OAuth callback (Suspense wrapper)
│       └── CallbackClient.tsx  Client component (useSearchParams)
├── components/
│   ├── TidalPill.tsx           Connect/disconnect button
│   ├── Accordion.tsx           Collapsible section
│   ├── ProgramBlock.tsx        Per-source layout
│   ├── GlobalSection.tsx       Global playlist row
│   ├── GenreSection.tsx        Genre playlist list (sorted by family)
│   ├── EpisodeSection.tsx      Episode playlist list
│   ├── ImportButton.tsx        Single playlist import
│   └── ImportAllButton.tsx     Batch import for all genres/episodes
├── hooks/
│   ├── useImportLock.ts        Serializes concurrent imports
│   ├── usePlaylistStatus.tsx   Per-playlist status (up-to-date / has-new / idle)
│   └── useTidalConnected.ts    Shared hook: [connected, disconnect]
├── lib/
│   ├── types.ts                Standalone TypeScript types (Track, EpisodeAggregated, …)
│   ├── data.ts                 Data fetching + getGenres (unique tidalId counts)
│   ├── genreFamily.ts          Re-export of GENRE_FAMILY from lib/genreConfig
│   ├── tidal-auth.ts           PKCE OAuth helpers
│   ├── tidal-api.ts            TIDAL API calls (TIDAL_BASE_URL + fetchWithRetry)
│   └── tidal-import.ts         Import orchestration + 404 recreation
├── .env.local.example
└── next.config.ts              rewrites() proxy for TIDAL API
```

> **Note:** `web/lib/genres.ts` and `web/lib/genreFamily.ts` import from `../../lib/genreConfig` — all genre logic lives in a single source of truth. To add or change a genre, edit only `lib/genreConfig.ts`.
