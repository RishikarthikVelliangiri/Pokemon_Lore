'use client';

import { useEffect, useState } from 'react';

/** Dialog-box text: types itself out, click to finish. Screen readers get the full text at once. */
export default function Typewriter({ text, speed = 14 }: Readonly<{ text: string; speed?: number }>) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const t = setInterval(() => setShown(n => (n >= text.length ? (clearInterval(t), n) : n + 1)), speed);
    return () => clearInterval(t);
  }, [text, speed]);

  const done = shown >= text.length;
  return (
    <p className="dialog-text" onClick={() => setShown(text.length)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.slice(0, shown)}
        <i className={done ? 'caret done' : 'caret'} />
      </span>
    </p>
  );
}
