'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';

const PokedexOpening = ({ onFinished }: { onFinished: () => void }) => {

  useEffect(() => {
    const timer = setTimeout(() => {
      onFinished();
    }, 3000); // Total animation time

    return () => clearTimeout(timer);
  }, [onFinished]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <motion.div
        initial={{ y: 0, height: '50%' }}
        animate={{ y: '-100%', height: '0%' }}
        transition={{ duration: 1.5, delay: 1.5, ease: 'easeInOut' }}
        className="absolute top-0 left-0 w-full bg-pokedex-red z-10"
      />
      <motion.div
        initial={{ y: 0, height: '50%' }}
        animate={{ y: '100%', height: '0%' }}
        transition={{ duration: 1.5, delay: 1.5, ease: 'easeInOut' }}
        className="absolute bottom-0 left-0 w-full bg-pokedex-red z-10"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="text-white text-4xl font-bold"
      >
        Pokédex
      </motion.div>
    </div>
  );
};

export default PokedexOpening;