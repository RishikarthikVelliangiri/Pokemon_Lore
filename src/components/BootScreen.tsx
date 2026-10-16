const LINES = ['INITIALIZING LENS', 'LOADING LORE ENTRIES', 'LINKING POKEDEX DATA', 'READY'];

/** Power-on text for the LCD; the timing lives in CSS (see .boot in globals.css). */
export default function BootScreen() {
  return (
    <div className="boot" role="status" aria-label="Starting up">
      <p className="boot-logo">LOREDEX</p>
      <p className="boot-sub">POKEDEX LORE ENGINE</p>
      <ul className="boot-lines">
        {LINES.map((line, i) => (
          <li key={line} style={{ '--i': i } as React.CSSProperties}>{line}</li>
        ))}
      </ul>
      <div className="boot-bar" aria-hidden>
        {Array.from({ length: 20 }, (_, i) => <i key={i} style={{ '--n': i } as React.CSSProperties} />)}
      </div>
      <p className="boot-skip">PRESS ANY KEY</p>
    </div>
  );
}
