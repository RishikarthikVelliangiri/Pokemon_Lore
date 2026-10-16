'use client';

import { useCallback, useEffect, useState } from 'react';
import Pokedex, { Phase } from './Pokedex';
import BootScreen from './BootScreen';
import Viewer, { ViewerState } from './Viewer';
import SearchScreen from './screens/SearchScreen';
import ScanScreen from './screens/ScanScreen';
import ErrorScreen from './screens/ErrorScreen';
import ResultScreen, { TABS, Tab } from './screens/ResultScreen';
import { SearchResponse } from '@/types/api';
import { searchPokemon, formatErrorMessage } from '@/lib/api-client';
import { useCry } from '@/hooks/useCry';

type Screen = 'search' | 'scanning' | 'result' | 'error';

const BOOT_KEY = 'loredex:booted';
const BOOT_MS = 3400;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

function MiniReadout({ data }: Readonly<{ data: SearchResponse | null }>) {
  return (
    <dl>
      <div><dt>HT</dt><dd>{data ? `${(data.height / 10).toFixed(1)}m` : '--.-m'}</dd></div>
      <div><dt>WT</dt><dd>{data ? `${(data.weight / 10).toFixed(1)}kg` : '--.-kg'}</dd></div>
      <div><dt>GEN</dt><dd>{data ? ROMAN[data.generation] || data.generation : '-'}</dd></div>
    </dl>
  );
}

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>('init');
  const [screen, setScreen] = useState<Screen>('search');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('lore');

  const replayCry = useCry(result?.id);

  // Decide on mount (not in initial state) so server and client markup match.
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(BOOT_KEY) === '1'; } catch { /* storage blocked: just replay the intro */ }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPhase(seen || reduceMotion ? 'ready' : 'booting');
  }, []);

  useEffect(() => {
    if (phase !== 'booting') return;
    const finish = () => {
      try { sessionStorage.setItem(BOOT_KEY, '1'); } catch { /* ignore */ }
      setPhase('ready');
    };
    const timer = setTimeout(finish, BOOT_MS);
    window.addEventListener('keydown', finish);
    window.addEventListener('pointerdown', finish);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', finish);
      window.removeEventListener('pointerdown', finish);
    };
  }, [phase]);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    setError(null);
    setScreen('scanning');
    try {
      setResult(await searchPokemon(q));
      setTab('lore');
      setScreen('result');
    } catch (err) {
      setError(formatErrorMessage(err));
      setScreen('error');
    }
  }, []);

  const reset = useCallback(() => {
    setScreen('search');
    setResult(null);
    setError(null);
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    setTab(t => TABS[(TABS.findIndex(x => x.id === t) + dir + TABS.length) % TABS.length].id);
  }, []);

  useEffect(() => {
    if (screen !== 'result') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'Escape') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, step, reset]);

  const viewer: ViewerState =
    screen === 'result' && result ? { kind: 'result', data: result }
    : screen === 'scanning' ? { kind: 'scan' }
    : screen === 'error' ? { kind: 'error' }
    : { kind: 'idle' };

  const onResult = screen === 'result' && result;

  return (
    <Pokedex
      phase={phase}
      scanning={screen === 'scanning'}
      viewer={<Viewer state={viewer} />}
      mini={<MiniReadout data={onResult ? result : null} />}
      onA={onResult ? replayCry : undefined}
      onB={screen === 'result' || screen === 'error' ? reset : undefined}
      onLeft={onResult ? () => step(-1) : undefined}
      onRight={onResult ? () => step(1) : undefined}
    >
      {phase === 'booting' && <BootScreen />}
      {phase === 'ready' && screen === 'search' && <SearchScreen onSearch={handleSearch} />}
      {phase === 'ready' && screen === 'scanning' && <ScanScreen query={query} />}
      {phase === 'ready' && screen === 'error' && <ErrorScreen message={error} onRetry={reset} />}
      {phase === 'ready' && onResult && <ResultScreen data={result} tab={tab} onTab={setTab} onBack={reset} />}
    </Pokedex>
  );
}
