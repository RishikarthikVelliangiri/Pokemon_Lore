'use client';

import { motion } from 'framer-motion';
import { ErrorDisplayProps } from '@/types/components';

export default function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <motion.div
      className="error-display"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <h2 className="pokemon-font">A wild error appeared!</h2>
      <p>{error || 'An unknown error occurred.'}</p>
      <button onClick={onRetry} className="search-button pokemon-font">
        Try Again
      </button>
    </motion.div>
  );
}