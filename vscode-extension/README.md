# KAVIA Chat (VS Code Extension)

A TypeScript-based scaffold for a VS Code Chat sidebar extension.

## Features

- Activity Bar container "KAVIA" with a "Chat" view
- Secure Webview with CSP and nonce
- Live context gathering from:
  - Active editor (file name, language, selection, cursor, visible range)
  - Workspace (folders and open editors)
- Commands:
  - `KAVIA Chat: Open Chat` (kaviaChat.open)
  - `KAVIA Chat: Send Selection` (kaviaChat.sendSelection) — adds the current selection to the chat context and notifies in the chat panel
  - `KAVIA Chat: Set OpenAI API Key` (kaviaChat.setOpenAIKey) — stores your key securely in Secret Storage

## Running the Extension

1. Open this folder in VS Code: `user-request-test-project-2321-2330/vscode-extension`
2. Run `npm install`
3. Build: `npm run compile`
4. Press `F5` (or Run > Start Debugging) to launch a new Extension Development Host window.
5. In the Activity Bar, click on the "KAVIA" icon to open the Chat view.  
   Alternatively, run the command: `KAVIA Chat: Open Chat`.

## Development

- TypeScript sources in `src/`
- Webview assets in `media/webview/`
- Build output in `out/`

## Configuration

General
- `kaviaChat.provider`: `mock` | `openai` | `ollama` | `langchain`
- `kaviaChat.mode`: `assistant` | `agent`
- `kaviaChat.temperature`: number, default 0.2
- `kaviaChat.maxTokens`: number, default 1024
- `kaviaChat.topP`: number, default 1
- `kaviaChat.frequencyPenalty`: number, default 0
- `kaviaChat.presencePenalty`: number, default 0
- `kaviaChat.systemPrompt`: system prompt to guide the assistant

OpenAI
- `kaviaChat.openai.model`: OpenAI model id (e.g., `gpt-4o-mini`)
- `kaviaChat.openai.baseURL`: Base URL for OpenAI-compatible API (default: `https://api.openai.com/v1`)
- Secret: `kaviaChat.openai.apiKey` is stored in VS Code Secret Storage when running `KAVIA Chat: Set OpenAI API Key`.
- Alternatively, you may set environment variable `OPENAI_API_KEY` for the extension host.

Ollama (local)
- `kaviaChat.ollama.model`: Ollama model name (e.g., `llama3.1`)
- `kaviaChat.ollama.baseURL`: Ollama server URL (default: `http://localhost:11434`)

LangChain Agent (lightweight)
- Select `kaviaChat.provider = langchain` and optionally `kaviaChat.mode = agent`
- Optional MCP-like tools (disabled by default):
  - `kaviaChat.langchain.tools.enableRead`: Allow read file tool
  - `kaviaChat.langchain.tools.enableWrite`: Allow write file tool (confirmation required)
  - `kaviaChat.langchain.tools.enableDiff`: Allow diff/patch tool (confirmation required)

Commands (MCP-like tools)
- `KAVIA Chat Tools: Read File` (kaviaChat.tools.readFile)
- `KAVIA Chat Tools: Write File (confirm)` (kaviaChat.tools.writeFile)
- `KAVIA Chat Tools: Produce Diff` (kaviaChat.tools.produceDiff)
- `KAVIA Chat Tools: Apply Diff (confirm)` (kaviaChat.tools.applyDiff)

## Notes

- Webview assets are referenced using `webview.asWebviewUri` and protected by a strict CSP with a script nonce.
- Commands are registered and disposed via `context.subscriptions`.
- The extension emits `context:update` messages to the webview on:
  - Active editor changes
  - Selection changes
  - Visible editors list changes
  - Workspace folder changes

## License

MIT
