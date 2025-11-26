# Te-copilot Chat (VS Code Extension)

A TypeScript-based scaffold for a VS Code Chat sidebar extension.

## Features

- Activity Bar container "Te-copilot" with a "Chat" view
- Secure Webview with CSP and nonce
- Live context gathering from:
  - Active editor (file name, language, selection, cursor, visible range)
  - Workspace (folders and open editors)
- Commands:
  - `Te-copilot Chat: Open Chat` (teCopilot.open)
  - `Te-copilot Chat: Send Selection` (teCopilot.sendSelection) — adds the current selection to the chat context and notifies in the chat panel
  - `Te-copilot Chat: Set OpenAI API Key` (teCopilot.setOpenAIKey) — stores your key securely in Secret Storage

## Running the Extension

1. Open this folder in VS Code: `user-request-test-project-2321-2330/vscode-extension`
2. Run `npm install`
3. Build: `npm run compile`
4. Press `F5` (or Run > Start Debugging) to launch a new Extension Development Host window.
5. In the Activity Bar, click on the "Te-copilot" icon to open the Chat view.  
   Alternatively, run the command: `Te-copilot Chat: Open Chat`.

## Development

- TypeScript sources in `src/`
- Webview assets in `media/webview/`
- Build output in `out/`

## Configuration

General
- `teCopilot.provider`: `mock` | `openai` | `ollama` | `langchain`
- `teCopilot.mode`: `assistant` | `agent`
- `teCopilot.temperature`: number, default 0.2
- `teCopilot.maxTokens`: number, default 1024
- `teCopilot.topP`: number, default 1
- `teCopilot.frequencyPenalty`: number, default 0
- `teCopilot.presencePenalty`: number, default 0
- `teCopilot.systemPrompt`: system prompt to guide the assistant

OpenAI
- `teCopilot.openai.model`: OpenAI model id (e.g., `gpt-4o-mini`)
- `teCopilot.openai.baseURL`: Base URL for OpenAI-compatible API (default: `https://api.openai.com/v1`)
- Secret: `teCopilot.openai.apiKey` is stored in VS Code Secret Storage when running `Te-copilot Chat: Set OpenAI API Key`.
- Alternatively, you may set environment variable `OPENAI_API_KEY` for the extension host.

Ollama (local)
- `teCopilot.ollama.model`: Ollama model name (e.g., `llama3.1`)
- `teCopilot.ollama.baseURL`: Ollama server URL (default: `http://localhost:11434`)

LangChain Agent (lightweight)
- Select `teCopilot.provider = langchain` and optionally `teCopilot.mode = agent`
- Optional MCP-like tools (disabled by default):
  - `teCopilot.langchain.tools.enableRead`: Allow read file tool
  - `teCopilot.langchain.tools.enableWrite`: Allow write file tool (confirmation required)
  - `teCopilot.langchain.tools.enableDiff`: Allow diff/patch tool (confirmation required)

Commands (MCP-like tools)
- `Te-copilot Chat Tools: Read File` (teCopilot.tools.readFile)
- `Te-copilot Chat Tools: Write File (confirm)` (teCopilot.tools.writeFile)
- `Te-copilot Chat Tools: Produce Diff` (teCopilot.tools.produceDiff)
- `Te-copilot Chat Tools: Apply Diff (confirm)` (teCopilot.tools.applyDiff)

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
