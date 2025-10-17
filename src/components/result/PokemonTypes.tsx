interface PokemonTypesProps {
  types: string[];
}

export default function PokemonTypes({ types }: PokemonTypesProps) {
  return (
    <div className="types-container my-4 text-center">
      {types.map(type => (
        <span key={type} className={`type-badge type-${type.toLowerCase()}`}>
          {type}
        </span>
      ))}
    </div>
  );
}
