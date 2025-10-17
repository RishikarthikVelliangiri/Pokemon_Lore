interface PokemonTitleProps {
  name: string;
  id: number;
}

export default function PokemonTitle({ name, id }: PokemonTitleProps) {
  return (
    <h2 className="text-3xl font-bold capitalize text-center my-2 text-[var(--gen5-text-dark)]">
      {name} <span className="text-[var(--gen5-light-grey)]">#{id.toString().padStart(4, '0')}</span>
    </h2>
  );
}
