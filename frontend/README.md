# Ocean Professional React Frontend

A modern single-page React app with:
- Ocean Professional theme (blue and amber accents)
- Health badge with graceful degradation
- Environment-aware config and debug panel
- Lightweight logging controlled by REACT_APP_LOG_LEVEL

## Setup

1. Install
   - npm install
2. Run
   - npm start
3. Build
   - npm run build

Open http://localhost:3000 in your browser.

## Environment Variables

Create a `.env` from `.env.example`. All variables must be prefixed with `REACT_APP_` (CRA requirement).

- REACT_APP_API_BASE: Preferred base URL for backend API (e.g., https://api.example.com)
- REACT_APP_BACKEND_URL: Fallback base URL for backend API
- REACT_APP_FRONTEND_URL: Public URL of this frontend, used for links/CTA
- REACT_APP_WS_URL: Optional WebSocket URL
- REACT_APP_NODE_ENV: Optional override; CRA also uses NODE_ENV
- REACT_APP_NEXT_TELEMETRY_DISABLED: boolean string
- REACT_APP_ENABLE_SOURCE_MAPS: boolean string
- REACT_APP_PORT: Informational only; CRA uses PORT or defaults to 3000
- REACT_APP_TRUST_PROXY: boolean string
- REACT_APP_LOG_LEVEL: one of error|warn|info|debug (default info)
- REACT_APP_HEALTHCHECK_PATH: backend health path (default /healthz)
- REACT_APP_FEATURE_FLAGS: JSON string, e.g. {"newNavbar":true}
- REACT_APP_EXPERIMENTS_ENABLED: boolean string

Notes:
- Health badge prefers REACT_APP_API_BASE then falls back to REACT_APP_BACKEND_URL.
- If neither is set, the badge shows Offline.

## Theming

The Ocean Professional palette is mapped to CSS variables:

- --primary: #2563EB
- --secondary: #F59E0B
- --error: #EF4444
- --background: #f9fafb
- --surface: #ffffff
- --text: #111827

Dark mode is preserved via data-theme="dark" with variable overrides. Use the sun/moon icon in the header to toggle. The choice persists in localStorage.

## Health Check

- Polls backend health at load and every 30s.
- States:
  - Online: 200 OK
  - Degraded: Non-200 but reachable
  - Offline: Network error or no backend configured
- Accessible with aria-live="polite" and clear color contrast.

## Debug Panel and Feature Flags

- Visible automatically when REACT_APP_LOG_LEVEL=debug.
- Or toggle in the UI (🛠️) or with the "Toggle Debug" button.
- Shows:
  - Last health status
  - Effective REACT_APP_* vars (sanitized)
  - Feature flags JSON and experiments enabled

## Ports

- CRA dev server typically uses PORT or defaults to 3000.
- REACT_APP_PORT is informational for the UI and has no effect on the dev server.

## Logging

- Controlled by REACT_APP_LOG_LEVEL (error|warn|info|debug).
- Uses console safely and won’t throw if console is unavailable.
