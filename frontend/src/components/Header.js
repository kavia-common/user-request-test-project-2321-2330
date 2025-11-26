import React from 'react';
import './Header.css';
import HealthBadge from './HealthBadge';

// PUBLIC_INTERFACE
export default function Header({ theme, onToggleTheme, onToggleDebug, debugActive }) {
  /** Header with title, theme toggle, health badge, and debug toggle (small) */
  return (
    <header className="header">
      <div className="header-left">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">🌊</span>
          <span className="brand-title">Ocean App</span>
        </div>
        <div className="brand-sub">Modern React template with health & env awareness</div>
      </div>

      <div className="header-right">
        <HealthBadge />
        <button
          className="icon-btn theme"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button
          className={`icon-btn debug ${debugActive ? 'active' : ''}`}
          onClick={onToggleDebug}
          aria-label="Toggle debug"
          title="Toggle debug panel"
        >
          🛠️
        </button>
      </div>
    </header>
  );
}
