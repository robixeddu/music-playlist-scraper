# Battiti Playlist Browser

A Next.js web app that lets users browse Battiti radio show playlists and import them to their own TIDAL account.

## Features

- Browse all Battiti episodes with track listings
- Filter playlists by genre
- Import any playlist (global, per-genre, per-episode) directly to TIDAL
- TIDAL OAuth 2.1 PKCE — fully client-side, no backend required
- Duplicate detection: already-present tracks are skipped

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

Register your app at [developer.tidal.com](https://developer.tidal.com/) and add `http://localhost:3000/callback/tidal` (and your production URL) as allowed redirect URIs. Request the `playlists.write` scope.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Import the repo (or just the `web/` subdirectory) into Vercel.
2. In Vercel project settings, add environment variables:
   - `NEXT_PUBLIC_TIDAL_CLIENT_ID`
   - `NEXT_PUBLIC_TIDAL_REDIRECT_URI` — set to `https://your-deployment.vercel.app/callback/tidal`
3. In your TIDAL developer app settings, add the production redirect URI to the allowed list.
4. Deploy.

## Architecture

| Concern | Approach |
|---|---|
| Data | Fetched at build-time from GitHub raw URLs, revalidated every hour |
| Auth | TIDAL OAuth 2.1 PKCE, token in `sessionStorage` |
| Playlist IDs | Persisted in `localStorage` per-user |
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
│   ├── GenreSection.tsx        Genre playlist list
│   ├── EpisodeSection.tsx      Episode playlist list
│   └── ImportButton.tsx        Import state machine
├── lib/
│   ├── types.ts                Shared TypeScript types
│   ├── data.ts                 Data fetching + helpers
│   ├── tidal-auth.ts           PKCE OAuth helpers
│   ├── tidal-api.ts            TIDAL API calls
│   └── tidal-import.ts         Import orchestration
├── .env.local.example
└── vercel.json
```
