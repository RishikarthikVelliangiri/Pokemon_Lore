'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchModule from './search/SearchModule';
import LoadingScreen from './ui/LoadingScreen';
import ErrorDisplay from './ui/ErrorDisplay';
import { PokemonSearchResult, DetailedPokemon } from '@/types/pokemon';
import { SearchResponse } from '@/types/api';
import { searchPokemon, formatErrorMessage } from '@/lib/api-client';
import PokemonDetailsScreen from './result/PokemonDetailsScreen';

type Screen = 'search' | 'details' | 'loading' | 'error';

export default function HomePage() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('search');
  const [searchResult, setSearchResult] = useState<PokemonSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    setCurrentScreen('loading');
    setError(null);

    try {
      console.log('🔍 Starting search for:', query);
      const searchResponse: SearchResponse = await searchPokemon(query);

      const detailedPokemon: DetailedPokemon = {
        id: searchResponse.id,
        name: searchResponse.name,
        spriteUrl: searchResponse.spriteUrl,
        types: searchResponse.types,
        height: searchResponse.height,
        weight: searchResponse.weight,
        species: '', // This is missing from the SearchResponse, but required by DetailedPokemon
        generation: searchResponse.generation,
        pokedexEntries: searchResponse.pokedexEntries,
        stats: searchResponse.stats,
        abilities: searchResponse.abilities.map(a => ({ name: a.name, isHidden: a.isHidden, effect: a.effect })),
        evolutionChain: searchResponse.evolutionChain,
        flavorText: searchResponse.flavorText,
      };

      const result: PokemonSearchResult = {
        pokemon: detailedPokemon,
        aiInsight: searchResponse.aiInsight,
      };

      console.log('✅ Search completed:', result.pokemon.name);
      setSearchResult(result);
      setCurrentScreen('details');
    } catch (err) {
      console.error('❌ Search failed:', err);
      const errorMessage = formatErrorMessage(err as Error);
      setError(errorMessage);
      setCurrentScreen('error');
    }
  }, []);

  const handleReturnToSearch = useCallback(() => {
    setCurrentScreen('search');
    setSearchResult(null);
    setError(null);
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'search':
        return <SearchModule key="search" onSearch={handleSearch} isLoading={false} />;
      case 'loading':
        return <LoadingScreen key="loading" />;
      case 'details':
        return searchResult ? (
          <PokemonDetailsScreen 
            key={searchResult.pokemon.id} 
            pokemon={searchResult.pokemon} 
            aiInsight={searchResult.aiInsight} 
            onNewSearch={handleReturnToSearch} 
          />
        ) : (
          <ErrorDisplay key="error-no-data" error="No data found." onRetry={handleReturnToSearch} />
        );
      case 'error':
        return <ErrorDisplay key="error" error={error} onRetry={handleReturnToSearch} />;
      default:
        return <SearchModule key="default-search" onSearch={handleSearch} isLoading={false} />;
    }
  };

  return (
    <motion.div
      className="pokedex-shell"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      onAnimationComplete={() => setIsOpen(true)}
    >
      <div className="pokedex-screen">
        <AnimatePresence mode="wait">
          {isOpen && renderScreen()}
        </AnimatePresence>
      </div>
      <div className="pokedex-hinge"></div>
      <div className="pokedex-controls">
        {/* Decorative controls can be added here */}
      </div>
    </motion.div>
  );
}
