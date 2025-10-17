import { POKEMON_TYPE_COLORS } from './constants';

export const getTypeColor = (type: string): string => {
  const lowerCaseType = type.toLowerCase() as keyof typeof POKEMON_TYPE_COLORS;
  return POKEMON_TYPE_COLORS[lowerCaseType] || POKEMON_TYPE_COLORS.normal;
};
