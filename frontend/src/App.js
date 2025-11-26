import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import Header from './components/Header';
import EnvDebugPanel from './components/EnvDebugPanel';
import { logger } from './lib/log';
import { env } from './lib/env';

// PUBLIC_INTERFACE
function App() {
  /** Load and persist theme in localStorage, default to light */
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  /** Separate toggle for debug panel if log level !== debug */
  const [debugOn, setDebugOn] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const onToggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  const isDebugLevel = useMemo(() => (env.LOG_LEVEL || 'info') === 'debug', []);
  const showDebug = isDebugLevel || debugOn;

  useEffect(() => {
    logger.info('App initialized', { theme, env });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="App">
      <div className="container">
        <div className="header-shell">
          <Header theme={theme} onToggleTheme={onToggleTheme} onToggleDebug={() => setDebugOn(v => !v)} debugActive={debugOn} />
        </div>

        <main className="hero" role="main">
          <h1 className="title" aria-label="Application title">Ocean Professional React App</h1>
          <p className="subtitle">
            A modern, minimalist single-page app with environment-aware health check, logging, and debugging utilities.
          </p>

          <div className="cta-row">
            <a
              href={env.FRONTEND_URL || 'https://react.dev'}
              target="_blank"
              rel="noopener noreferrer"
              className="btn primary"
              aria-label="Open documentation or site"
            >
              Open Docs
            </a>
            <button
              className="btn secondary"
              onClick={() => setDebugOn(v => !v)}
              aria-pressed={showDebug}
              aria-label="Toggle debug panel"
            >
              Toggle Debug <span className="kbd">D</span>
            </button>
          </div>

          <p className="footer-note">
            Theme: <strong>{theme}</strong> • Log level: <strong>{env.LOG_LEVEL || 'info'}</strong>
          </p>
        </main>

        {showDebug ? (
          <section aria-label="Environment debug panel" style={{ marginTop: 16 }}>
            <EnvDebugPanel lastHealthOnly={false} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default App;
