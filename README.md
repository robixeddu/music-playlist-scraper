# 🎧 Music Playlist Scraper (Battiti)
A robust Node.js (TypeScript) project designed to automatically scrape and aggregate the tracklist from the radio show **"Battiti"** on Rai Play Sound. The primary goal is to maintain a complete, deduplicated historical archive and generate clean files ready for external service integration (like TIDAL or Spotify).

## ✨ Key Features
* **TypeScript Stability**: Developed entirely in TypeScript for static typing, enhanced reliability, and maintainable code structure.
* **Robust Scraping**: Analyzes "Battiti" episodes to extract Artist, Title, and Album/Label details.Reliable Deduplication: Uses a normalized key (`artist___title`) to track previously saved songs, ensuring only truly new tracks are processed and preventing duplicates caused by inconsistent source formatting.
* **Historical Archive**: Saves all found tracks in the structured `tracks.json` file, aggregated by episode.
* **Incremental Update**: The system efficiently skips known episodes and identifies new tracks with each execution.
* **TIDAL Export**: Generates a clean text file (`new_tracks_for_tidal.txt`) containing only the new songs, formatted for easy import via third-party services (Soundiiz, TuneMyMusic).

## 🛠️ Technology and Architecture

| Component | Details |
| :--- | :--- |
| **Language** | TypeScript |
| **Environment** | Node.js (ES Modules - ESM) |
| **Core Libraries** | `cheerio`, `node-fetch`, `dotenv` |
| **Architecture** | Modular code in `/lib`, centralized configuration (`.env`), compiled output in `/dist` |

## 📝 Code Structure (File/Folder)
```bash
| File/Folder | Description |
| :--- | :--- |
| **`/lib`** | **Core Source.** Contains all TypeScript modules (`.ts`) with the project's logic (scraper, parser, aggregation, I/O). |
| **`init.ts`** | The main entry point and orchestrator file. |
| **`/dist`** | Output folder for compiled JavaScript files. **(Ignored by Git)** |
| **`tracks.json`** | **Historical Archive.** Contains all tracks found to date, aggregated by episode. |
| **`new_tracks_for_tidal.txt`** | **Export File.** Contains only the new tracks found in the latest run. |
| **`.env`** | Configuration file for environment variables. |
| **`tsconfig.json`** | TypeScript compiler configuration (set to use NodeNext resolution). |
```

## 🚀 Setup and Execution
### 1. Prerequisites
* [Node.js](https://nodejs.org/) (Version 20+ is recommended for ESM support)

### 2. Install Dependencies
After cloning the repository, install the necessary libraries and TypeScript development tools:

```bash
npm install
```

### 3. Configuration
Create a file named `.env` in the root directory to define the scraping target:

```bash
# Base URL of the Rai Play Sound website
SCRAPER_BASE_URL="https://www.raiplaysound.it"

# Specific program path (Battiti)
SCRAPER_PROGRAM_PATH="/programmi/battiti"
```

### 4. Execution and Update
The `npm start` command automatically handles the entire workflow: it runs the **TypeScript compiler** (`tsc`) and executes the compiled code.

Run the script:

```bash
npm start
```

**What happens on execution:**

1. **Build**: TypeScript files (`.ts`) are compiled into JavaScript in the `/dist` directory.
2. **Scrape**: The script fetches the list of episodes.
3. **Incremental Analysis**: It skips episodes found in the historical archive.
4. **Process**: It scrapes new episodes, parses the tracklist, and creates a normalized key for each song.
5. **Update Archive**: The `tracks.json` file is updated with all aggregated data.
6. **Export**: Only new tracks are saved into the `new_tracks_for_tidal.txt` file.

## 🔄 Updating the Streaming Playlist
Since direct API uploads are unstable, the recommended method uses the exported text file:

1. **Run the script** (`npm start`) to generate the latest (`new_tracks_for_tidal.txt file`).
2. Go to a playlist transfer service (e.g., **Soundiiz** or **TuneMyMusic**).
3. Use the **"Import from Text File / CSV"** option and upload the (`new_tracks_for_tidal.txt file`).
4. Choose your **existing** TIDAL/Spotify playlist as the destination.
5. The service will only add the new tracks, **automatically avoiding duplicates**.

**For daily updates, simply repeat steps 1–5.**
