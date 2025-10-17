// Error type definitions
export type ErrorState =
  | 'network_error'
  | 'api_timeout'
  | 'invalid_query'
  | 'no_results'
  | 'service_unavailable'
  | 'rate_limit_exceeded'
  | 'internal_error'
  | 'gemini_error'
  | 'pinecone_error'
  | 'pokeapi_error';

export interface AppError {
  type: ErrorState;
  message: string;
  code?: string;
  statusCode?: number;
  details?: unknown;
  timestamp: Date;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: unknown;
}

export interface ApiError extends Error {
  statusCode: number;
}

// Error messages mapping
export const ERROR_MESSAGES: Record<ErrorState, string> = {
  network_error: "Connection problem. Please check your internet and try again.",
  api_timeout: "Request timed out. Please try again.",
  invalid_query: "Please enter a valid search query.",
  no_results: "No Pokémon found matching your description. Try a different query.",
  service_unavailable: "Service temporarily unavailable. Please try again later.",
  rate_limit_exceeded: "Too many requests. Please wait a moment and try again.",
  internal_error: "Something went wrong. Please try again.",
  gemini_error: "AI service is currently unavailable. Please try again later.",
  pinecone_error: "Search service is currently unavailable. Please try again later.",
  pokeapi_error: "Pokémon data service is currently unavailable. Please try again later.",
};

// Error handling utilities
export class AppErrorClass extends Error implements ApiError {
  public type: ErrorState;
  public code?: string;
  public statusCode: number;
  public details?: unknown;
  public timestamp: Date;

  constructor(type: ErrorState, message?: string, code?: string, statusCode = 500, details?: unknown) {
    super(message || ERROR_MESSAGES[type]);
    this.type = type;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
    this.name = 'AppError';
  }
}

// Error factory functions
export const createNetworkError = (details?: unknown) =>
  new AppErrorClass('network_error', undefined, 'NETWORK_ERROR', 503, details);

export const createAPIError = (statusCode: number, message: string, details?: unknown): AppErrorClass => {
  console.error('Creating API Error:', { statusCode, message, details });
  let type: ErrorState = 'internal_error';
  if (statusCode >= 500) {
    type = 'service_unavailable';
  } else if (statusCode === 429) {
    type = 'rate_limit_exceeded';
  } else if (statusCode >= 400) {
    type = 'invalid_query';
  }

  return new AppErrorClass(type, message, 'API_ERROR', statusCode, details);
};

export const createValidationError = (message?: string) =>
  new AppErrorClass('invalid_query', message, 'VALIDATION_ERROR', 400);

export const createTimeoutError = () =>
  new AppErrorClass('api_timeout', undefined, 'TIMEOUT_ERROR', 408);

export const createRateLimitError = () =>
  new AppErrorClass('rate_limit_exceeded', undefined, 'RATE_LIMIT_ERROR', 429);