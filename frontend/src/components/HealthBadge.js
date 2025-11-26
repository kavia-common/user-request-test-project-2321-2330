import React, { useEffect, useState } from 'react';
import './HealthBadge.css';
import { healthCheck } from '../lib/api';
import { logger } from '../lib/log';

const POLL_MS = 30000;

// PUBLIC_INTERFACE
export default function HealthBadge() {
  const [status, setStatus] = useState({ ok: false, status: 0, message: 'Unknown' });

  async function runHealth() {
    try {
      const res = await healthCheck();
      setStatus(res);
    } catch (e) {
      // healthCheck already handles errors; this is a double guard
      logger.error('HealthBadge: unexpected error', e);
      setStatus({ ok: false, status: 0, message: 'Unknown' });
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await runHealth();
    })();
    const t = setInterval(runHealth, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const variant = deriveVariant(status);
  const label = variantLabel(variant, status);

  return (
    <div className={`health-badge ${variant}`} aria-live="polite" aria-label={`Backend health: ${label}`} title={label}>
      <span className="dot" aria-hidden="true" />
      <span className="text">{label}</span>
    </div>
  );
}

function deriveVariant(health) {
  // Online when ok true and 200
  if (health?.ok && Number(health?.status) === 200) return 'online';
  // Degraded when non-200 but reachable
  if (!health?.ok && Number(health?.status) > 0) return 'degraded';
  // Offline/Unknown for network or missing backend
  return 'offline';
}

function variantLabel(variant, health) {
  if (variant === 'online') return 'Online';
  if (variant === 'degraded') return `Degraded (${health?.status || 'N/A'})`;
  return 'Offline';
}
