import { fetchPokemonSpecies, fetchEvolutionChain, fetchPokemonByName } from '@/lib/pokeapi';

async function resolveFinalEvolutionByPokemonId(pokemonId: number) {
  try {
    const species = await fetchPokemonSpecies(pokemonId);
    if (!species || !species.evolution_chain?.url) {
      console.log('No species or evolution chain for', pokemonId);
      return null;
    }
    const evo = await fetchEvolutionChain(species.evolution_chain.url);
    if (!evo || !evo.chain) {
      console.log('No evolution chain data for', pokemonId);
      return null;
    }

    // Walk to the last evolution node
    let current: any = evo.chain;
    let lastName = current.species.name;
    while (current && Array.isArray(current.evolves_to) && current.evolves_to[0]) {
      current = current.evolves_to[0];
      if (current && current.species && current.species.name) lastName = current.species.name;
    }

    const finalResolved = await fetchPokemonByName(lastName).catch(() => null as any);
    if (!finalResolved || !finalResolved.pokemon) {
      console.log('Failed to resolve final evolution via PokéAPI for', lastName);
      return null;
    }

    return { name: lastName, id: finalResolved.pokemon.id };
  } catch (e) {
    console.error('Error resolving final evolution:', e);
    return null;
  }
}

async function run() {
  const target = process.argv[2] || 'charmander';
  console.log('Resolving final evolution for', target);
  let id = Number(target);
  if (isNaN(id) || id <= 0) {
    // try resolve name to pokemon to get id
    const found = await fetchPokemonByName(target).catch(() => null as any);
    if (!found || !found.pokemon) {
      console.error('Cannot find pokemon by name', target);
      process.exit(1);
    }
    id = found.pokemon.id;
  }

  const final = await resolveFinalEvolutionByPokemonId(id);
  console.log('Final evolution resolution result:', final);
}

run().catch(e => { console.error(e); process.exit(1); });
