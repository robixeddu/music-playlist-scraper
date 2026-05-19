// Single source of truth for genre normalization (scraper side).
// Imported by lib/genres.ts and lib/claudeGenres.ts.
// web/lib/genreConfig.ts is a local copy (Next.js cannot bundle files outside web/).
// When editing genres, update BOTH this file and web/lib/genreConfig.ts.

export const BLACKLIST = new Set([
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
  "lebanese", "lebanon", "senegalese", "senegal",
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
  "austrian", "austria", "croatian", "croatia",
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

// Maps raw/variant tags → canonical genre names.
// Canonical values must have a matching entry in GENRE_FAMILY below.
export const ALIASES: Record<string, string> = {
  // Hip-hop
  "hip hop":              "hip-hop",
  "rap":                  "hip-hop",
  "hip hop rap":          "hip-hop",
  "trap":                 "hip-hop",
  "grime":                "hip-hop",
  "instrumental hip-hop": "hip-hop",

  // Pop
  "synth pop":        "pop",
  "synth-pop":        "pop",
  "electropop":       "pop",
  "electro pop":      "pop",
  "electro-pop":      "pop",
  "indie pop":        "pop",
  "indie-pop":        "pop",
  "dream pop":        "pop",
  "dream-pop":        "pop",
  "art-pop":          "pop",
  "art pop":          "pop",
  "ambient pop":      "pop",
  "hypnagogic pop":   "pop",
  "hypnagogic-pop":   "pop",
  "chamber pop":      "pop",
  "chamber-pop":      "pop",
  "disco":            "pop",

  // Jazz
  "free improvisation": "jazz",
  "free improv":        "jazz",
  "free jazz":          "jazz",
  "free-jazz":          "jazz",
  "avant-garde jazz":   "jazz",
  "avant jazz":         "jazz",
  "modern jazz":        "jazz",
  "contemporary jazz":  "jazz",
  "jazz fusion":        "jazz",
  "acid jazz":          "jazz",
  "nu jazz":            "jazz",
  "smooth jazz":        "jazz",
  "fusion":             "jazz",
  "hard bop":           "jazz",
  "bebop":              "jazz",
  "cool jazz":          "jazz",
  "bop":                "jazz",
  "spiritual jazz":     "jazz",
  "vocal jazz":         "jazz",
  "belgian jazz":       "jazz",
  "arabic jazz":        "jazz",
  "chamber jazz":       "jazz",
  "jazz rock":          "jazz",
  "jazz-rock":          "jazz",
  "jazz funk":          "jazz",
  "jazz-funk":          "jazz",
  "jazz blues":         "jazz",
  "aacm":               "jazz",
  "jazz piano":         "jazz",
  "spiritual":          "jazz",
  "improvisation":      "jazz",
  "jazz-core":          "jazz",
  "jazz core":          "jazz",
  "progressive jazz":     "jazz",
  "progressive jazz fusion":"jazz",

  // Funk
  "free-funk":      "funk",
  "psychedelic funk":"funk",

  // Punk
  "proto-punk": "punk",

  // Post-punk
  "post punk":    "post-punk",
  "no wave":      "post-punk",
  "no-wave":      "post-punk",
  "crank-wave":   "post-punk",
  "crank wave":   "post-punk",
  "crankwave":    "post-punk",

  // Ska
  "2 tone":   "ska",
  "two tone": "ska",
  "2-tone":   "ska",
  "ska punk": "ska",
  "ska-punk": "ska",
  "ska-jazz": "ska",
  "ska jazz": "ska",

  // New wave
  "dark wave":    "new wave",
  "darkwave":     "new wave",
  "gothic rock":  "new wave",
  "goth rock":    "new wave",
  "gothic":       "new wave",

  // Post-hardcore
  "noise-core":    "post-hardcore",
  "screamo":       "post-hardcore",
  "emo":           "post-hardcore",
  "emo violence":  "post-hardcore",
  "emo-violence":  "post-hardcore",

  // Rock
  "indie rock":       "rock",
  "indie":            "rock",
  "slacker indie":    "rock",
  "classic rock":     "rock",
  "art rock":         "rock",
  "art-rock":         "rock",
  "garage rock":      "rock",
  "garage":           "rock",
  "psychedelic rock": "rock",
  "alternative rock": "rock",
  "alternative":      "rock",
  "space rock":       "rock",
  "stoner rock":      "rock",
  "hard rock":        "rock",
  "progressive rock": "rock",
  "experimental rock":"rock",
  "surf rock":         "rock",
  "surf":              "rock",

  // Psychedelic
  "neo-psychedelia": "psychedelic",
  "neo psychedelia": "psychedelic",
  "psychedelia":     "psychedelic",
  "psych rock":      "psychedelic",
  "krautrock":        "psychedelic",

  // Post-rock
  "post rock":  "post-rock",
  "math-rock":  "post-rock",
  "math rock":  "post-rock",

  // Noise
  "noise rock":       "noise",
  "harsh noise":      "noise",

  // Industrial
  "industrial rock":   "industrial",
  "industrial metal":  "industrial",
  "post-industrial":   "industrial",

  // Metal
  "heavy metal":      "metal",
  "death metal":      "metal",
  "black metal":      "metal",
  "doom metal":       "metal",
  "sludge metal":     "metal",
  "noise metal":      "metal",
  "post-metal":       "metal",
  "math metal":       "metal",
  "thrash metal":     "metal",
  "progressive metal":"metal",

  // Classica
  "classical":              "classica",
  "contemporary classical": "classica",
  "modern classical":       "classica",
  "classical music":        "classica",
  "chamber music":          "classica",
  "orchestral":             "classica",
  "neoclassical":           "classica",
  "minimalism":             "classica",
  "minimalist":             "classica",
  "post-minimalism":        "classica",
  "post minimalism":        "classica",
  "baroque":                "classica",

  // R&B
  "rnb":              "r&b",
  "rhythm and blues": "r&b",

  // Folk
  "avant-folk":       "folk",
  "nu folk":           "folk",
  "psychedelic folk": "folk",
  "progressive folk":   "folk",
  "psych-folk":       "folk",
  "indie folk":       "folk",
  "indie-folk":       "folk",
  "neo-folk":         "folk",
  "neo folk":         "folk",
  "dark-folk":        "folk",
  "dark folk":        "folk",
  "neofolk":          "folk",
  "folktronica":      "folk",
  "punjabi":          "folk",
  "devotional folk":  "folk",
  "contemporary folk": "folk",

  // Reggae
  "dancehall":    "reggae",
  "roots reggae": "reggae",
  "rootes":       "reggae",
  "rocksteady":   "reggae",

  // Dub
  "balkan dub": "dub",

  // Blues
  "delta blues":    "blues",
  "electric blues": "blues",
  "country blues":  "blues",
  "acoustic blues": "blues",
  "chicago blues":  "blues",
  "blues rock":     "blues",
  "jump blues":     "blues",
  "desert blues":   "blues",
  "mali blues":     "blues",

  // Soul
  "neo soul":      "soul",
  "neo-soul":      "soul",
  "northern soul": "soul",
  "motown":        "soul",
  "doo wop":       "soul",
  "doo-wop":       "soul",
  "gospel":        "soul",
  "soul jazz":     "soul",
  "soul-jazz":     "soul",
  "soul funk":     "soul",
  "soul-funk":     "soul",

  // Ambient
  "dark ambient":    "ambient",
  "space ambient":   "ambient",
  "ambient dub":     "ambient",
  "ethereal":        "ambient",
  "ethernal ambient":"ambient",

  // Drone
  "drone music":  "drone",
  "drone metal":  "drone",
  "ambient drone":"drone",

  // Country
  "alt country":        "country",
  "alt-country":        "country",
  "alternative country":"country",
  "americana":          "country",
  "indie-country":      "country",
  "indie country":      "country",
  "country rock":       "country",
  "country-folk":       "country",
  "country folk":       "country",
  "cowpunk":            "country",

  // World
  "world music": "world",
  "tribal":      "world",
  "folk world":  "world",
  "roots":       "world",
  "ethno":       "world",
  "ethnic":      "world",
  "flamenco":    "world",
  "tropical":    "world",
  "highlife":    "world",
  "salsa":       "world",
  "raï":         "world",
  "rebetiko":    "world",
  "qawwali":     "world",
  "traditional": "world",
  "brass band":  "world",
  "benga":       "world",

  // Electronic
  "electronica":    "electronic",
  "electro":        "electronic",
  "idm":            "electronic",
  "dance":          "electronic",
  "drum-and-bass":  "electronic",
  "drum and bass":  "electronic",
  "drum & bass":    "electronic",
  "d&b":            "electronic",
  "dnb":            "electronic",
  "breakcore":      "electronic",
  "glitch":         "electronic",
  "bass music":     "electronic",
  "bass-music":     "electronic",
  "footwork":       "electronic",
  "jungle":         "electronic",
  "wonky":         "electronic",
  "wonky beats":   "electronic",
  "wonky-beats":   "electronic",

  // Experimental
  "avant-garde":      "experimental",
  "avantgarde":       "experimental",
  "spoken word":      "experimental",
  "spoken-word":      "experimental",
  "poetry":           "experimental",
  "vocal":            "experimental",
  "field recordings": "experimental",
  "field recording":  "experimental",
  "musique concrète": "experimental",
  "musique concrete": "experimental",

  // Soundtrack
  "ost":        "soundtrack",
  "film score": "soundtrack",
  "film music": "soundtrack",
  "score":      "soundtrack",
  "bollywood":   "soundtrack",

  // Formatting fixes
  "lo fi": "lo-fi",
};

// Canonical genre → display family (controls ordering in the UI).
export const GENRE_FAMILY: Record<string, string> = {
  // Classical
  classica:           "1-classical",
  // Jazz
  jazz:               "2-jazz",
  blues:              "2-jazz",
  "bossa nova":       "2-jazz",
  mpb:                "2-jazz",
  samba:              "2-jazz",
  soul:               "2-jazz",
  // Electronic
  ambient:            "3-electronic",
  chillout:           "3-electronic",
  downtempo:          "3-electronic",
  minimal:            "3-electronic",
  drone:              "3-electronic",
  dub:                "3-electronic",
  electroacoustic:    "3-electronic",
  electronic:         "3-electronic",
  house:              "3-electronic",
  "lo-fi":            "3-electronic",

  "new age":          "3-electronic",
  noise:              "3-electronic",
  techno:             "3-electronic",
  trance:             "3-electronic",
  "trip-hop":         "3-electronic",
  // Experimental
  experimental:       "4-experimental",
  instrumental:       "4-experimental",
  // Rock
  industrial:         "5-rock",
  metal:              "5-rock",
  "new wave":         "5-rock",
  "post-hardcore":    "5-rock",
  "post-punk":        "5-rock",
  "post-rock":        "5-rock",
  psychedelic:        "5-rock",
  punk:               "5-rock",
  rock:               "5-rock",
  shoegaze:           "5-rock",
  ska:                "5-rock",
  // Hip-hop & R&B
  funk:               "6-hiphop",
  "hip-hop":          "6-hiphop",
  "r&b":              "6-hiphop",
  // Pop
  pop:                "7-pop",
  "singer-songwriter":"7-pop",
  // Folk
  acoustic:           "8-folk",
  country:            "8-folk",
  folk:               "8-folk",
  // World
  afrobeat:           "9-world",
  calypso:            "9-world",
  cumbia:             "9-world",
  flamenco:           "9-world",
  reggae:             "9-world",
  world:              "9-world",
  // Soundtrack
  soundtrack:         "10-soundtrack",
  // Untagged
  "no-genre":         "11-untagged",
};
