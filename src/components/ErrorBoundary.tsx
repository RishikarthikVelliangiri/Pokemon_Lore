'use client';

import React from 'react';

interface State { hasError: boolean }

/** Last-resort net: a render crash shows a plain game-over card instead of a white page. */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="stage">
        <div className="fatal" role="alert">
          <h1>GAME OVER</h1>
          <p>Something went wrong with the Pokédex.</p>
          <button className="lcd-btn" onClick={() => window.location.reload()}>RESTART</button>
        </div>
      </div>
    );
  }
}
