# TE-Copilo Chat (VS Code Extension)

A TypeScript-based scaffold for a VS Code Chat sidebar extension.

## Features

- Activity Bar container "TE-Copilo" with a "Chat" view
- Secure Webview with CSP and nonce
- Live context gathering from:
  - Active editor (file name, language, selection, cursor, visible range)
  - Workspace (folders and open editors)
- Commands:
  - `TE-Copilo: Open Chat` (teCopilo.open)
  - `TE-Copilo: Send Selection` (teCopilo.sendSelection) — adds the current selection to the chat context and notifies in the chat panel
  - `TE-Copilo: Set OpenAI API Key` (teCopilo.setOpenAIKey) — stores your key securely in Secret Storage

## Running the Extension

1. Open this folder in VS Code: `user-request-test-project-2321-2330/vscode-extension`
2. Run `npm install`
3. Build: `npm run compile`
4. Press `F5` (or Run > Start Debugging) to launch a new Extension Development Host window.
5. In the Activity Bar, click on the "TE-Copilo" icon to open the Chat view.  
   Alternatively, run the command: `TE-Copilo: Open Chat`.

## Development

- TypeScript sources in `src/`
- Webview assets in `media/webview/`
- Build output in `out/`

## Configuration

General
- `teCopilo.provider`: `mock` | `openai` | `ollama` | `langchain`
- `teCopilo.mode`: `assistant` | `agent`
- `teCopilo.temperature`: number, default 0.2
- `teCopilo.maxTokens`: number, default 1024
- `teCopilo.topP`: number, default 1
- `teCopilo.frequencyPenalty`: number, default 0
- `teCopilo.presencePenalty`: number, default 0
- `teCopilo.systemPrompt`: system prompt to guide the assistant

OpenAI
- `teCopilo.openai.model`: OpenAI model id (e.g., `gpt-4o-mini`)
- `teCopilo.openai.baseURL`: Base URL for OpenAI-compatible API (default: `https://api.openai.com/v1`)
- Secret: `teCopilo.openai.apiKey` is stored in VS Code Secret Storage when running `TE-Copilo: Set OpenAI API Key`.
- Alternatively, you may set environment variable `OPENAI_API_KEY` for the extension host.

Ollama (local)
- `teCopilo.ollama.model`: Ollama model name (e.g., `llama3.1`)
- `teCopilo.ollama.baseURL`: Ollama server URL (default: `http://localhost:11434`)

LangChain Agent (lightweight)
- Select `teCopilo.provider = langchain` and optionally `teCopilo.mode = agent`
- Optional MCP-like tools (disabled by default):
  - `teCopilo.langchain.tools.enableRead`: Allow read file tool
  - `teCopilo.langchain.tools.enableWrite`: Allow write file tool (confirmation required)
  - `teCopilo.langchain.tools.enableDiff`: Allow diff/patch tool (confirmation required)

Commands (MCP-like tools)
- `TE-Copilo Tools: Read File` (teCopilo.tools.readFile)
- `TE-Copilo Tools: Write File (confirm)` (teCopilo.tools.writeFile)
- `TE-Copilo Tools: Produce Diff` (teCopilo.tools.produceDiff)
- `TE-Copilo Tools: Apply Diff (confirm)` (teCopilo.tools.applyDiff)

## Notes

- Webview assets are referenced using `webview.asWebviewUri` and protected by a strict CSP with a script nonce.
- Commands are registered and disposed via `context.subscriptions`.
- The extension emits `context:update` messages to the webview on:
  - Active editor changes
  - Selection changes
  - Visible editors list changes
  - Workspace folder changes

## Backward Compatibility

- Previous settings namespaces `teCopilot.*` and `kaviaChat.*` continue to be read as fallbacks.

## License

MIT
