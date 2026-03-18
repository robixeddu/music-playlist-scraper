# 🎧 Music Playlist Scraper (Battiti)
A Node.js (TypeScript) project designed to automatically scrape and aggregate the tracklist from the radio show **"Battiti"** on Rai Play Sound. The primary goal is to maintain a complete, deduplicated historical archive and automatically sync new tracks to a TIDAL playlist.

## ✨ Key Features
* **TypeScript Stability**: Developed entirely in TypeScript for static typing, enhanced reliability, and maintainable code structure.
* **Robust Scraping**: Analyzes "Battiti" episodes to extract Artist, Title, and Album/Label details.
* **Reliable Deduplication**: Uses a normalized key (`artist___title`) to track previously saved songs, ensuring only truly new tracks are processed.
* **Historical Archive**: Saves all found tracks in the structured `tracks.json` file, aggregated by episode.
* **Incremental Update**: The system efficiently skips known episodes and identifies new tracks with each execution.
* **TIDAL Direct Sync**: Automatically searches and adds new tracks to a TIDAL playlist via the TIDAL API v2, with no manual steps required.
* **Similarity Scoring**: Fuzzy matching (Jaccard + weighted scoring) prevents false positives when TIDAL track/artist names differ slightly from the source.
* **Duplicate Protection**: Fetches existing playlist track IDs before syncing — already-added tracks are skipped.
* **Missing Tracks CSV**: Tracks not found on TIDAL are automatically appended to a CSV file for manual review, without duplicating existing entries.

## 🛠️ Technology and Architecture

| Component | Details |
| :--- | :--- |
| **Language** | TypeScript |
| **Environment** | Node.js 20+ (ES Modules - ESM) |
| **Core Libraries** | `cheerio` (HTML parsing), `dotenv` (env config) |
| **HTTP** | Native `fetch` (Node.js 20+ built-in, no extra dependency) |
| **TIDAL Auth** | OAuth 2.1 with PKCE (Authorization Code flow) |
| **Architecture** | Modular code in `/lib`, centralized configuration (`.env`), compiled output in `/dist` |

## 📝 Code Structure (File/Folder)
| File/Folder | Description |
| :--- | :--- |
| **`/lib`** | Core modules: scraper, parser, aggregation, I/O, similarity scoring, TIDAL auth and client. |
| **`index.ts`** | Scraper entrypoint — fetches episodes, updates archive, exports new tracks. |
| **`tidal-sync.ts`** | TIDAL sync entrypoint — searches and adds new tracks to a TIDAL playlist. |
| **`/dist`** | Compiled JavaScript output. **(Ignored by Git)** |
| **`data/tracks.json`** | Historical archive of all tracks aggregated by episode. |
| **`data/new_tracks_for_playlist.txt`** | Export file with only the new tracks from the latest scrape run. |
| **`missing_tracks/`** | CSV files listing tracks not found on TIDAL, for manual addition. |
| **`.env`** | Environment variables (scraper URLs, TIDAL credentials, playlist ID). |
| **`.tidal_token.json`** | Persisted TIDAL OAuth token. **(Ignored by Git)** |

## 🚀 Setup and Execution

### 1. Prerequisites
* [Node.js](https://nodejs.org/) 20+
* A TIDAL developer app registered at [developer.tidal.com](https://developer.tidal.com) (platform: **WEB**, redirect URI: `http://localhost:3000/callback`, scope: `playlists.write`)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:

```bash
# Scraper
SCRAPER_BASE_URL="https://www.raiplaysound.it"
SCRAPER_PROGRAM_PATH="/programmi/battiti"

# TIDAL
TIDAL_CLIENT_ID="your_client_id"
TIDAL_CLIENT_SECRET="your_client_secret"
TIDAL_PLAYLIST_ID="your_playlist_id"
TIDAL_COUNTRY_CODE="IT"
```

### 4. Scrape new tracks
```bash
npm start
```
Compiles TypeScript, fetches new episodes, updates `tracks.json`, and writes `data/new_tracks_for_playlist.txt`.

### 5. Sync to TIDAL
```bash
npm run tidal-sync
```
On first run, opens a browser authentication URL. After login, the token is saved locally and reused automatically (with auto-refresh).

**What happens:**
1. Fetches existing playlist track IDs to detect duplicates.
2. For each new track, searches TIDAL using a multi-fallback strategy:
   - `"ARTIST TITLE"` → `"TITLE"` → `"ARTIST"` → `"ARTIST TITLE."` (punctuation variant)
3. Scores each candidate with fuzzy matching — confident matches are added, uncertain ones are logged, not-found tracks are appended to the missing CSV.

## 📄 Missing Tracks
Tracks not found via the TIDAL API (either absent from the catalogue or unsurfaced by search) are appended to the CSV in `missing_tracks/` for manual addition. The file follows the format used by playlist import tools like TuneMyMusic or Soundiiz.
