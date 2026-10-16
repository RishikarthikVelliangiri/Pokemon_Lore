'use client';

import { useRef, type ReactNode } from 'react';

export type Phase = 'init' | 'booting' | 'ready';

interface PokedexProps {
  phase: Phase;
  scanning: boolean;
  viewer: ReactNode;
  mini: ReactNode;
  children: ReactNode;
  onA?: () => void;
  onB?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
}

/** The handheld: lens half (viewer + controls) hinged to the LCD half. */
export default function Pokedex({
  phase, scanning, viewer, mini, children, onA, onB, onLeft, onRight,
}: Readonly<PokedexProps>) {
  const lcdScroll = useRef<HTMLDivElement>(null);
  const scroll = (dy: number) => lcdScroll.current?.scrollBy({ top: dy, behavior: 'smooth' });

  return (
    <div className="dex" data-phase={phase} data-scanning={scanning}>
      <section className="dex-half dex-left" aria-label="Scanner">
        <div className="dex-top" aria-hidden>
          <div className="lens"><i className="lens-core" /><i className="lens-glint" /></div>
          <div className="lights"><i className="light l-red" /><i className="light l-yellow" /><i className="light l-green" /></div>
        </div>

        <div className="viewer-bezel">{viewer}</div>
        <div className="mini-lcd">{mini}</div>

        <div className="controls">
          <div className="dpad" role="group" aria-label="Directional pad">
            <button className="dp dp-up" aria-label="Scroll up" onClick={() => scroll(-90)} />
            <button className="dp dp-left" aria-label="Previous section" onClick={onLeft} disabled={!onLeft} />
            <span className="dp dp-mid" aria-hidden />
            <button className="dp dp-right" aria-label="Next section" onClick={onRight} disabled={!onRight} />
            <button className="dp dp-down" aria-label="Scroll down" onClick={() => scroll(90)} />
          </div>
          <div className="speaker" aria-hidden>{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</div>
          <div className="ab">
            <button className="round-btn btn-b" onClick={onB} disabled={!onB} aria-label="B: back to search"><span>B</span></button>
            <button className="round-btn btn-a" onClick={onA} disabled={!onA} aria-label="A: replay cry"><span>A</span></button>
            <small className="ab-label b-label" aria-hidden>BACK</small>
            <small className="ab-label a-label" aria-hidden>CRY</small>
          </div>
        </div>
      </section>

      <div className="dex-hinge" aria-hidden><i /><i /><i /></div>

      <section className="dex-half dex-right" aria-label="Pokédex screen">
        <div className="lcd-bezel">
          <div className="lcd">
            <div className="lcd-scroll" ref={lcdScroll}>{children}</div>
          </div>
        </div>
        <div className="dex-foot" aria-hidden>
          <i className="power-led" />
          <div className="speaker slim">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div>
        </div>
      </section>
    </div>
  );
}
