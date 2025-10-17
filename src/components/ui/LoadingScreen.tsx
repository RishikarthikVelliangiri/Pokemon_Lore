import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function LoadingScreen() {
  const [pokemonId, setPokemonId] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setPokemonId(prev => (prev % 151) + 1); // Cycle through first 151 Pokemon
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="loading-container"
    >
      <div className="silhouette-container">
        <img
          key={pokemonId}
          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`}
          alt={`Loading Pokemon ${pokemonId}`}
          className="silhouette-image"
          onLoad={() => console.debug(`Loaded Pokemon ${pokemonId}`)}
          onError={() => console.error(`Failed to load Pokemon ${pokemonId}`)}
        />
      </div>

      <p className="text-2xl mt-4 text-[var(--gen5-text-dark)]">Searching...</p>

      {/* debug panel removed */}
    </motion.div>
  );
}