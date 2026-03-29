export type Lang = "it" | "en";

export const LANGS: Lang[] = ["it", "en"];
export const DEFAULT_LANG: Lang = "it";

export interface Translations {
  noPrograms: string;
  sectionGlobal: string;
  sectionGenre: string;
  sectionEpisode: string;
  tracksOnTidal: (found: number, total: number) => string;
  noGenres: string;
  noEpisodes: string;
  tracks: string;
  import: string;
  importing: string;
  importSuccess: (added: number, present: number) => string;
  importError: string;
  noTidalTracks: string;
  connectTidal: string;
  connected: string;
  disconnectTitle: string;
  footerData: string;
}

export const translations: Record<Lang, Translations> = {
  it: {
    noPrograms: "Nessun programma attivo.",
    sectionGlobal: "Globale",
    sectionGenre: "Per genere",
    sectionEpisode: "Per episodio",
    tracksOnTidal: (f, t) => `${f} / ${t} tracce su TIDAL`,
    noGenres: "Nessun genere con tracce TIDAL disponibili.",
    noEpisodes: "Nessun episodio disponibile.",
    tracks: "tracce",
    import: "Importa",
    importing: "Importazione...",
    importSuccess: (a, p) => `✓ ${a} aggiunti, ${p} già presenti`,
    importError: "Errore",
    noTidalTracks: "Nessuna traccia TIDAL disponibile",
    connectTidal: "Connetti TIDAL",
    connected: "Connesso",
    disconnectTitle: "Clicca per disconnetterti",
    footerData: "Dati da",
  },
  en: {
    noPrograms: "No active programs.",
    sectionGlobal: "Global",
    sectionGenre: "By genre",
    sectionEpisode: "By episode",
    tracksOnTidal: (f, t) => `${f} / ${t} tracks on TIDAL`,
    noGenres: "No genres with TIDAL tracks available.",
    noEpisodes: "No episodes available.",
    tracks: "tracks",
    import: "Import",
    importing: "Importing...",
    importSuccess: (a, p) => `✓ ${a} added, ${p} already present`,
    importError: "Error",
    noTidalTracks: "No TIDAL tracks available",
    connectTidal: "Connect TIDAL",
    connected: "Connected",
    disconnectTitle: "Click to disconnect",
    footerData: "Data from",
  },
};
