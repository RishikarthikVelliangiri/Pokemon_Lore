import { DetailedPokemon } from '@/types/pokemon';
import Image from 'next/image';
import { useState, useEffect } from 'react';

const TYPE_ICON_BASE_URL = 'https://raw.githubusercontent.com/itsjavi/pokemon-assets/gh-pages/assets/svg/types';
const typeIconPath = (typeName: string) => `${TYPE_ICON_BASE_URL}/${typeName.toLowerCase()}.svg`;

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
  const [typeIconFailures, setTypeIconFailures] = useState<Record<string, boolean>>({});

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
        {(types || pokemon.types || []).map((t: string) => {
          const key = t.toLowerCase();
          const iconFailed = typeIconFailures[key];

          return (
            <span key={t} className={`type-badge type-${key}`} title={t} aria-label={t}>
              {iconFailed ? (
                <span className="type-badge-label">{t.slice(0, 1)}</span>
              ) : (
                <Image
                  src={typeIconPath(t)}
                  alt={`${t} icon`}
                  width={28}
                  height={28}
                  unoptimized
                  onError={() => {
                    setTypeIconFailures(prev => (prev[key] ? prev : { ...prev, [key]: true }));
                  }}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}