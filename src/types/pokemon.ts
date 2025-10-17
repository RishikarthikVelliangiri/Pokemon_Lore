export interface Pokemon {
  id: number;
  name: string;
  spriteUrl: string;
  types: string[];
  height: number;
  weight: number;
  species: string;
  generation: number;
}

export interface PokedexEntry {
  version: string;
  entry: string;
}

export interface PokemonStat {
  name: string;
  value: number;
}

export interface PokemonAbility {
  name: string;
  isHidden: boolean;
  effect: string;
}

export interface PokemonType {
  name: string;
  color: string;
}

export interface DetailedPokemon extends Pokemon {
  pokedexEntries: PokedexEntry[];
  stats: PokemonStat[];
  abilities: PokemonAbility[];
  evolutionChain: string[];
  flavorText: string;
}

export interface PokemonSearchResult {
  pokemon: DetailedPokemon;
  aiInsight: string;
}

export function isDetailedPokemon(obj: unknown): obj is DetailedPokemon {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj && typeof obj.id === 'number' &&
    'name' in obj && typeof obj.name === 'string' &&
    'spriteUrl' in obj && typeof obj.spriteUrl === 'string' &&
    'types' in obj && Array.isArray(obj.types) &&
    'height' in obj && typeof obj.height === 'number' &&
    'weight' in obj && typeof obj.weight === 'number' &&
    'species' in obj && typeof obj.species === 'string' &&
    'pokedexEntries' in obj && Array.isArray(obj.pokedexEntries) &&
    'stats' in obj && Array.isArray(obj.stats) &&
    'abilities' in obj && Array.isArray(obj.abilities) &&
    'generation' in obj && typeof obj.generation === 'number' &&
    'evolutionChain' in obj && Array.isArray(obj.evolutionChain) &&
    'flavorText' in obj && typeof obj.flavorText === 'string'
  );
}