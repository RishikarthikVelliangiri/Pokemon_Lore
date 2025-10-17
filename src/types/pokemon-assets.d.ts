declare module 'pokemon-assets' {
  interface PokemonAssets {
    // Mapping of lowercase type name to icon URL or path
    typeIcons: Record<string, string>;
    // Optional metadata the package may export
    version?: string;
  }

  const assets: PokemonAssets;
  export = assets;
}
