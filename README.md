# Music Playlist Scraper (Battiti)

A Node.js/TypeScript project that scrapes the **Battiti** radio show on RAI Play Sound, matches tracks on TIDAL, and maintains a set of deduplicated playlists organized by genre.

## Features

- Scrapes episodes from RAI Play Sound, extracts artist/title/album
- Genre tagging via **Claude Haiku** (`claude-haiku-4-5`) — one API call per artist, cached, returns 1–3 genres from an approved list
- TIDAL matching with fuzzy scoring (Jaccard) + real artist verification to prevent cover-song mismatches
- **Two-phase workflow** — scrape/match first, manual review, then propagate:
  - `battiti-YYYY-MM-DD` — staging playlist created on each run for review
  - `BATTITI` — global persistent playlist (populated after review via `propagate`)
  - `BATTITI-{genre}` — one playlist per canonical genre (populated after review via `propagate`)
- `tracks.json` is the single source of truth — edit it after review before propagating
- **Auto-creates new genre playlists** as new genres accumulate — no manual setup needed, review them on TIDAL later
- Token auto-refresh every 50 tracks (handles long runs without 401 errors)
- Auto-recreates 404 playlists
- Retry logic for 429 (rate limit) and 5xx errors
- Fail-fast on corrupted `tracks.json` (SyntaxError → process exits with clear message)
- Run manually to allow genre review before propagating

## Technology

| | |
|---|---|
| Language | TypeScript (ES Modules) |
| Runtime | Node.js 20+ |
| Libraries | `cheerio` (HTML parsing), `dotenv`, `@anthropic-ai/sdk` |
| HTTP | Native `fetch` |
| TIDAL Auth | OAuth 2.1 PKCE |
| Genre AI | Anthropic Claude Haiku |

## Project Structure

```
├── scripts/
│   ├── full-sync.ts                    # Phase 1: scrape + tag + match → tracks.json + staging playlist
│   ├── genre-playlist.ts               # Phase 2 (propagate): distribute tracks.json → global + genre playlists
│   ├── ingest.ts                       # Scrape only (no TIDAL)
│   ├── genre-enrich.ts                 # Backfill genres via Claude on all tracks
│   ├── catalog-enrich.ts               # Backfill TIDAL IDs for genre-tagged tracks
│   ├── reconcile-global-playlist.ts    # One-shot: rebuild global playlist from tracks.json (removes stale IDs)
│   ├── dedup-global-playlist.ts        # Deduplicate global playlist
│   ├── dedup-genre-playlists.ts        # Deduplicate all genre playlists
│   └── sync-and-notify.sh              # Cron wrapper: PROGRAM_ID=battiti npm start
├── lib/
│   ├── scraper.ts            # HTML fetch + episode parsing
│   ├── parser.ts             # Track string parsing ("Artist, Title, da Album")
│   ├── aggregation.ts        # Flat tracks ↔ EpisodeAggregated, dedup by key
│   ├── fileHandler.ts        # Read/write tracks.json (fail-fast on JSON errors)
│   ├── tidalAuth.ts          # OAuth 2.1 PKCE, token persistence + refresh
│   ├── tidalClient.ts        # Search, match, playlist CRUD
│   ├── similarity.ts         # Jaccard scoring for track matching
│   ├── genreConfig.ts        # Single source of truth: BLACKLIST, ALIASES, GENRE_FAMILY
│   ├── claudeGenres.ts       # Genre tagging: Haiku → Brave Search + Haiku fallback
│   ├── genres.ts             # Thin wrapper: normalizeGenre + filterGenres
│   ├── types.ts              # Shared types
│   ├── config.ts             # Program-aware constants (reads PROGRAM_ID from env)
│   └── logger.ts             # Console helpers
└── data/
    ├── sources.json          # Manifest of all programs (id, name, playlistPrefix…)
    └── battiti/
        ├── tracks.json       # Full episode archive with genres and TIDAL IDs
        ├── global_playlist.json  # Global BATTITI playlist ID
        ├── genre_playlists.json  # genre → TIDAL playlist ID map
        └── missing_tracks.txt   # Tracks not found on TIDAL
```

## Setup

### 1. Prerequisites

