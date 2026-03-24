const BLACKLIST = new Set([
  // Geographic / national
  "italian", "italy", "swedish", "japanese", "japan", "french", "france",
  "british", "uk", "english", "irish", "ireland", "canadian", "canada",
  "ghana", "mali", "arabic", "arab", "egyptian", "egypt", "german", "germany",
  "spanish", "spain", "portuguese", "portugal", "norwegian", "norway",
  "finnish", "finland", "danish", "denmark", "dutch", "netherlands",
  "australian", "australia", "american", "usa", "korean", "korea",
  "chinese", "china", "indian", "india", "turkish", "turkey",
  "mexican", "mexico", "colombian", "colombia", "brazilian", "brazil",
  "suomi", "scottish", "welsh", "belgian", "swiss", "lebanese",
  "swedish", "sweden", "senegalese", "nigerian", "kenyan", "ethiopian",
  "morocco", "bosnian", "bosnia", "guatemala", "persian", "nigeria", "belgium",
  "lebanon", "brasil", "palestine", "london", "african", "africa", "jamanican", "jamaica",
  "chicago", "detroit", "new york", "new york city", "nyc", "brooklyn", "berlin",
  // Instruments
  "guitar", "trumpet", "saxophone", "sitar", "piano", "drums", "bass",
  "violin", "cello", "flute", "keyboards", "organ", "synthesizer", "synth",
  "percussion", "harp", "clarinet", "trombone", "tuba", "oboe",
  // Roles / non-genre descriptors
  "composer", "seen live", "favorites", "my favorites", "favourite",
  "awesome", "beautiful", "amazing", "classic", "all",
  // Numeric / junk tags
  "11", "the flourishing zoo", "try", "60s",
  // Overly specific / non-genre
  "british invasion", "deconstructed club", "epic collage", "sound collage", "radio nova", "radio nova tunes", "radio nova 100", "radio nova 100 fm", "radio nova 100fm", "radio nova 100.0",
]);

