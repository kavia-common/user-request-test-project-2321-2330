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

- `kaviaChat.provider`: `mock` | `openai`
- `kaviaChat.openai.model`: OpenAI model id (e.g., `gpt-4o-mini`)
- `kaviaChat.openai.baseURL`: Base URL for OpenAI-compatible API (default: `https://api.openai.com/v1`)
- Secret: `kaviaChat.openai.apiKey` is stored in VS Code Secret Storage when running `KAVIA Chat: Set OpenAI API Key`.
- Alternatively, you may set environment variable `OPENAI_API_KEY` for the extension host.

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
