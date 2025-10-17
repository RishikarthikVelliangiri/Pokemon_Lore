interface NavigationButtonsProps {
  onNext: () => void;
  onPrev: () => void;
  onReturn: () => void;
}

export default function NavigationButtons({ onNext, onPrev, onReturn }: NavigationButtonsProps) {
  // TODO: Implement next/prev pokemon logic
  return (
    <div className="nav-buttons">
      {/* Prominent back button positioned by CSS */}
      <button
        onClick={onReturn}
        className="pokedex-back-button"
        aria-label="Return to search"
        title="Return to search"
      >
        ← Back
      </button>

      {/* Secondary navigation (kept visually but less prominent) */}
      <div className="secondary-nav" aria-hidden>
        <button onClick={onPrev} className="nav-arrow" title="Previous Pokémon (Not Implemented)">◀</button>
        <button onClick={onNext} className="nav-arrow" title="Next Pokémon (Not Implemented)">▶</button>
      </div>
    </div>
  );
}
