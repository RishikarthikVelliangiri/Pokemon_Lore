'use client';

import { SearchResponse } from '@/types/api';
import TypeChip from '../ui/TypeChip';
import Typewriter from '../ui/Typewriter';

export const TABS = [
  { id: 'lore', label: 'LORE' },
  { id: 'stats', label: 'STATS' },
  { id: 'abilities', label: 'ABILITIES' },
] as const;
export type Tab = (typeof TABS)[number]['id'];

// The API sends display names ("Sp. Attack"); older paths sent PokéAPI slugs ("special-attack").
const STAT_LABELS: Record<string, string> = {
  hp: 'HP', attack: 'ATK', defense: 'DEF', 'sp. attack': 'SP.ATK', 'sp. defense': 'SP.DEF',
  'special-attack': 'SP.ATK', 'special-defense': 'SP.DEF', speed: 'SPD',
};
const SEGMENTS = 24;
const MAX_STAT = 255;

function Stats({ data }: Readonly<{ data: SearchResponse }>) {
  const total = data.stats.reduce((sum, s) => sum + s.value, 0);
  return (
    <>
      <ul className="stats">
        {data.stats.map(({ name, value }) => {
          const lit = Math.max(1, Math.round((value / MAX_STAT) * SEGMENTS));
          return (
            <li key={name}>
              <span className="stat-name">{STAT_LABELS[name.toLowerCase()] ?? name.toUpperCase()}</span>
              <span className="stat-value">{value}</span>
              <span className="bar" role="img" aria-label={`${value} of ${MAX_STAT}`}>
                {Array.from({ length: SEGMENTS }, (_, i) => (
                  <i key={i} className={i < lit ? 'on' : undefined} style={{ '--n': i } as React.CSSProperties} />
                ))}
              </span>
            </li>
          );
        })}
        <li className="stat-total"><span className="stat-name">TOTAL</span><span className="stat-value">{total}</span></li>
      </ul>
      {data.evolutionChain.length > 1 && (
        <>
          <h2 className="menu-title">EVOLUTION</h2>
          <ol className="evo">
            {data.evolutionChain.map(name => (
              <li key={name} aria-current={name === data.name ? 'true' : undefined}><span>{name.replace(/-/g, ' ')}</span></li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

function Abilities({ data }: Readonly<{ data: SearchResponse }>) {
  if (data.abilities.length === 0) return <p className="dialog-text dim">No ability data.</p>;
  return (
    <ul className="abilities">
      {data.abilities.map(a => (
        <li key={a.name}>
          <h3>{a.name.replace(/-/g, ' ')}{a.isHidden && <span className="tag">HIDDEN</span>}</h3>
          <p>{a.effect || 'No description available.'}</p>
        </li>
      ))}
    </ul>
  );
}

interface ResultScreenProps {
  data: SearchResponse;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onBack: () => void;
}

export default function ResultScreen({ data, tab, onTab, onBack }: Readonly<ResultScreenProps>) {
  return (
    <div className="screen">
      <header className="entry-head">
        <div>
          <p className="entry-no">BEST MATCH &nbsp; No.{String(data.id).padStart(4, '0')}</p>
          <h1 className="entry-name">{data.name.replace(/-/g, ' ')}</h1>
        </div>
        <div className="chips">{data.types.map(t => <TypeChip key={t} type={t} />)}</div>
      </header>

      <div className="tabs" role="tablist" aria-label="Sections">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="panel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel" id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'lore' && (
          <>
            <section className="box">
              <h2>WHY IT FITS</h2>
              <Typewriter key={data.id} text={data.aiInsight} />
              {data.aiDecision?.confidence && <p className="confidence">CONFIDENCE: {data.aiDecision.confidence.toUpperCase()}</p>}
            </section>
            <section className="box">
              <h2>POKÉDEX ENTRY</h2>
              <p className="dialog-text">{data.flavorText.replace(/[\n\f]+/g, ' ')}</p>
            </section>
          </>
        )}
        {tab === 'stats' && <Stats data={data} />}
        {tab === 'abilities' && <Abilities data={data} />}
      </div>

      <div className="lcd-foot">
        <span className="hint">ARROWS: SECTION &nbsp; ESC: BACK</span>
        <button className="lcd-btn" onClick={onBack}>NEW SEARCH</button>
      </div>
    </div>
  );
}
