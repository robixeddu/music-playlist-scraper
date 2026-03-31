// Canonical genre → display family (for proximity sorting in UI)
// Keep in sync with lib/genres.ts GENRE_FAMILY
export const GENRE_FAMILY: Record<string, string> = {
  classica:           "1-classical",
  // Jazz & relatives
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
  drone:              "3-electronic",
  dub:                "3-electronic",
  electroacoustic:    "3-electronic",
  electronic:         "3-electronic",
  house:              "3-electronic",
  "lo-fi":            "3-electronic",
  minimal:            "3-electronic",
  "new age":          "3-electronic",
  noise:              "3-electronic",
  "post-industrial":  "3-electronic",
  techno:             "3-electronic",
  trance:             "3-electronic",
  "trip-hop":         "3-electronic",
  // Experimental
  "avant-garde":      "4-experimental",
  experimental:       "4-experimental",
  "free improvisation": "4-experimental",
  instrumental:       "4-experimental",
  "spoken word":      "4-experimental",
  // Rock & derivatives
  indie:              "5-rock",
  shoegaze:           "5-rock",
  "new wave":         "5-rock",
  "post-hardcore":    "5-rock",
  "post-punk":        "5-rock",
  "post-rock":        "5-rock",
  psychedelic:        "5-rock",
  punk:               "5-rock",
  rock:               "5-rock",
  ska:                "5-rock",
  // Hip-hop & R&B
  funk:               "6-hiphop",
  "hip-hop":          "6-hiphop",
  "r&b":              "6-hiphop",
  // Pop
  pop:                "7-pop",
  "singer-songwriter": "7-pop",
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
