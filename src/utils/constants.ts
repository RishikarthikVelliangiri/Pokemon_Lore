// Application constants
export const APP_CONFIG = {
  name: 'LoreDex',
  description: 'Discover Pokémon through natural language queries',
  version: '1.0.0',
  maxQueryLength: 500,
  searchTimeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  exampleQueries: [
    'A mouse that can use electric attacks',
    'The final evolution of the fire starter from Kanto',
    'A legendary Pokémon that controls time',
    'A ghost that lives in a teapot',
  ],
} as const;

// API endpoints
export const API_ENDPOINTS = {
  search: '/api/search',
  health: '/api/health',
} as const;

// External API URLs
export const EXTERNAL_APIS = {
  pokeapi: {
    base: 'https://pokeapi.co/api/v2',
    pokemon: (id: number) => `https://pokeapi.co/api/v2/pokemon/${id}`,
    species: (id: number) => `https://pokeapi.co/api/v2/pokemon-species/${id}`,
    ability: (name: string) => `https://pokeapi.co/api/v2/ability/${name}`,
  },
} as const;

// Pokémon type colors for UI
export const POKEMON_TYPE_COLORS = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
} as const;

// Animation durations
export const ANIMATION_DURATIONS = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  loading: 2.0,
} as const;

// Validation constants
// allow Unicode letters (\p{L}) so accented characters like "é" in "Pokémon" are accepted
export const VALIDATION = {
  minQueryLength: 3,
  maxQueryLength: 500,
  // Disallow control characters and angle brackets while permitting accented letters and other Unicode characters
  // This avoids relying on Unicode property escapes which may cause runtime issues in some environments
  allowedCharacters: /^[^\x00-\x1F<>]+$/,
} as const;

// Tunable search/Rerank weights (exposed here for easier experimentation)
export const TUNING = {
  candidateK: 12, // increase candidate pool slightly to give semantic scoring more options
  semanticWeight: 13.0, // increase semantic multiplier to favor semantic matches more strongly
  loreBoost: 3.7, // slightly favor lore snippets
  tokenOverlapBoost: 1.0, // reduce token overlap lexical boost further to avoid lexical dominance
  // How large the margin (topFinal - runnerUpFinal) must be to skip LLM proposer/reranker and trust vector ranking
  llmFallbackMargin: 1.5,
  exactNameBoost: 3.0,
  nameTokenBoost: 1.5,
  typeMatchBoost: 1.0,
  regionBoost: 2.5,
  starterFamilyBoost: 3.5,
} as const;

// Default placeholders and messages
export const UI_TEXT = {
  searchPlaceholder: 'Describe a Pokémon... (e.g., "a fire-breathing dragon" or "a cute electric mouse")',
  searchButton: 'Search',
  loadingMessage: 'Searching for the perfect Pokémon match...',
  noResultsMessage: 'No Pokémon found matching your description.',
  errorMessage: 'Something went wrong. Please try again.',
  newSearchButton: 'New Search',
  aiInsightTitle: 'AI Analysis',
  pokemonDataTitle: 'Pokémon Details',
  statsTitle: 'Base Stats',
  abilitiesTitle: 'Abilities',
  pokedexTitle: 'Pokédex Entries',
} as const;

// Stat names mapping
export const STAT_NAMES = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  'special-attack': 'Sp. Attack',
  'special-defense': 'Sp. Defense',
  speed: 'Speed',
} as const;

// Official starter base Pokémon by region (base-stage names, lowercase)
export const STARTERS_BY_REGION: Record<string, string[]> = {
  kanto: ['bulbasaur', 'charmander', 'squirtle'],
  johto: ['chikorita', 'cyndaquil', 'totodile'],
  hoenn: ['treecko', 'torchic', 'mudkip'],
  sinnoh: ['turtwig', 'chimchar', 'piplup'],
  unova: ['snivy', 'tepig', 'oshawott'],
  kalos: ['chespin', 'fennekin', 'froakie'],
  alola: ['rowlet', 'litten', 'popplio'],
  galar: ['grookey', 'scorbunny', 'sobble'],
  paldea: ['sprigatito', 'fuecoco', 'quaxly'],
} as const;

// Helper: flattened list of all starter base names
export const ALL_STARTER_BASES = Object.values(STARTERS_BY_REGION).flat();


// Environment variables - using direct process.env access for better compatibility
export const ENV = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  get geminiApiKey() { return process.env.GOOGLE_GEMINI_API_KEY; },
  get pineconeApiKey() { return process.env.PINECONE_API_KEY; },
  get pineconeEnvironment() { return process.env.PINECONE_ENVIRONMENT; },
  get pineconeIndexName() { return process.env.PINECONE_INDEX_NAME || 'pokemon-lore-vectors'; },
} as const;