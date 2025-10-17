export const getStatColorClass = (statValue: number): string => {
  if (statValue < 60) {
    return 'stat-bar-low';
  }
  if (statValue > 100) {
    return 'stat-bar-high';
  }
  return 'stat-bar-medium'; // Default for stats between 60 and 100
};
