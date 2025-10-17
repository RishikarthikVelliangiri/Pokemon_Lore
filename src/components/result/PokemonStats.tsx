import { motion } from 'framer-motion';
import { PokemonStat } from '@/types/pokemon';
import { getStatColorClass } from '@/utils/helpers';

interface PokemonStatsProps {
  stats: PokemonStat[];
}

export default function PokemonStats({ stats }: PokemonStatsProps) {
  const maxStat = 255; // The absolute max for any stat

  return (
    <div className="stats-container">
      <h3>Base Stats</h3>
      <ul>
        {stats.map(stat => (
          <li key={stat.name}>
            <span className="stat-name">{stat.name.replace('special-attack', 'sp. atk').replace('special-defense', 'sp. def')}</span>
            <span className="stat-value">{stat.value}</span>
            <div className="stat-bar">
              <motion.div
                className={`stat-bar-inner ${getStatColorClass(stat.value)}`}
                initial={{ width: 0 }}
                animate={{ width: `${(stat.value / maxStat) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
