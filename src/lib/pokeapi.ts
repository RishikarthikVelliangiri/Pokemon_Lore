import { EXTERNAL_APIS } from '@/utils/constants';
import { PokeAPIPokemon, PokeAPISpecies, PokeAPIAbility, PokeAPIEvolutionChain } from '@/types/api';
import { createAPIError, createNetworkError } from '@/types/errors';

// Fetch with timeout and error handling
const fetchWithTimeout = async (url: string, timeout: number = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Pokemon-Lore-Engine/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw createAPIError(response.status, `PokéAPI request failed: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw createAPIError(408, 'Request timeout');
    }
    
    throw createNetworkError(error);
  }
};

// Fetch Pokémon data
export const fetchPokemon = async (id: number): Promise<PokeAPIPokemon> => {
  try {
    const response = await fetchWithTimeout(EXTERNAL_APIS.pokeapi.pokemon(id));
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching Pokémon ${id}:`, error);
    throw error;
  }
};

// Fetch Pokémon species data (includes flavor text)
export const fetchPokemonSpecies = async (id: number): Promise<PokeAPISpecies> => {
  try {
    const response = await fetchWithTimeout(EXTERNAL_APIS.pokeapi.species(id));
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching Pokémon species ${id}:`, error);
    throw error;
  }
};

// Fetch evolution chain data
export const fetchEvolutionChain = async (url: string): Promise<PokeAPIEvolutionChain> => {
  try {
    const response = await fetchWithTimeout(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching evolution chain:`, error);
    throw error;
  }
};

// Fetch ability data
export const fetchAbility = async (name: string): Promise<PokeAPIAbility> => {
  try {
    const response = await fetchWithTimeout(EXTERNAL_APIS.pokeapi.ability(name));
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching ability ${name}:`, error);
    throw error;
  }
};

// Fetch all Pokémon data for a range
export const fetchPokemonRange = async (start: number, end: number): Promise<{
  pokemon: PokeAPIPokemon;
  species: PokeAPISpecies;
}[]> => {
  const results = [];
  
  for (let id = start; id <= end; id++) {
    try {
      console.log(`Fetching Pokémon ${id}/${end}...`);
      
      const [pokemon, species] = await Promise.all([
        fetchPokemon(id),
        fetchPokemonSpecies(id),
      ]);

      results.push({ pokemon, species });

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to fetch Pokémon ${id}:`, error);
      // Continue with next Pokémon instead of failing completely
    }
  }

  return results;
};

// Fetch Pokémon and species by name (name or id string/number)
export const fetchPokemonByName = async (nameOrId: string | number): Promise<{ pokemon: PokeAPIPokemon; species: PokeAPISpecies } | null> => {
  try {
    const name = String(nameOrId).toLowerCase();
    // Attempt to fetch species by name to get ID, then fetch pokemon by id
  const speciesResp = await fetchWithTimeout(`${EXTERNAL_APIS.pokeapi.base}/pokemon-species/${encodeURIComponent(name)}`);
  const species = await speciesResp.json();
  const pokemonResp = await fetchWithTimeout(EXTERNAL_APIS.pokeapi.pokemon(species.id));
    const pokemon = await pokemonResp.json();
    return { pokemon, species };
  } catch (error) {
    console.warn('fetchPokemonByName failed for', nameOrId, error);
    return null;
  }
};

// Extract lore text from species data
export const extractLoreText = (species: PokeAPISpecies): string => {
  const englishEntries = species.flavor_text_entries
    .filter(entry => entry.language.name === 'en')
    .map(entry => entry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ').trim())
    .filter(text => text.length > 0);

  // Remove duplicates and join
  const uniqueEntries = [...new Set(englishEntries)];
  return uniqueEntries.join(' ');
};

// Get generation number from generation name
export const getGenerationNumber = (generationName: string): number => {
  const match = /generation-(\w+)/.exec(generationName);
  if (!match) return 1;

  const romanNumerals: Record<string, number> = {
    'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9
  };

  return romanNumerals[match[1]] || 1;
};

// Map generation to commonly-known region names
export const getRegionNameFromGeneration = (generationNumber: number): string => {
  const map: Record<number, string> = {
    1: 'kanto',
    2: 'johto',
    3: 'hoenn',
    4: 'sinnoh',
    5: 'unova',
    6: 'kalos',
    7: 'alola',
    8: 'galar',
    9: 'paldea'
  };
  return map[generationNumber] || '';
};

// Test PokéAPI connection
export const testPokeAPIConnection = async (): Promise<boolean> => {
  try {
    await fetchPokemon(1); // Test with Bulbasaur
    return true;
  } catch (error) {
    console.error('PokéAPI connection test failed:', error);
    return false;
  }
};