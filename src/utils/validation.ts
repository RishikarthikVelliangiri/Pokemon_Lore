import { VALIDATION } from './constants';
import { SearchResponse } from '@/types/api';

// Query validation functions
export const validateQuery = (query: string): { isValid: boolean; message?: string } => {
  if (!query || typeof query !== 'string') {
    return { isValid: false, message: 'Query is required' };
  }

  const trimmedQuery = query.trim();

  if (trimmedQuery.length < VALIDATION.minQueryLength) {
    return { 
      isValid: false, 
      message: `Query must be at least ${VALIDATION.minQueryLength} characters long` 
    };
  }

  if (trimmedQuery.length > VALIDATION.maxQueryLength) {
    return { 
      isValid: false, 
      message: `Query must be less than ${VALIDATION.maxQueryLength} characters long` 
    };
  }

  if (!VALIDATION.allowedCharacters.test(trimmedQuery)) {
    return { 
      isValid: false, 
      message: 'Query contains invalid characters' 
    };
  }

  return { isValid: true };
};

// Sanitize user input
export const sanitizeQuery = (query: string): string => {
  if (!query || typeof query !== 'string') {
    return '';
  }

  return query
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .slice(0, VALIDATION.maxQueryLength); // Truncate if too long
};

// Validate API response
export const validateSearchResponse = (response: SearchResponse): boolean => {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const requiredFields: Array<keyof SearchResponse> = ['id', 'name', 'spriteUrl', 'types', 'aiInsight'];
  
  for (const field of requiredFields) {
    if (!(field in response)) {
      return false;
    }
  }

  // Validate specific field types
  if (typeof response.id !== 'number' || response.id <= 0) {
    return false;
  }

  if (typeof response.name !== 'string' || response.name.length === 0) {
    return false;
  }

  if (!Array.isArray(response.types) || response.types.length === 0) {
    return false;
  }

  if (typeof response.aiInsight !== 'string' || response.aiInsight.length === 0) {
    return false;
  }

  return true;
};

// Environment variable validation
export const validateEnvironmentVariables = (): { isValid: boolean; missing: string[] } => {
  const required = [
    'GOOGLE_GEMINI_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_ENVIRONMENT',
  ];

  const missing = required.filter(key => !process.env[key]);

  return {
    isValid: missing.length === 0,
    missing,
  };
};

// Validate Pokémon ID
export const validatePokemonId = (id: number): boolean => {
  return typeof id === 'number' && id > 0 && id <= 1025 && Number.isInteger(id);
};

// Validate URL
export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Rate limiting validation
export const createRateLimiter = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, number[]>();

  return (identifier: string): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing requests for this identifier
    const userRequests = requests.get(identifier) || [];

    // Filter out requests outside the current window
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);

    // Check if under the limit
    if (recentRequests.length >= maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    requests.set(identifier, recentRequests);

    return true;
  };
};