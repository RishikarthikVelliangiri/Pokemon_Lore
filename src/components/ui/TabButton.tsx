'use client';

import { motion } from 'framer-motion';

interface TabButtonProps {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export default function TabButton({ isActive, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-lg font-mono rounded-t-lg transition-colors duration-300 ${isActive ? 'bg-pokedex-screen-dark text-pokedex-white' : 'bg-pokedex-gray-light text-pokedex-black'}`}
    >
      {children}
      {isActive && (
        <motion.div className="h-1 bg-pokedex-blue mt-1" layoutId="underline" />
      )}
    </button>
  );
}
