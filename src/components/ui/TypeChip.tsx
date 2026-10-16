export default function TypeChip({ type }: Readonly<{ type: string }>) {
  return <span className={`chip type-${type.toLowerCase()}`}>{type}</span>;
}
