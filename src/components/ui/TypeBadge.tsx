import React from 'react';
interface TypeBadgeProps {
  type: string;
}

const TypeBadge: React.FC<TypeBadgeProps> = ({ type }) => {
  return (
    <span
      className={`px-2 py-1 text-xs font-bold text-white rounded-md bg-pokemon-${type.toLowerCase()}`}>
      {type.toUpperCase()}
    </span>
  );
};

export default TypeBadge;