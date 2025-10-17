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
    // Try local cries first (expected under /public/cries/pokemon/latest/) then fallback to the
    // public GitHub dataset to cover environments where the local assets are not bundled.
    const cryCandidates = [
      `/cries/pokemon/latest/${pokemon.id}.ogg`,
      `/cries/pokemon/latest/${pokemon.id}.mp3`,
      `https://raw.githubusercontent.com/PokeAPI/cries/master/cries/pokemon/latest/${pokemon.id}.ogg`,
      `https://raw.githubusercontent.com/PokeAPI/cries/master/cries/pokemon/latest/${pokemon.id}.mp3`,
    ] as const;

    let cancelled = false;
    let sound: Howl | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function findAndPlayCry() {
      for (const candidate of cryCandidates) {
        if (cancelled) break;

        try {
          const response = candidate.startsWith('http')
            ? await fetch(candidate, { method: 'HEAD', mode: 'cors' })
            : await fetch(candidate, { method: 'HEAD' });

          if (!response.ok) {
            continue;
          }

          const format = candidate.endsWith('.ogg') ? ['ogg'] : ['mp3'];
          sound = new Howl({ src: [candidate], html5: true, format });
          break;
        } catch (error) {
          // HEAD may fail for cross-origin, so allow Howler to try loading remote assets directly
          if (candidate.startsWith('http')) {
            const format = candidate.endsWith('.ogg') ? ['ogg'] : ['mp3'];
            sound = new Howl({ src: [candidate], html5: true, format });
            break;
          }
        }
      }

      if (!cancelled && sound) {
        timer = setTimeout(() => sound?.play(), 300);
      } else if (!sound) {
        console.warn('No cry available for Pokémon', pokemon.id);
      }
    }

    findAndPlayCry();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (sound) {
        if (typeof sound.stop === 'function') sound.stop();
        if (typeof (sound as any).unload === 'function') (sound as any).unload();
      }
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
