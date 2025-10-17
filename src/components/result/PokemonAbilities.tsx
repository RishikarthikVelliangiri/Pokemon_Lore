/* eslint-disable @typescript-eslint/no-explicit-any */
import { PokemonAbility } from '@/types/pokemon';

interface PokemonAbilitiesProps {
  readonly abilities: ReadonlyArray<PokemonAbility>;
}

export default function PokemonAbilities({ abilities }: PokemonAbilitiesProps) {
  // If the abilities prop is missing, render nothing.
  if (!abilities) return null;

  // If the array is empty, show a small placeholder so the user knows there are no abilities.
  if (abilities.length === 0) {
    return (
      <div className="abilities-container">
        <div className="ability-box">
          <p className="ability-description">No abilities available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="abilities-container">
      {abilities.map((ability, idx) => {
        const name = ability.name ? ability.name.replace(/-/g, ' ') : 'Unknown';
        // Support both `effect` and legacy `description` keys depending on API path
        const desc = (ability as any).effect ?? (ability as any).description ?? 'No description available.';
        let headerLabel = 'Ability';
        if (idx !== 0 && ability.isHidden) {
          headerLabel = 'Hidden Ability';
        }

        return (
          <div className="ability-display-container" key={`${name}-${idx}`}>
            <div className="ability-header">
              <p>{headerLabel}</p>
            </div>
            <div className="ability-body">
              <h3 className="ability-name">{name}</h3>
              <p className="ability-description">{desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
