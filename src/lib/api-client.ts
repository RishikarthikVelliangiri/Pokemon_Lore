import { SearchRequest, SearchResponse, HealthCheckResponse, APIError } from '@/types/api';
import { API_ENDPOINTS, APP_CONFIG } from '@/utils/constants';
import { createNetworkError, createAPIError, createTimeoutError, ApiError } from '@/types/errors';

// API client configuration
const API_CONFIG = {
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
  timeout: APP_CONFIG.searchTimeout,
  retryAttempts: APP_CONFIG.retryAttempts,
  retryDelay: APP_CONFIG.retryDelay,
};

// Generic fetch wrapper with timeout and error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  timeout: number = API_CONFIG.timeout
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_CONFIG.baseURL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        let errorData: APIError;
      
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: 'HTTP_ERROR',
          statusCode: response.status,
        };
      }

      throw createAPIError(response.status, errorData.message, errorData);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw createTimeoutError();
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw createNetworkError(error as Error);
    }

    throw error;
  }
}

// Retry wrapper for API calls
async function withRetry<T>(
  apiCall: () => Promise<T>,
  maxAttempts: number = API_CONFIG.retryAttempts,
  delay: number = API_CONFIG.retryDelay
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on client errors (4xx) except timeout
      if (error instanceof Error && 'statusCode' in error) {
        const statusCode = (error as ApiError).statusCode;
        if (statusCode >= 400 && statusCode < 500 && statusCode !== 408) {
          throw error;
        }
      }

      if (attempt < maxAttempts) {
        console.warn(`API call failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError!;
}

// Search for Pokémon
export async function searchPokemon(query: string): Promise<SearchResponse> {
  const request: SearchRequest = { prompt: query };

  return withRetry(() =>
    apiRequest<SearchResponse>(API_ENDPOINTS.search, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  );
}

// Health check
export async function checkHealth(): Promise<HealthCheckResponse> {
  return apiRequest<HealthCheckResponse>(API_ENDPOINTS.health, {
    method: 'GET',
  }, 5000); // Shorter timeout for health checks
}

// Utility function to check if error is retryable
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Network errors are retryable
  if (error.message.includes('network') || error.message.includes('fetch')) {
    return true;
  }

  // Timeout errors are retryable
  if (error.message.includes('timeout')) {
    return true;
  }

  // Server errors (5xx) are retryable
  if ('statusCode' in error) {
    const statusCode = (error as ApiError).statusCode;
    return statusCode >= 500;
  }

  return false;
}

// Format error message for display
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const isApiError = (e: unknown): e is ApiError => {
      return typeof e === 'object' && e !== null && 'statusCode' in (e as Record<string, unknown>);
    };
    // Check if it's our custom error type
    if ('type' in error) {
      return error.message;
    }

    // Handle network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'Connection problem. Please check your internet and try again.';
    }

    // Handle timeout errors
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }

    // Special handling for API rate-limit/quota errors surfaced from server (statusCode 429 or message mentions quota)
    const statusCode = isApiError(error) ? error.statusCode : undefined;
    if ((statusCode === 429) || error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('too many requests')) {
      return 'The API has run out of requests for the day or is rate-limited. Please try again later.';
    }

    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

// Client-side API status
export interface APIStatus {
  isOnline: boolean;
  lastChecked: Date;
  services: {
    gemini: boolean;
    pinecone: boolean;
    pokeapi: boolean;
  };
}

// Get current API status
export async function getAPIStatus(): Promise<APIStatus> {
  try {
    const health = await checkHealth();
    return {
      isOnline: health.status === 'healthy',
      lastChecked: new Date(health.timestamp),
      services: health.services,
    };
  } catch {
    return {
      isOnline: false,
      lastChecked: new Date(),
      services: {
        gemini: false,
        pinecone: false,
        pokeapi: false,
      },
    };
  }
}