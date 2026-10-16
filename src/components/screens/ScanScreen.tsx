'use client';

import { useEffect, useState } from 'react';

// Rough stages of the /api/search pipeline; timed for feel, the last one waits for the response.
const STEPS = ['Reading your description', 'Searching Pokédex lore', 'Comparing the candidates', 'Choosing the best fit'];

export default function ScanScreen({ query }: Readonly<{ query: string }>) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="screen" role="status" aria-live="polite">
      <header className="lcd-head"><h1>THINKING</h1><span className="blink">...</span></header>
      <p className="dialog-text quote">&ldquo;{query}&rdquo;</p>
      <ul className="steps">
        {STEPS.map((label, i) => (
          <li key={label} data-state={i < step ? 'done' : i === step ? 'active' : 'todo'}>
            <i className="cursor" aria-hidden />{label}
            <b>{i < step ? 'OK' : ''}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
