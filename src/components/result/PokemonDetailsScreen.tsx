/* eslint-disable @typescript-eslint/no-explicit-any */
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { Howl } from 'howler';
import { DetailedPokemon } from '@/types/pokemon';
import PokemonTitle from './PokemonTitle';
import PokemonSprite from './PokemonSprite';
import PokemonTypes from './PokemonTypes';
import PokemonBio from './PokemonBio';
import PokemonStats from './PokemonStats';
import PokemonAbilities from './PokemonAbilities';
import AIAnalysis from './AIAnalysis';

interface PokemonDetailsScreenProps {
  pokemon: DetailedPokemon;
  aiInsight: string;
  onNewSearch: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
  exit: { opacity: 0 },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function PokemonDetailsScreen({ pokemon, aiInsight, onNewSearch }: Readonly<PokemonDetailsScreenProps>) {
  useEffect(() => {
    // Prefer local cries served from the Next `public` directory. The cloned repo places
    // files under /public/cries/cries/pokemon/latest/<id>.(ogg|mp3)
    const localOgg = `/cries/cries/pokemon/latest/${pokemon.id}.ogg`;
    const localMp3 = `/cries/cries/pokemon/latest/${pokemon.id}.mp3`;
    const externalMp3 = `https://raw.githubusercontent.com/PokeAPI/cries/master/cries/pokemon/latest/${pokemon.id}.mp3`;

    let cancelled = false;
    let sound: Howl | null = null;

    async function findAndPlayCry() {
      try {
        // Check OGG first
        const tryOgg = await fetch(localOgg, { method: 'HEAD' });
        if (!cancelled && tryOgg.ok) {
          sound = new Howl({ src: [localOgg], html5: true });
        } else {
          // Try MP3 locally
          const tryMp3 = await fetch(localMp3, { method: 'HEAD' });
          if (!cancelled && tryMp3.ok) {
            sound = new Howl({ src: [localMp3], html5: true });
          } else {
            // Fallback to the external raw github file (older path)
            sound = new Howl({ src: [externalMp3], html5: true });
          }
        }

        // Short delay to let the entry animation start
        if (!cancelled && sound) {
          const timer = setTimeout(() => sound?.play(), 300);
          // Ensure we clear the timer on cleanup
          return () => clearTimeout(timer);
        }
      } catch (e) {
        // Network errors shouldn't break the UI; ignore
        console.warn('Failed to load cry for', pokemon.id, e);
      }
    }

    const cleanupTimerOrSound = findAndPlayCry();

    return () => {
      cancelled = true;
      // Stop and unload Howl if created
      if (sound) {
        if (typeof sound.stop === 'function') sound.stop();
        if (typeof (sound as any).unload === 'function') (sound as any).unload();
      }
      // If findAndPlayCry returned a cleanup function (timer), call it
      if (typeof cleanupTimerOrSound === 'function') (cleanupTimerOrSound as any)();
    };
  }, [pokemon.id]); // Re-run this effect only when the Pokémon ID changes

  // Next/Prev navigation removed — UI uses back button in AIAnalysis header

  return (
    <motion.div
      className="details-layout"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.div className="left-column" variants={itemVariants}>
        <PokemonTitle name={pokemon.name} id={pokemon.id} />
        <PokemonTypes types={pokemon.types} />
      </motion.div>

      <motion.div className="right-column" variants={itemVariants}>
  <AIAnalysis aiExplanationText={aiInsight} onReturn={onNewSearch} />
        <PokemonBio bio={pokemon.flavorText} />

        {/* Sprite and stats side-by-side */}
        <div className="stats-with-sprite">
          <div className="sprite-column">
            <PokemonSprite pokemon={pokemon} types={pokemon.types} />
          </div>
          <div className="stats-column">
            <PokemonStats stats={pokemon.stats} />
          </div>
        </div>

        {/* Abilities sit below the stats block */}
        <PokemonAbilities abilities={pokemon.abilities} />

      </motion.div>
      {/* Navigation handled inside the AIAnalysis header now */}
    </motion.div>
  );
}
