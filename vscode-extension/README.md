# TE-Copilot Chat (VS Code Extension)

TE-Copilot is a VS Code sidebar chat extension with a pure, vanilla Webview UI (no React). It supports multiple model providers, a secure webview chat UI, live editor/workspace context, and a set of MCP-like tools for safe file operations.

## Overview

TE-Copilot adds an Activity Bar container named “TE-Copilot” with a “Chat” view (view id: `teCopilot.view`). The chat UI is implemented as a simple HTML/CSS/JS webview (index.html + styles.css + app.js, no bundler) and streams assistant responses, supports cancellation, and can incorporate live context from your active editor and workspace. You can choose from several providers (mock, OpenAI, Ollama, lightweight LangChain agent) and configure behavior via the `teCopilot.*` settings namespace.

## Features

- TE-Copilot Activity Bar container with a Chat webview
- Vanilla Webview UI (no React) using:
  - media/webview/index.html
  - media/webview/styles.css
  - media/webview/app.js
- Strict CSP with a script nonce injected by the extension (no inline scripts without nonce)
- Streaming responses with cancel support and graceful completion
- Live context gathering and automatic updates from:
  - Active editor (file name, language id, selection, cursor, visible range)
  - Workspace (folders and open editors)
- “Send Selection” command to push current selection into the chat context
- Multiple providers:
  - Mock (for development)
  - OpenAI-compatible API
  - Local Ollama
  - Lightweight agent via “LangChain” provider with MCP-like tools
- MCP-like tools with confirmation prompts for write/apply-diff
- Backward compatibility with legacy settings namespaces: `teCopilo.*` and `kaviaChat.*`

## Installation

### For users
1. Open VS Code and go to the Extensions view.
2. Install from a VSIX (see Packaging section) or from the Marketplace when published.
3. Open the TE-Copilot view from the Activity Bar or run the `TE-Copilot: Open Chat` command.

### For developers
1. Open this folder in VS Code: `user-request-test-project-2321-2330/vscode-extension`
2. Run `npm install`
3. Build the extension TypeScript only: `npm run compile`
4. Start a new Extension Development Host: press F5 (or Run > Start Debugging)

Notes:
- There are no React/webpack/vite build steps for the webview. The webview assets are shipped as static files.
- Debug/launch only compiles the extension TS under `src/` and serves the static webview files from `media/webview/`.

## Running and Debugging

After pressing F5, a new Extension Development Host window will open. In that window:
- Click the “TE-Copilot” Activity Bar icon and open the “Chat” view, or run `TE-Copilot: Open Chat`.
- Use the input at the bottom to send a message. Press Enter to send (Shift+Enter for a newline). Ctrl/Cmd+Enter also submits.
- Use the “Stop” button or press Escape to cancel streaming responses.

## Configuration

All settings live under the `teCopilot.*` namespace with sensible defaults. TE-Copilot also reads legacy namespaces (`teCopilo.*` and `kaviaChat.*`) as fallbacks to smooth upgrades.

### General
- `teCopilot.provider` (string; default: `mock`): One of `mock`, `openai`, `ollama`, `langchain`. Selects which provider/agent to use.
- `teCopilot.mode` (string; default: `assistant`): One of `assistant`, `agent`. Agent mode enables tool usage where available (primarily with the `langchain` provider).
- `teCopilot.temperature` (number; default: 0.2): Sampling temperature for providers that support it.
- `teCopilot.maxTokens` (number; default: 1024): Maximum tokens or similar generation limit (provider-specific semantics).
- `teCopilot.topP` (number; default: 1): Nucleus sampling parameter if supported.
- `teCopilot.frequencyPenalty` (number; default: 0): Frequency penalty if supported.
- `teCopilot.presencePenalty` (number; default: 0): Presence penalty if supported.
- `teCopilot.systemPrompt` (string; default: “You are a concise, helpful coding assistant. Prefer brevity, show minimal necessary code, and ask for missing details when required.”): System prompt prefixed to conversations when supported.

