#!/usr/bin/env tsx
import assert from 'node:assert';
import { buildRagContext } from '../src/lib/rag-context';

type MockVector = { section?: string; text?: string };

type ScoreCandidate = { candidate: { metadata: Record<string, any> } };

const runTest = async () => {
  const targetPokemonId = 25;
  const otherPokemonId = 6;

  const mockFetch = async (pokemonId: number, _topK?: number): Promise<MockVector[]> => {
    if (pokemonId === targetPokemonId) {
      return [
        { section: 'lore', text: 'Raichu stores electricity to unleash powerful thunderbolts.' },
        { section: 'look', text: 'Raichu balances on its tail like a lightning rod.' },
      ];
    }
    return [
      { section: 'lore', text: 'Charizard breathes intense flames.' },
    ];
  };

  const scoreCandidates: ScoreCandidate[] = [
    { candidate: { metadata: { pokemonId: targetPokemonId, section: 'lore', text: 'Raichu is diligent in training its electric power.' } } },
    { candidate: { metadata: { pokemonId: otherPokemonId, section: 'lore', text: 'Charizard flies using its strong wings.' } } },
  ];

  const abilityDescriptions = {
    static: 'The Pokémon may cause paralysis if touched.',
  };

  const pokemonStats = [
    { name: 'Speed', value: 110 },
    { name: 'Special Attack', value: 95 },
  ];

  const result = await buildRagContext({
    scoreCandidates,
    pokemonId: targetPokemonId,
    fetchVectorsByPokemonId: mockFetch,
    abilityDescriptions,
    pokemonStats,
    maxSnippets: 5,
  });

  assert(result.contextEntries.length > 0, 'Expected context entries to be generated');
  assert(
    result.contextEntries.every(entry => entry.pokemonId === targetPokemonId),
    'All context entries should belong to the selected Pokémon'
  );

  const abilityEntry = result.contextEntries.find(entry => entry.section.toLowerCase() === 'ability');
  assert(abilityEntry, 'Ability-based context entry should be present when lore is sparse');

  const statsEntry = result.contextEntries.find(entry => entry.section.toLowerCase() === 'stats');
  assert(statsEntry, 'Stats-based context entry should be present when lore is sparse');

  const manualHint = 'Legends say Lugia calms raging storms and guards the seas.';
  const manualResult = await buildRagContext({
    scoreCandidates: [],
    pokemonId: 249,
    fetchVectorsByPokemonId: async () => [],
    abilityDescriptions: undefined,
    pokemonStats: [],
    manualEntries: [{ section: 'lore', text: manualHint }],
  });

  assert(
    manualResult.contextEntries.some(entry => entry.text.includes('calms raging storms')),
    'Manual lore hint should be included in context entries'
  );

  console.log('✅ RAG context regression test passed: context restricted to selected Pokémon, enriched with abilities/stats, and manual lore hints included.');
};

runTest().catch(err => {
  console.error('❌ RAG context regression test failed:', err);
  process.exit(1);
});
