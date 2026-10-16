'use client';

import { useEffect, useRef, useState } from 'react';
import { validateQuery, sanitizeQuery } from '@/utils/validation';
import { APP_CONFIG } from '@/utils/constants';

export default function SearchScreen({ onSearch }: Readonly<{ onSearch: (query: string) => void }>) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  // Autofocus only where there's a hardware keyboard; on phones it would pop the keyboard over the boot.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) field.current?.focus();
  }, []);

  const submit = (raw: string) => {
    const clean = sanitizeQuery(raw);
    const check = validateQuery(clean);
    if (!check.isValid) return setError(check.message || 'Invalid query');
    setError(null);
    onSearch(clean);
  };

  return (
    <div className="screen">
      <header className="lcd-head">
        <h1>LOREDEX</h1>
        <span>MATCH</span>
      </header>

      <label className="dialog-text" htmlFor="query">Describe a Pokémon and I&apos;ll tell you which one fits best.</label>
      <div className="field">
        <i className="cursor" aria-hidden />
        <textarea
          id="query"
          ref={field}
          rows={3}
          value={query}
          maxLength={APP_CONFIG.maxQueryLength}
          placeholder="e.g. a ghost that lives in a teapot"
          aria-describedby={error ? 'query-error' : undefined}
          onChange={e => { setQuery(e.target.value); setError(null); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(query); }
          }}
        />
      </div>
      <div className="field-meta">
        <span id="query-error" className="lcd-error" role="alert">{error}</span>
        <button className="lcd-btn" onClick={() => submit(query)}>FIND MATCH</button>
      </div>

      <h2 className="menu-title">EXAMPLES</h2>
      <ul className="menu">
        {APP_CONFIG.exampleQueries.map(example => (
          <li key={example}>
            <button onClick={() => { setQuery(example); submit(example); }}>
              <i className="cursor" aria-hidden />{example}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
