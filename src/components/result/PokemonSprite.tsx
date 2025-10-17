import { DetailedPokemon } from '@/types/pokemon';
import Image from 'next/image';
import { useState, useEffect } from 'react';

// Lazy import types from pokemon-assets if available at runtime
// Use local SVG assets cloned into public/pokemon-assets
const typeIconPath = (typeName: string) => `/pokemon-assets/assets/svg/types/${typeName.toLowerCase()}.svg`;

interface PokemonSpriteProps {
  pokemon: DetailedPokemon;
  types?: string[]; // optional override to render types under the sprite
}

export default function PokemonSprite(props: Readonly<PokemonSpriteProps>) {
  const { pokemon, types } = props;
  // The instructions recommend Smogon's animated sprites.
  // The modern URL for these seems to be from Pokemon Showdown.
  const animatedSpriteUrl = `https://play.pokemonshowdown.com/sprites/xyani/${pokemon.name.toLowerCase()}.gif`;
  const [spriteSrc, setSpriteSrc] = useState(animatedSpriteUrl);

  // Reset spriteSrc when pokemon changes
  useEffect(() => {
    setSpriteSrc(animatedSpriteUrl);
  }, [animatedSpriteUrl]);

  return (
    <div>
      <div className="sprite-container">
        <Image
          src={spriteSrc}
          alt={pokemon.name}
          className="pokemon-sprite"
          width={150}
          height={150}
          unoptimized
          onError={() => {
            if (spriteSrc !== pokemon.spriteUrl) {
              setSpriteSrc(pokemon.spriteUrl);
            }
          }}
        />
      </div>

      {/* Name and number under the sprite for quick reference */}
      <div className="sprite-caption mt-2 text-center">
        <div className="pokemon-name font-bold capitalize">{pokemon.name}</div>
        <div className="pokemon-number text-[var(--gen5-light-grey)]">#{pokemon.id.toString().padStart(4, '0')}</div>
      </div>

      {/* Render type badges below the sprite to match in-game layout */}
      <div className="sprite-type-row mt-2 text-center">
        {(types || pokemon.types || []).map((t: string) => (
          <span key={t} className={`type-badge type-${t.toLowerCase()}`} title={t} aria-label={t}>
            <Image src={typeIconPath(t)} alt={`${t} icon`} width={28} height={28} unoptimized />
          </span>
        ))}
      </div>
    </div>
  );
}