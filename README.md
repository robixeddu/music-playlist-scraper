# Music Playlist Scraper (Battiti)

A Node.js/TypeScript project that scrapes the **Battiti** radio show on RAI Play Sound, matches tracks on TIDAL, and maintains a set of deduplicated playlists organized by genre.

## Features

- Scrapes episodes from RAI Play Sound, extracts artist/title/album
- Genre tagging via Last.fm API (cached per artist)
- TIDAL matching with fuzzy scoring (Jaccard) + real artist verification to prevent cover-song mismatches
- Distributes tracks across three levels of playlists (no duplicates):
  - `battiti-YYYY/MM/DD` — daily playlist for each run
  - `BATTITI` — global persistent playlist
  - `BATTITI-{genre}` — one playlist per canonical genre
- Token auto-refresh every 50 tracks (handles long runs without 401 errors)
- Auto-recreates 404 playlists
- Retry logic for 429 (rate limit) and 5xx errors

## Technology

| | |
|---|---|
| Language | TypeScript (ES Modules) |
| Runtime | Node.js 20+ |
| Libraries | `cheerio` (HTML parsing), `dotenv` |
| HTTP | Native `fetch` |
| TIDAL Auth | OAuth 2.1 PKCE |

## Project Structure

```
├── full-sync.ts              # Main entrypoint: scrape + tag + match + distribute
├── ingest.ts                 # Scrape only (no TIDAL)
├── genre-enrich.ts           # Backfill genres via Last.fm on all tracks
├── catalog-enrich.ts         # Backfill TIDAL IDs for genre-tagged tracks
├── genre-playlist.ts         # Rebuild/update all genre playlists from tracks.json
├── dedup-global-playlist.ts  # Deduplicate global BATTITI playlist
├── dedup-genre-playlists.ts  # Deduplicate all genre playlists
├── lib/
│   ├── scraper.ts            # HTML fetch + episode parsing
│   ├── parser.ts             # Track string parsing ("Artist, Title, da Album")
│   ├── aggregation.ts        # Flat tracks ↔ EpisodeAggregated, dedup by key
│   ├── fileHandler.ts        # Read/write tracks.json
│   ├── tidalAuth.ts          # OAuth 2.1 PKCE, token persistence + refresh
│   ├── tidalClient.ts        # Search, match, playlist CRUD
│   ├── similarity.ts         # Jaccard scoring for track matching
│   ├── lastfm.ts             # Artist genre lookup
│   ├── genres.ts             # BLACKLIST + ALIASES for genre normalization
│   ├── types.ts              # Shared types
│   ├── config.ts             # Env-based constants
│   └── logger.ts             # Console helpers
└── data/
    ├── tracks.json           # Full episode archive with genres and TIDAL IDs
    ├── global_playlist.json  # Global BATTITI playlist ID
    └── genre_playlists.json  # genre → TIDAL playlist ID map
```

## Setup

### 1. Prerequisites

- Node.js 20+
- TIDAL developer app at [developer.tidal.com](https://developer.tidal.com)
  - Platform: **WEB**
  - Redirect URI: `http://localhost:3000/callback`
  - Scope: `playlists.write`
- Last.fm API key at [last.fm/api](https://www.last.fm/api)

### 2. Install

```bash
npm install
```

### 3. Configure `.env`

```bash
SCRAPER_BASE_URL="https://www.raiplaysound.it"
SCRAPER_PROGRAM_PATH="/programmi/battiti"

TIDAL_CLIENT_ID="your_client_id"
TIDAL_CLIENT_SECRET="your_client_secret"
TIDAL_COUNTRY_CODE="IT"

LASTFM_API_KEY="your_lastfm_key"
```

## Usage

### Normal cycle

```bash
npm start
```

Scrapes new episodes, tags genres, finds TIDAL matches, and distributes to all playlists.

### Scrape only (no TIDAL)

```bash
npm run scrape
```

### Backfill tools (for historical data)

```bash
npm run genre-enrich       # Tag genres for all tracks in tracks.json
npm run catalog-enrich     # Find TIDAL IDs for genre-tagged tracks
npm run genre-playlist     # Redistribute all tracks into genre playlists
```

### Deduplication

```bash
npm run dedup-global-playlist   # Dedup global BATTITI
npm run dedup-genres            # Dedup all genre playlists
```

## Genre System

`lib/genres.ts` normalizes raw Last.fm tags into canonical genres:

- **BLACKLIST**: geographic tags (italian, french…), instruments (guitar, piano…), junk tags
- **ALIASES**: semantic merges (e.g. `free jazz` → `jazz`, `screamo` → `post-hardcore` → `rock`, `darkwave` → `new wave`)

Genre playlists are only created when a genre has at least 10 tracks.

## Known TIDAL API Limitations

- **No playlist listing**: TIDAL API v2 does not support listing or searching user-owned playlists by name. Playlist IDs must be persisted in `genre_playlists.json`.
- **Non-deterministic search**: Results vary between runs for niche artists. Multi-fallback search strategy mitigates this.
- **Artists not linked to tracks inline**: Artist data is returned as a separate pool in `included` — the best-matching artist is selected from the pool, which can misattribute lesser-known artists.
- **Rate limiting**: 429 errors are retried with exponential backoff (5s/10s/15s). Search calls are spaced 800ms apart.