// Merge formatting variants and semantic duplicates into canonical forms
const ALIASES: Record<string, string> = {
  // Hip-hop / rap
  "hip hop": "hip-hop",
  "rap": "hip-hop",
  "hip hop rap": "hip-hop",
  "trap": "hip-hop",
  "grime": "hip-hop",
  "instrumental hip-hop": "hip-hop",

  // Pop (all variants → pop)
  "pop": "pop",
  "synth pop": "pop",
  "synth-pop": "pop",
  "electropop": "pop",
  "electro pop": "pop",
  "electro-pop": "pop",
  "indie pop": "pop",
  "indie-pop": "pop",
  "dream pop": "pop",
  "dream-pop": "pop",
  "art-pop": "pop",
  "art pop": "pop",
  "ambient pop": "pop",

  // Jazz (all variants → jazz)
  "free jazz": "jazz",
  "avant-garde jazz": "jazz",
  "modern jazz": "jazz",
  "contemporary jazz": "jazz",
  "jazz fusion": "jazz",
  "acid jazz": "jazz",
  "nu jazz": "jazz",
  "smooth jazz": "jazz",
  "fusion": "jazz",
  "hard bop": "jazz",
  "avant jazz": "jazz",
  "spiritual jazz": "jazz",
  "vocal jazz": "jazz",
  "free-jazz": "jazz",
  "belgian jazz": "jazz",
  "arabic jazz": "jazz",
  "chamber jazz": "jazz",
  "aacm": "jazz",

  // Post-punk (all variants → post-punk)
  "post punk": "post-punk",
  "post-punk": "post-punk",
  "no wave": "post-punk",
  "no-wave": "post-punk",
  "crank-wave": "post-punk",
  "crank wave": "post-punk",
  "crankwave": "post-punk",

  // Ska (all variants → ska)
  "ska": "ska",
  "2 tone": "ska",
  "two tone": "ska",
  "2-tone": "ska",
  "ska punk": "ska",
  "ska-punk": "ska",
  "ska-jazz": "ska",

  // New wave (all variants → new wave)
  "dark wave": "new wave",
  "darkwave": "new wave",
  "gothic rock": "new wave",
  "goth rock": "new wave",
  "gothic": "new wave",

  // Post-hardcore / emo (all variants → post-hardcore → rock)
  "screamo": "post-hardcore",
  "emo": "post-hardcore",
  "emo violence": "post-hardcore",
  "emo-violence": "post-hardcore",

  // Rock (all variants → rock)
  "indie rock": "rock",
  "classic rock": "rock",
  "art rock": "rock",
  "garage rock": "rock",
  "psychedelic rock": "rock",
  "alternative rock": "rock",
  "alternative": "rock",
  "space rock": "rock",
  "krautrock": "rock",
  "stoner rock": "rock",
  "hard rock": "rock",
  "progressive rock": "rock",
  "art-rock": "rock",
  "experimental rock": "rock",
  "post-hardcore": "rock",
  
  // Post-rock (all variants → post-rock)
  "post-rock": "post-rock",
  "post rock": "post-rock",
  "math-rock": "rock",
  "math rock": "rock",

  // Noise (all variants → noise)
  "noise rock": "noise",
  "harsh noise": "noise",
  "power electronics": "noise",
  "industrial": "noise",

  // Classical (all variants → classica)
  "classical": "classica",
  "contemporary classical": "classica",
  "modern classical": "classica",
  "classical music": "classica",
  "chamber music": "classica",
  "orchestral": "classica",
  "neoclassical": "classica",
  "minimalism": "classica",
  "post-minimalism": "classica",
  "post minimalism": "classica",

  // R&B (all variants → r&b)
  "r&b": "r&b",
  "rnb": "r&b",
  "rhythm and blues": "r&b",
  
  // Folk (all variants → folk)
  "avant-folk": "folk",
  "psychedelic folk": "folk",
  "folk": "folk",
  "indie folk": "folk",
  "indie-folk": "folk",
  "neo-folk": "folk",
  "neo folk": "folk",
  "dark-folk": "folk",
  "dark folk": "folk",
  "neofolk": "folk",
  
  // Reggae (all variants → reggae)
  "reggae": "reggae",
  "dancehall": "reggae",
  "roots reggae": "reggae",
  "rootes": "reggae",
  "rocksteady": "reggae",
  "dub reggae": "reggae",

  // Blues (all variants → blues)
  "blues": "blues",
  "delta blues": "blues",
  "electric blues": "blues",
  "country blues": "blues",
  "acoustic blues": "blues",
  "chicago blues": "blues",
  "blues rock": "blues",
  "jump blues": "blues",
  
  // Soul (all variants → soul)
  "soul": "soul",
  "neo soul": "soul",
  "neo-soul": "soul",
  "northern soul": "soul",
  "motown": "soul",

  // Ambient (all variants → ambient)
  "ambient": "ambient",
  "dark ambient": "ambient",
  "space ambient": "ambient",
  "ambient dub": "ambient",
  "ethereal": "ambient",
  "ethernal ambient": "ambient",
  
  // Drone (all variants → drone)
  "drone": "drone",
  "drone music": "drone",
  "drone metal": "drone",
  "ambient drone": "drone",
  
  // Country (all variants → country)
  "country": "country",
  "alt country": "country",
  "alt-country": "country",
  "alternative country": "country",
  "americana": "country",
  
  // World (all variants → world)
  "world": "world",
  "world music": "world",

  // Electronic (all variants → electronic)
  "electronic": "electronic",
  "electronica": "electronic",
  "electro": "electronic",
  "idm": "electronic",

  // Other formatting fixes
  "lo fi": "lo-fi",
  "avantgarde": "avant-garde",
  "poetry": "spoken word",
};

export const normalizeGenre = (tag: string): string | null => {
  const lower = tag.toLowerCase().trim();
  if (BLACKLIST.has(lower)) return null;
  return ALIASES[lower] ?? lower;
};

export const filterGenres = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeGenre(tag);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
};
