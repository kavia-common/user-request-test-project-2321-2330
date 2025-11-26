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

## Configuration (Placeholders)

- `kaviaChat.provider`: `mock` | `openai`
- `kaviaChat.model`: string model id
- Provider wiring beyond the mock will be implemented in later steps.

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
