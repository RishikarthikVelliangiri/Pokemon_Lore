export type KeywordOverride = {
  keywords: string[];
  names: string[];
  description?: string;
  loreHints?: string[];
};

const KEYWORD_OVERRIDES: KeywordOverride[] = [
  {
    keywords: ['teapot', 'teacup', 'tea'],
    names: ['polteageist', 'sinistea'],
    description: 'tea-themed pottery spirits',
  },
  {
    keywords: ['ideal', 'ideals', 'ideology'],
    names: ['zekrom'],
    description: 'references to ideals map to the yin legendary',
  },
  {
    keywords: ['truth', 'truths', 'truthful', 'seeking truth', 'seeking truths'],
    names: ['reshiram'],
    description: 'truth-seeking queries map to the yang legendary',
    loreHints: [
      'Reshiram burns away lies with its flames and is celebrated as the Vast White Pokémon of truth.',
    ],
  },
  {
    keywords: [
      'sun light',
      'sunlight',
      "sun's light",
      'replace the sun',
      'replace the suns light',
      'carry the sun',
      'solar deity',
      'sun god',
      'sunflare',
    ],
    names: ['volcarona'],
    description: 'queries about replacing the sun or radiating sunlight',
    loreHints: [
      'According to ancient lore, Volcarona is revered as a replacement for the sun, shining to save people from freezing.',
    ],
  },
  {
    keywords: [
      'guardian of the seas',
      'guardian of the sea',
      'sea guardian',
      'calm storms',
      'soothe storms',
      'ocean guardian',
    ],
    names: ['lugia'],
    description: 'sea-guardian and storm-calming lore cues',
    loreHints: [
      'Legends say Lugia calms raging storms and is hailed as the guardian of the seas.',
    ],
  },
  {
    keywords: ['carry continents', 'carries continents', 'move continents', 'pull continents', 'continent mover'],
    names: ['regigigas'],
    description: 'queries about moving continents',
    loreHints: [
      'Regigigas is said to have towed the continents with ropes in ancient times.',
    ],
  },
  {
    keywords: ['create land', 'created the land', 'land creator', 'raise continents', 'expand land'],
    names: ['groudon'],
    description: 'land-creating lore cues',
    loreHints: [
      'Groudon is described as the Continent Pokémon that expanded the landmass with volcanic eruptions.',
    ],
  },
  {
    keywords: [
      'expanded the seas',
      'expand the seas',
      'created the oceans',
      'create the oceans',
      'endless rain',
      'primordial ocean',
      'sea basin pokemon',
    ],
    names: ['kyogre'],
    description: 'ocean-creating lore cues',
    loreHints: [
      'Kyogre expanded the seas with endless rain and tidal waves as the Sea Basin Pokémon.',
    ],
  },
  {
    keywords: [
      'calms groudon and kyogre',
      'quell groudon and kyogre',
      'calm the weather trio',
      'calms the weather trio',
      'guardian of the ozone layer',
      'controls the skies',
      'sky high pokemon',
    ],
    names: ['rayquaza'],
    description: 'sky guardian and weather mediator cues',
    loreHints: [
      'Rayquaza dwells in the ozone layer and calms Groudon and Kyogre when their clash rages out of control.',
    ],
  },
  {
    keywords: ['controls time', 'control time', 'time god', 'time deity', 'temporal pokemon'],
    names: ['dialga'],
    description: 'time-controlling lore cues',
    loreHints: [
      'Dialga controls time itself, making its flow possible as the Temporal Pokémon.',
    ],
  },
  {
    keywords: ['controls space', 'control space', 'space god', 'space deity', 'spatial pokemon'],
    names: ['palkia'],
    description: 'space-controlling lore cues',
    loreHints: [
      'Palkia controls space and warps dimensions as the Spatial Pokémon.',
    ],
  },
  {
    keywords: [
      'distortion world',
      'ruler of the distortion world',
      'antimatter pokemon',
      'banished for violence',
      'renegade pokemon',
    ],
    names: ['giratina'],
    description: 'distortion-world and antimatter lore cues',
    loreHints: [
      'Giratina was banished for its violence and now rules the Distortion World as the Renegade Pokémon.',
    ],
  },
  {
    keywords: [
      'original one',
      'creator of the universe',
      'created the universe',
      'alpha pokemon',
      'shaped the universe',
      'creation deity',
    ],
    names: ['arceus'],
    description: 'creation deity lore cues',
    loreHints: [
      'Arceus is revered as the Original One who shaped the universe with its thousand arms.',
    ],
  },
];

const normalize = (text: string) => text.toLowerCase();

export const findKeywordOverride = (
  query: string
): { override: KeywordOverride; matchedKeywords: string[] } | null => {
  const normalizedQuery = normalize(query);

  for (const override of KEYWORD_OVERRIDES) {
    const matched = override.keywords.filter(keyword => normalizedQuery.includes(keyword));
    if (matched.length > 0) {
      return { override, matchedKeywords: matched };
    }
  }

  return null;
};

export const keywordOverrides = KEYWORD_OVERRIDES;
