import React, { useEffect, useState } from 'react';
import './EnvDebugPanel.css';
import { env, safeEnvSnapshot } from '../lib/env';
import { healthCheck } from '../lib/api';
import { logger } from '../lib/log';

/**
 * PUBLIC_INTERFACE
 * EnvDebugPanel
 * Renders effective client-side environment configuration (CRA REACT_APP_*),
 * feature flags, and last health status for debugging.
 */
export default function EnvDebugPanel({ lastHealthOnly = false }) {
  const [health, setHealth] = useState(null);
  const [config, setConfig] = useState(safeEnvSnapshot());

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const h = await healthCheck();
        if (mounted) setHealth(h);
      } catch (e) {
        logger.warn('EnvDebugPanel: health check failed', e);
        if (mounted) setHealth({ ok: false, status: 0, message: String(e?.message || 'error') });
      }
    })();
    return () => { mounted = false; };
  }, []);

  const ff = env.FEATURE_FLAGS || {};
  const experiments = env.EXPERIMENTS_ENABLED === true;

  return (
    <div className="env-panel" role="region" aria-label="Environment debug panel">
      <div className="env-header">
        <div className="env-title">Debug Panel</div>
        <div className="env-subtitle">Client env and health</div>
      </div>

      <div className="env-grid">
        <div className="env-card">
          <div className="env-card-title">Health</div>
          <div className="env-kv">
            <div><span className="k">ok</span><span className="v">{String(health?.ok ?? false)}</span></div>
            <div><span className="k">status</span><span className="v">{health?.status ?? 'N/A'}</span></div>
            <div><span className="k">message</span><span className="v">{health?.message ?? 'N/A'}</span></div>
          </div>
        </div>

        {!lastHealthOnly && (
          <>
            <div className="env-card">
              <div className="env-card-title">URLs</div>
              <div className="env-kv">
                <div><span className="k">API_BASE</span><span className="v">{config.REACT_APP_API_BASE || '-'}</span></div>
                <div><span className="k">BACKEND_URL</span><span className="v">{config.REACT_APP_BACKEND_URL || '-'}</span></div>
                <div><span className="k">FRONTEND_URL</span><span className="v">{config.REACT_APP_FRONTEND_URL || '-'}</span></div>
                <div><span className="k">WS_URL</span><span className="v">{config.REACT_APP_WS_URL || '-'}</span></div>
                <div><span className="k">HEALTH_PATH</span><span className="v">{config.REACT_APP_HEALTHCHECK_PATH || '/healthz'}</span></div>
              </div>
            </div>

            <div className="env-card">
              <div className="env-card-title">Runtime</div>
              <div className="env-kv">
                <div><span className="k">NODE_ENV</span><span className="v">{config.REACT_APP_NODE_ENV || process.env.NODE_ENV || '-'}</span></div>
                <div><span className="k">LOG_LEVEL</span><span className="v">{config.REACT_APP_LOG_LEVEL || 'info'}</span></div>
                <div><span className="k">PORT (info)</span><span className="v">{config.REACT_APP_PORT || '-'}</span></div>
                <div><span className="k">TRUST_PROXY</span><span className="v">{String(config.REACT_APP_TRUST_PROXY || false)}</span></div>
                <div><span className="k">SRC_MAPS</span><span className="v">{String(config.REACT_APP_ENABLE_SOURCE_MAPS || false)}</span></div>
                <div><span className="k">NEXT_TELEMETRY_DISABLED</span><span className="v">{String(config.REACT_APP_NEXT_TELEMETRY_DISABLED || false)}</span></div>
              </div>
            </div>

            <div className="env-card">
              <div className="env-card-title">Feature Flags</div>
              <div className="env-kv">
                <div><span className="k">EXPERIMENTS_ENABLED</span><span className="v">{String(experiments)}</span></div>
              </div>
              <pre className="flags-pre" aria-label="Feature flags JSON">{JSON.stringify(ff, null, 2)}</pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