- Node.js 20+
- TIDAL developer app at [developer.tidal.com](https://developer.tidal.com)
  - Platform: **WEB**
  - Redirect URI: `http://localhost:3000/callback`
  - Scope: `playlists.write`
- Anthropic API key at [console.anthropic.com](https://console.anthropic.com)

### 2. Install

```bash
npm install
```

### 3. Configure `.env`

```bash
PROGRAM_ID=battiti

SCRAPER_BASE_URL="https://www.raiplaysound.it"
SCRAPER_PROGRAM_PATH="/programmi/battiti"

TIDAL_CLIENT_ID="your_client_id"
TIDAL_CLIENT_SECRET="your_client_secret"
TIDAL_COUNTRY_CODE="IT"

ANTHROPIC_API_KEY="your_anthropic_key"
BRAVE_SEARCH_API_KEY="your_brave_key"   # Brave Search API — fallback genre lookup
```

### 4. First run (TIDAL auth)

```bash
npm start
```

On first run, the terminal prints a TIDAL OAuth URL. Open it in the browser, authorize, and the token is saved to `.tidal_token.json` for subsequent runs.

## Usage

### Normal cycle (two-phase)

**Phase 1 — scrape, tag, match:**

```bash
npm start
```

Scrapes new episodes, tags genres via Claude, finds TIDAL matches, writes results to `tracks.json` and `missing_tracks.txt`, and creates a staging playlist `battiti-YYYY-MM-DD` on TIDAL for review.

**Review:** open the staging playlist on TIDAL, edit `tracks.json` / `missing_tracks.txt` if needed.

**Phase 2 — propagate to playlists:**

```bash
npm run propagate
```

Reads the verified `tracks.json` and distributes all tracks to `BATTITI` (global) and all `BATTITI-{genre}` playlists. Idempotent — only adds tracks not already present.

### Scrape only (no TIDAL)

```bash
npm run scrape
```

### Backfill tools (for historical data)

```bash
npm run genre-enrich       # Tag genres for all tracks in tracks.json (via Claude)
npm run catalog-enrich     # Find TIDAL IDs for genre-tagged tracks
npm run propagate          # Redistribute all tracks from tracks.json into global + genre playlists
```

### Maintenance

```bash
npm run dedup-global-playlist        # Dedup global BATTITI
npm run dedup-genres                 # Dedup all genre playlists
npm run reconcile-global-playlist    # Rebuild global playlist from tracks.json, removing stale IDs
```

## Genre System

### Genre tagger (`lib/claudeGenres.ts`)

Two-step pipeline per track, cheapest path first:

1. **Claude Haiku** — classifies from memory (artist + title). Returns `[]` when uncertain: unknown artist, foreign-language title with no clear genre signal, or only a geographic/cultural inference. Wrong is worse than empty.
2. **Brave Search + Haiku** — fallback when Haiku returns `[]`. Searches `"artist title genre"` via Brave Search API (free tier: 1000 req/month), passes top-5 snippets to Haiku for extraction.

Each track is tagged individually — no per-artist cache — so the title influences every call and Brave can fire per-track. The log shows `[brave]` when the fallback is used.

`APPROVED_GENRES` is derived automatically from `GENRE_FAMILY` keys — no manual list to maintain.

Requires `BRAVE_SEARCH_API_KEY` in `.env` (local only — not needed on Vercel).

### Genre configuration (`lib/genreConfig.ts`)

Single source of truth for the entire genre system. Edit only here — `lib/genres.ts`, `web/lib/genres.ts`, and `web/lib/genreFamily.ts` are thin wrappers that import from it.

- **BLACKLIST**: geographic tags (country names, cities, nationalities, pan-regional terms), instruments, roles, junk tags. Rule: **any geographic name goes in the blacklist**.
- **ALIASES**: maps raw/variant tags → canonical names (e.g. `free jazz` → `jazz`, `darkwave` → `new wave`, `tribal` → `world`). Rule: **any variant of an existing genre goes in aliases**.
- **GENRE_FAMILY**: canonical genre → display family for UI sorting and color assignment.

### Canonical genres

Key canonical values: `jazz`, `blues`, `soul`, `electronic`, `ambient`, `drone`, `experimental`, `rock`, `post-punk`, `post-rock`, `metal`, `industrial`, `punk`, `psychedelic`, `noise`, `folk`, `pop`, `hip-hop`, `r&b`, `world`, `reggae`, `classica`, `soundtrack`, and `no-genre` for untagged tracks.

`no-genre` is assigned via `genre-enrich.ts --mark-empty` after all other enrichment passes are done. Every track that still has no genre gets `["no-genre"]`, which maps to a dedicated `BATTITI-no-genre` TIDAL playlist.

**Adding a new genre:** edit only `lib/genreConfig.ts` — add the alias in `ALIASES` and/or a new canonical entry in `GENRE_FAMILY`. Everything else updates automatically.

### Auto-playlist creation

- **During `npm start`**: a new `BATTITI-{genre}` playlist is created immediately the first time a genre appears — no threshold, no confirmation.
- **During `npm run propagate`**: playlists are only created for genres with ≥ 10 tracks (`MIN_TRACKS`), since propagate is a backfill tool and sparse genres are noise.

New playlists are logged to the console and persisted in `data/genre_playlists.json`. Review and clean them up manually on TIDAL if needed.

## Multi-program support

The project is designed to support multiple radio show sources. Each program lives in its own directory under `data/` and is declared in `data/sources.json`.

### Adding a new program

1. Add an entry to `data/sources.json`:
```json
{
  "id": "stereonotte",
  "name": "Stereonotte",
  "description": "...",
  "url": "https://www.raiplaysound.it/programmi/stereonotte",
  "playlistPrefix": "STEREONOTTE",
  "color": "#457b9d",
  "active": true
}
```
2. Create `data/stereonotte/` directory
3. Run with `PROGRAM_ID=stereonotte npm start`

All scripts are program-aware via the `PROGRAM_ID` env variable. Playlist names, data paths, and prefixes are derived automatically.

## TIDAL Matching

Matching runs a multi-fallback search strategy to maximize coverage:

1. `artist title` (primary)
2. `title` alone, `artist` alone, `title artist` (reversed)
3. Clean title variants: strips `(feat. ...)`, `[remix]`, `da "Album"`, `de "Album"`, `, "Album"`, em-dash label annotations (`– 12" Rough Trade`, `– Les Disques Bongo Joe`), year suffixes `(1971)`
4. Normalized artist variants: dots expanded (`M.I.A.` → `M I A`), slash/& parts tried individually
5. **Label-as-artist fallback**: when the RAI artist field is a label/show (e.g. `HABIBI FUNK`) and the title contains the real artist (`City Lights Band - Kul Ghrub`), the embedded artist is extracted and tried separately with its own scoring

Each candidate is verified against the real TIDAL artist (separate API call) before acceptance. `CONFIDENT_THRESHOLD = 0.5`.

## Known TIDAL API Limitations

- **No playlist listing**: TIDAL API v2 does not support listing or searching user-owned playlists by name. Playlist IDs must be persisted in `genre_playlists.json`. If lost, recover with `git show <commit>:data/genre_playlists.json`.
- **DELETE requires `meta.itemId`**: Removing a track from a playlist requires the `meta.itemId` UUID (not the track position) in the DELETE body. Fetch playlist items first to obtain it.
- **Non-deterministic search**: Results vary between runs for niche artists. Multi-fallback search strategy mitigates this.
- **Rate limiting**: 429 errors are retried with exponential backoff (5s/10s/15s). Search calls are spaced 800ms apart.

## Web UI

A read-only Next.js 16 app in `web/` that browses the catalog — deployed at [music-playlist-scraper.vercel.app](https://music-playlist-scraper.vercel.app):

- **Language auto-detection** from `Accept-Language` header — no `/it` or `/en` prefix in URLs
- Browse episodes by date, filter by genre, see TIDAL coverage per episode
- Import any section (global, genre, episode) directly into TIDAL via OAuth 2.1 PKCE
  - Episode playlists are named `{sourceId}-YYYY-MM-DD-nome-episodio` (date + slugified title)
- Import buttons disabled until connected to TIDAL
- TIDAL API calls proxied via Next.js rewrites (avoids CORS)
- Data fetched from GitHub raw URLs with 1-hour in-memory cache
- `tracks.json` is the single source of truth for all data displayed

```bash
cd web && npm install && npm run dev   # http://localhost:3000
```
