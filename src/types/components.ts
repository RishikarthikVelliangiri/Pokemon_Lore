import { SearchResponse } from './api';

// Component prop interfaces
export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder?: string;
  maxLength?: number;
}

export interface SearchModuleProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export interface SubmitButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

export interface PokemonHeroProps {
  id: number;
  name: string;
  spriteUrl: string;
  types: string[];
}

export interface AIInsightCardProps {
  insight: string;
}

export interface PokemonDataCardProps {
  height: number;
  weight: number;
  abilities: Array<{
    name: string;
    effect: string;
    isHidden: boolean;
  }>;
  stats: Array<{
    name: string;
    value: number;
  }>;
  pokedexEntries: Array<{
    version: string;
    entry: string;
  }>;
  generation: number;
  evolutionChain: string[];
  flavorText: string;
}

export interface ResultViewProps {
  result: SearchResponse;
  onNewSearch: () => void;
}

export interface LoadingSpinnerProps {
  message?: string;
}

export interface ErrorDisplayProps {
  error: string | null;
  onRetry: () => void;
}

// Application state interfaces
export interface AppState {
  currentView: 'search' | 'loading' | 'results' | 'error';
  searchResult: SearchResponse | null;
  error: string | null;
  isLoading: boolean;
}

// Animation and UI state interfaces
export interface AnimationProps {
  initial?: boolean | string | number | object;
  animate?: boolean | string | number | object;
  exit?: boolean | string | number | object;
  transition?: boolean | string | number | object;
}