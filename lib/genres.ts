const BLACKLIST = new Set([
  // Rule: ANY geographic name (country, region, city, nationality adjective) is blacklisted.
  // Countries / nationalities
  "italian", "italy", "swedish", "japanese", "japan", "french", "france",
  "british", "uk", "english", "irish", "ireland", "canadian", "canada",
  "ghana", "ghanaian", "mali", "malian", "arabic", "arab", "egyptian", "egypt",
  "german", "germany", "spanish", "spain", "portuguese", "portugal",
  "norwegian", "norway", "finnish", "finland", "danish", "denmark",
  "dutch", "netherlands", "australian", "australia", "american", "usa",
  "korean", "korea", "chinese", "china", "indian", "india", "turkish", "turkey",
  "mexican", "mexico", "colombian", "colombia", "brazilian", "brazil", "brasil",
  "suomi", "scottish", "welsh", "belgian", "belgium", "swiss", "switzerland",
  "lebanese", "lebanon", "swedish", "sweden", "senegalese", "senegal",
  "nigerian", "nigeria", "kenyan", "kenya", "ethiopian", "ethiopia",
  "moroccan", "morocco", "bosnian", "bosnia", "guatemalan", "guatemala",
  "persian", "iranian", "iran", "palestinian", "palestine",
  "jamaican", "jamaica", "cuban", "cuba", "argentine", "argentina",
  "ugandan", "uganda", "tanzanian", "tanzania", "congolese", "congo",
  "zimbabwean", "zimbabwe", "south african", "south africa",
  "algerian", "algeria", "tunisian", "tunisia", "libyan", "libya",
  "sudanese", "sudan", "rwandan", "rwanda", "cameroonian", "cameroon",
  "ivorian", "ivory coast", "beninese", "benin", "togolese", "togo",
  "bangladeshi", "bangladesh", "pakistani", "pakistan", "sri lankan", "sri lanka",
  "thai", "thailand", "vietnamese", "vietnam", "indonesian", "indonesia",
  "philippine", "philippines", "malaysian", "malaysia", "singaporean", "singapore",
  "greek", "greece", "romanian", "romania", "hungarian", "hungary",
  "czech", "poland", "polish", "ukrainian", "ukraine", "russian", "russia",
  "swedish", "austrian", "austria", "belgian", "croatian", "croatia",
  "serbian", "serbia", "bulgarian", "bulgaria", "slovak", "slovakia",
  "venezuelan", "venezuela", "peruvian", "peru", "chilean", "chile",
  "ecuadorian", "ecuador", "bolivian", "bolivia", "uruguayan", "uruguay",
  "paraguayan", "paraguay", "honduran", "honduras", "salvadoran", "el salvador",
  "nicaraguan", "nicaragua", "costa rican", "costa rica", "panamanian", "panama",
  "puerto rican", "puerto rico", "haitian", "haiti", "dominican", "dominican republic",
  // Cities / regions
  "london", "berlin", "paris", "new york", "new york city", "nyc", "brooklyn",
  "chicago", "detroit", "los angeles", "la", "atlanta", "houston", "miami",
  "toronto", "montreal", "amsterdam", "stockholm", "oslo", "copenhagen",
  "helsinki", "vienna", "brussels", "zurich", "rome", "milan", "naples",
  "madrid", "barcelona", "lisbon", "porto", "moscow", "tokyo", "seoul",
  "beijing", "shanghai", "mumbai", "delhi", "lagos", "accra", "nairobi",
  "johannesburg", "cape town", "kinshasa", "cairo", "casablanca", "tunis",
  "buenos aires", "santiago", "lima", "bogota", "caracas", "havana",
  // Pan-geographic
  "latin", "latino", "latina", "latin america", "south america", "north america",
  "west africa", "east africa", "central africa", "north africa", "sub-saharan africa",
  "middle east", "southeast asia", "south asia", "east asia", "pacific",
  "african", "africa", "european", "europe", "asian", "asia", "nordic",
  "scandinavian", "caribbean", "mediterranean", "balkan",
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
  "british invasion", "deconstructed club", "epic collage", "sound collage", "radio nova",
  "radio nova tunes", "radio nova 100", "radio nova 100 fm", "radio nova 100fm", "radio nova 100.0",
  "one man band", "nyege nyege tapes", "nyege nyege", "nyege", "tapes", "nyege nyege tape",
  "nyege nyege tapes 2019",
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
  "hypnagogic pop": "pop",
  "hypnagogic-pop": "pop",
  "chamber pop": "pop",
  "chamber-pop": "pop",

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
  "bebop": "jazz",
  "cool jazz": "jazz",
  "bop": "jazz",
  "avant jazz": "jazz",
  "spiritual jazz": "jazz",
  "vocal jazz": "jazz",
  "free-jazz": "jazz",
  "belgian jazz": "jazz",
  "arabic jazz": "jazz",
  "chamber jazz": "jazz",
  "jazz rock": "jazz",
  "jazz-rock": "jazz",
  "jazz funk": "jazz",
  "jazz-funk": "jazz",
  "jazz blues": "jazz",
  "aacm": "jazz",
  "jazz piano": "jazz",

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
  "ska jazz": "ska",

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
  "neo-psychedelia": "psychedelic",
  "neo psychedelia": "psychedelic",
  "psychedelia": "psychedelic",
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
  "desert blues": "blues",
  
  // Soul (all variants → soul)
  "soul": "soul",
  "neo soul": "soul",
  "neo-soul": "soul",
  "northern soul": "soul",
  "motown": "soul",
  "doo wop": "soul",
  "doo-wop": "soul",

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
  "tribal": "world",
  "folk world": "world",
  "roots": "world",
  "ethno": "world",
  "ethnic": "world",

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
