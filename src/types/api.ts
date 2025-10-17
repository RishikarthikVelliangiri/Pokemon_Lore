// API Request interfaces
export interface SearchRequest {
  prompt: string;
  // If true, skip vector DB and let the LLM propose/select candidates directly.
  useLLMOnly?: boolean;
  // Number of candidates the LLM should propose (default 5)
  topN?: number;
  // If true, include per-snippet diagnostics in the response (small payload)
  diagnostics?: boolean;
}

// API Response interfaces
export interface SearchResponse {
  id: number;
  name: string;
  spriteUrl: string;
  types: string[];
  aiInsight: string;
  pokedexEntries: Array<{
    version: string;
    entry: string;
  }>;
  height: number;
  weight: number;
  abilities: Array<{
    name: string;
    effect: string;
    isHidden: boolean;
  }>;
  stats: Array<{
    name: string;
    value: number;
  }>;
  generation: number;
  evolutionChain: string[];
  flavorText: string;
  // Optional metadata describing why the AI selected this Pokémon
  aiDecision?: AIDecision;
  // Whether RAG retrieved 'look' or 'lore' snippets from the vector DB
  usedLook?: boolean;
  usedLore?: boolean;
  // The actual retrieved context snippets (look/lore) used for RAG
  retrievedContext?: string[];
  // Optional diagnostics for debugging ranking — present only when requested (small payload)
  diagnostics?: {
    perSnippet?: Array<{ id?: string; section?: string; lexicalScore?: number; semanticScore?: number; finalScore?: number }>;
  };
}

// Optional AI decision metadata included when the LLM influenced selection
export interface AIDecision {
  chosenName: string;
  reason?: string;
  confidence?: 'low' | 'medium' | 'high';
  source?: 'llm' | 'llm-rerank' | 'vector' | 'hybrid';
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    gemini: boolean;
    pinecone: boolean;
    pokeapi: boolean;
  };
}

// Error response interface
export interface APIError {
  message: string;
  code: string;
  statusCode: number;
  details?: unknown;
}

// Vector search interfaces
export interface VectorSearchResult {
  id: string;
  score: number;
  // Optional raw vector values returned from Pinecone when includeValues is requested
  values?: number[];
  metadata: {
    pokemonId: number;
    name: string;
    types: string[];
    generation: number;
    region?: string;
    loreText?: string;
    section?: string; // 'look' | 'lore' where applicable
    text?: string; // the raw text for this vector (look or lore)
    isStarterFamily?: boolean;
  };
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
}

// External API interfaces (PokéAPI)
export interface PokeAPISpecies {
  id: number;
  name: string;
  flavor_text_entries: Array<{
    flavor_text: string;
    language: {
      name: string;
    };
    version: {
      name: string;
    };
  }>;
  generation: {
    name: string;
  };
  evolution_chain: {
    url: string;
  };
}

export interface ChainLink {
  species: {
    name: string;
  };
  evolves_to: ChainLink[]; // This makes it recursive
}

export interface PokeAPIEvolutionChain {
  id: number;
  chain: ChainLink; // The chain starts with a ChainLink
}

export interface PokeAPIPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: Array<{
    type: {
      name: string;
    };
  }>;
  sprites: {
    other: {
      'official-artwork': {
        front_default: string;
      };
    };
  };
  stats: Array<{
    base_stat: number;
    stat: {
      name: string;
    };
  }>;
  abilities: Array<{
    ability: {
      name: string;
    };
    is_hidden: boolean;
  }>;
}

export interface PokeAPIAbility {
  name: string;
  effect_entries: Array<{
    effect: string;
    language: {
      name: string;
    };
  }>;
}