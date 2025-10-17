interface PokemonBioProps {
  bio: string;
}

export default function PokemonBio({ bio }: PokemonBioProps) {
  // The flavor text can be long and contain newlines.
  const formattedBio = bio.replace(/\n/g, ' ');

  return (
    <div className="bio-container my-4 p-4 bg-gray-200 rounded-lg">
      <h3 className="text-xl font-bold mb-2 text-[var(--gen5-text-dark)] uppercase">Pokédex Entry</h3>
      <p className="text-lg text-[var(--gen5-text-dark)]">{formattedBio}</p>
    </div>
  );
}

