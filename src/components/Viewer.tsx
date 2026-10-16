'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { SearchResponse } from '@/types/api';

export type ViewerState =
  | { kind: 'idle' }
  | { kind: 'scan' }
  | { kind: 'error' }
  | { kind: 'result'; data: SearchResponse };

const PokeBall = () => (
  <svg className="ball" viewBox="0 0 64 64" aria-hidden>
    <path d="M4 32a28 28 0 0 1 56 0z" fill="#e0373b" />
    <path d="M4 32a28 28 0 0 0 56 0z" fill="#f7f7f9" />
    <circle cx="32" cy="32" r="28" fill="none" stroke="#1a1a1f" strokeWidth="4" />
    <path d="M4 32h56" stroke="#1a1a1f" strokeWidth="4" />
    <circle cx="32" cy="32" r="9" fill="#f7f7f9" stroke="#1a1a1f" strokeWidth="4" />
    <path d="M14 22a22 22 0 0 1 12-9" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// Cycles random Gen 1 silhouettes while a search is running.
function Silhouettes() {
  const [id, setId] = useState(25);
  useEffect(() => {
    const t = setInterval(() => setId(1 + Math.floor(Math.random() * 151)), 600);
    return () => clearInterval(t);
  }, []);
  return (
    // No key: a stable <img> keeps showing the previous silhouette until the next one has loaded.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="silhouette"
      src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`}
      alt=""
    />
  );
}

// Showdown names drop hyphens (mr-mime -> mrmime) except for alternate forms, so try both, then official art.
function Sprite({ data }: Readonly<{ data: SearchResponse }>) {
  const slug = data.name.toLowerCase();
  const candidates = [
    `https://play.pokemonshowdown.com/sprites/xyani/${slug.replace(/-/g, '')}.gif`,
    `https://play.pokemonshowdown.com/sprites/xyani/${slug}.gif`,
    data.spriteUrl,
  ];
  const [level, setLevel] = useState(0);
  return (
    <Image
      className="sprite"
      src={candidates[level]}
      alt={data.name}
      width={220}
      height={220}
      unoptimized
      priority
      onError={() => setLevel(l => Math.min(l + 1, candidates.length - 1))}
    />
  );
}

export default function Viewer({ state }: Readonly<{ state: ViewerState }>) {
  return (
    <div className="viewer" data-kind={state.kind}>
      <div className="viewer-stage">
        {state.kind === 'idle' && <PokeBall />}
        {state.kind === 'scan' && <Silhouettes />}
        {state.kind === 'error' && <div className="static" aria-hidden />}
        {state.kind === 'result' && <Sprite key={state.data.id} data={state.data} />}
        {state.kind === 'scan' && <div className="sweep" aria-hidden />}
      </div>
    </div>
  );
}