Example user settings JSON:
```json
{
  "teCopilot.provider": "openai",
  "teCopilot.mode": "assistant",
  "teCopilot.temperature": 0.2,
  "teCopilot.maxTokens": 1024,
  "teCopilot.systemPrompt": "You are a concise code assistant."
}
```

### OpenAI-compatible
- `teCopilot.openai.model` (string; default: `gpt-4o-mini`): Model name.
- `teCopilot.openai.baseURL` (string; default: ``): Base URL override for OpenAI-compatible endpoints. Leave empty to use the default `https://api.openai.com/v1`. Useful for proxies or Azure/OpenAI-compatible services.

API key handling:
- Run `TE-Copilot: Set OpenAI API Key` to store your key in VS Code Secret Storage (`teCopilot.openai.apiKey`).
- Alternatively, set environment variable `OPENAI_API_KEY` in the Extension Host environment.

### Ollama (local)
- `teCopilot.ollama.model` (string; default: `llama3`): Local model tag.
- `teCopilot.ollama.baseURL` (string; default: `http://127.0.0.1:11434`): Your local Ollama server.

### LangChain Agent (lightweight)
Select `teCopilot.provider = "langchain"` and optionally `teCopilot.mode = "agent"` to enable tool-augmented behavior. Tools are disabled by default and must be explicitly enabled.

- `teCopilot.langchain.tools.enableRead` (boolean; default: false): Enable read file tool.
- `teCopilot.langchain.tools.enableWrite` (boolean; default: false): Enable write file tool. Each write prompts for confirmation.
- `teCopilot.langchain.tools.enableDiff` (boolean; default: false): Enable diff produce/apply. Apply prompts for confirmation.

## Providers

The extension includes multiple providers, selectable via `teCopilot.provider`:
- MockProvider (no external services)
- OpenAIProvider (SSE streaming via OpenAI-compatible API)
- OllamaProvider (local Ollama)
- LangChainAgent (lightweight agent with optional tools)

## Webview Chat UI (Vanilla)

- Files: `media/webview/index.html`, `media/webview/styles.css`, `media/webview/app.js`
- CSP: The extension injects a strict CSP and a script nonce. No inline scripts without a nonce.
- UX: Header with status, scrollable message list, input with Send/Stop. Streaming state, copy buttons per assistant message, status updates, and a settings shortcut.

## Context Features

- Active editor context: file name, language id, selection text, cursor, visible range
- Workspace context: open folders and visible editors
- Automatic updates are pushed to the webview.

## Troubleshooting

- OpenAI key missing: Set with `TE-Copilot: Set OpenAI API Key` or set `OPENAI_API_KEY`.
- Ollama: Ensure your server is running and reachable via `teCopilot.ollama.baseURL`.
- Tools operate only within the current workspace.
- Legacy settings: `teCopilo.*` and `kaviaChat.*` are read as fallbacks.

## Packaging

- Build the extension TypeScript: `npm run compile`
- Package a VSIX: `npm run package`
  - If `@vscode/vsce` is not installed globally, install with `npm i -g @vscode/vsce`.

## IDs and Namespaces

- Activity Bar container id: `teCopilot`
- View id: `teCopilot.view`
- Commands: `teCopilot.open`, `teCopilot.sendSelection`, `teCopilot.setOpenAIKey`, `teCopilot.tools.readFile`, `teCopilot.tools.writeFile`, `teCopilot.tools.produceDiff`, `teCopilot.tools.applyDiff`
- Settings namespace: `teCopilot.*` (with fallbacks to `teCopilo.*` and `kaviaChat.*`)

## Development Notes

- Sources live in `src/`, webview assets in `media/webview/`, and build output in `out/`.
- The webview’s CSP and resource URIs are set at runtime by `SidebarProvider`. Only the script referenced with an injected nonce executes.
- There are no React dependencies or builds required for the webview.

## License

MIT
