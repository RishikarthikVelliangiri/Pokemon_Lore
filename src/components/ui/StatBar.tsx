import React from 'react';
import { motion } from 'framer-motion';

interface StatBarProps {
  statName: string;
  value: number;
  maxValue: number;
}

const StatBar: React.FC<StatBarProps> = ({ statName, value, maxValue }) => {
  const percentage = (value / maxValue) * 100;
  let barColorClass = 'bg-gray-400';

  if (percentage < 25) {
    barColorClass = 'bg-red-500';
  } else if (percentage < 50) {
    barColorClass = 'bg-yellow-500';
  } else {
    barColorClass = 'bg-green-500';
  }

  return (
    <div className="flex items-center my-1">
      <p className="w-24 text-sm font-bold">{statName}</p>
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-500">
        <motion.div
          className={`h-full ${barColorClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      <p className="w-12 text-right text-sm font-bold">{value}</p>
    </div>
  );
};

export default StatBar;