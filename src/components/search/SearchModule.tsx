'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { SearchModuleProps } from '@/types/components';
import { validateQuery, sanitizeQuery } from '@/utils/validation';
import { APP_CONFIG } from '@/utils/constants';

export default function SearchModule({ onSearch, isLoading }: SearchModuleProps) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = () => {
    const sanitizedQuery = sanitizeQuery(query);
    const validation = validateQuery(sanitizedQuery);

    if (!validation.isValid) {
      setError(validation.message || 'Invalid query');
      return;
    }
    setError(null);
    onSearch(sanitizedQuery);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit();
    }
  };

  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
    onSearch(exampleQuery);
  };

  return (
    <motion.div
      key="search"
      className="search-ui-container"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <h1 className="screen-title">Pokédex Search</h1>

      <div className="search-input-wrapper">
        <span className="search-cursor">►</span>
        <input 
          type="text" 
          placeholder="Describe a Pokémon..." 
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          maxLength={APP_CONFIG.maxQueryLength}
        />
      </div>
      
      {error && (
        <motion.p 
          className="text-red-500 text-sm mt-2 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}

      <div className="example-list-container">
        <p className="example-title">Examples:</p>
        <ul>
          {APP_CONFIG.exampleQueries.map((example) => (
            <li 
              key={example} 
              className="example-item"
              onClick={() => handleExampleClick(example)}
            >
              {example}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
