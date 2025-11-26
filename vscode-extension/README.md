# TE-Copilot Chat (VS Code Extension)

TE-Copilot is a VS Code sidebar chat extension that provides an AI-powered assistant and an optional agent mode. It supports multiple model providers, a secure webview chat UI, live editor/workspace context, and a set of MCP-like tools for safe file operations.

## Overview

TE-Copilot adds an Activity Bar container named “TE-Copilot” with a “Chat” view (view id: `teCopilot.view`). The chat UI streams assistant responses, supports cancellation, and can incorporate live context from your active editor and workspace. You can choose from several providers (mock, OpenAI, Ollama, lightweight LangChain agent) and configure behavior via the `teCopilot.*` settings namespace.

## Features

- TE-Copilot Activity Bar container with a Chat webview
- Secure webview with a strict CSP and script nonce
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
3. Build the extension: `npm run compile`
4. Start a new Extension Development Host: press F5 (or Run > Start Debugging)

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
- `teCopilot.systemPrompt` (string; default: “You are a helpful coding assistant.”): System prompt prefixed to conversations when supported.

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
- `teCopilot.openai.baseURL` (string; default: `https://api.openai.com/v1`): Base URL for OpenAI-compatible endpoints.

API key handling:
- Run `TE-Copilot: Set OpenAI API Key` to store your key in VS Code Secret Storage (`teCopilot.openai.apiKey`).
- Alternatively, set environment variable `OPENAI_API_KEY` in the Extension Host environment.

Example:
```json
{
  "teCopilot.provider": "openai",
  "teCopilot.openai.model": "gpt-4o-mini",
  "teCopilot.openai.baseURL": "https://api.openai.com/v1"
}
```

### Ollama (local)
- `teCopilot.ollama.model` (string; default: `llama3.1`): Local model tag.
- `teCopilot.ollama.baseURL` (string; default: `http://localhost:11434`): Your local Ollama server.

Example:
```json
{
  "teCopilot.provider": "ollama",
  "teCopilot.ollama.model": "llama3.1",
  "teCopilot.ollama.baseURL": "http://localhost:11434"
}
```

### LangChain Agent (lightweight)
Select `teCopilot.provider = "langchain"` and optionally `teCopilot.mode = "agent"` to enable tool-augmented behavior. Tools are disabled by default and must be explicitly enabled.

- `teCopilot.langchain.tools.enableRead` (boolean; default: false): Enable read file tool.
- `teCopilot.langchain.tools.enableWrite` (boolean; default: false): Enable write file tool. Each write prompts for confirmation.
- `teCopilot.langchain.tools.enableDiff` (boolean; default: false): Enable diff produce/apply. Apply prompts for confirmation.

Example:
```json
{
  "teCopilot.provider": "langchain",
  "teCopilot.mode": "agent",
  "teCopilot.langchain.tools.enableRead": true,
  "teCopilot.langchain.tools.enableWrite": true,
  "teCopilot.langchain.tools.enableDiff": true
}
```

## Providers

The extension includes multiple providers, selectable via `teCopilot.provider`.

- MockProvider: Useful for development and testing the UX and streaming behavior without any external service. It echoes back your input.
- OpenAIProvider: Streams chat completions from an OpenAI-compatible API using SSE. Requires an API key and supports a configurable base URL and model.
- OllamaProvider: Streams chat completions from a local Ollama server. Configure the base URL and model accordingly.
- LangChainAgent: A minimal, built-in agent-like provider that can optionally use MCP-like tools for read, write, diff operations. It streams agent traces and prompts for confirmations on sensitive actions.

## Agent Mode and MCP-like Tools

When using the `langchain` provider with `teCopilot.mode = "agent"`, the agent can attempt file operations based on your natural language instructions.

Supported tools:
- Read File: Reads a workspace file and returns its content into the chat stream.
- Write File: Writes or appends to a workspace file. A blocking confirmation prompt is shown before writing.
- Diff/Apply: Produces a preview diff and can apply a simple header change. Applying requires confirmation.

Safety prompts:
- All write and diff-apply operations present a modal confirmation to the user. Reads and diffs are no-ops if the path is not in the current workspace.
- Paths outside the open workspace are rejected.

Example prompt that triggers tools:
- “Read ‘src/App.js’ and suggest a change.”
- “Produce a diff for ‘README.md’ then apply it.”
- “Append a note to ‘notes/todo.txt’.”

## Commands

Core commands:
- TE-Copilot: Open Chat — `teCopilot.open`
- TE-Copilot: Send Selection — `teCopilot.sendSelection`
- TE-Copilot: Set OpenAI API Key — `teCopilot.setOpenAIKey`

MCP-like tools (can be executed directly or via agent):
- TE-Copilot Tools: Read File — `teCopilot.tools.readFile`
- TE-Copilot Tools: Write File (confirm) — `teCopilot.tools.writeFile`
- TE-Copilot Tools: Produce Diff — `teCopilot.tools.produceDiff`
- TE-Copilot Tools: Apply Diff (confirm) — `teCopilot.tools.applyDiff`

## Webview Chat UI

The chat UI shows a header with status, a scrollable message history, and a composer with input and actions.
- Sending messages: Press Enter to send; Shift+Enter inserts a newline. Ctrl/Cmd+Enter also submits.
- Copy responses: Each assistant message includes a Copy button.
- Streaming: While the assistant is responding, the status shows “Thinking…” and a stop button becomes active.
- Settings shortcut: The gear icon opens the extension settings.

## Context Features

TE-Copilot maintains a live context snapshot that includes:
- Active editor: file path, language id, selection (text and ranges), caret position, and visible range
- Workspace: open folders and visible editors

Use the `TE-Copilot: Send Selection` command to explicitly add the current selection to the context, and the chat will acknowledge it. The extension automatically emits context updates on relevant editor and workspace events, so the assistant can incorporate this information in responses.

## Troubleshooting

- OpenAI key missing: If using the OpenAI provider, set your API key with `TE-Copilot: Set OpenAI API Key` or set `OPENAI_API_KEY` in the environment. If no key is found, the extension falls back to the mock provider and shows an error in the chat.
- No response or errors: Check the Output and Debug Console for any errors from the provider fetch calls or webview messaging.
- Ollama connection issues: Ensure your local Ollama server is running and accessible at `teCopilot.ollama.baseURL` (default `http://localhost:11434`).
- Tool commands not acting on files: Tools only operate on files within the current workspace. Ensure the file path is inside an open workspace folder or open the file in the editor and run the tool to target that file.
- Legacy settings: If you previously used `teCopilo.*` or `kaviaChat.*`, TE-Copilot reads those as fallbacks. Prefer configuring the new `teCopilot.*` keys going forward.

## Packaging

- Build the extension: `npm run compile`
- Package a VSIX: `npm run package`
  - If `@vscode/vsce` is not installed globally, the script will suggest installing it with `npm i -g @vscode/vsce`.
- Install the VSIX in VS Code via the Extensions view menu (“Install from VSIX…”).

## IDs and Namespaces

- Activity Bar container id: `teCopilot`
- View id: `teCopilot.view`
- Commands: `teCopilot.open`, `teCopilot.sendSelection`, `teCopilot.setOpenAIKey`, `teCopilot.tools.readFile`, `teCopilot.tools.writeFile`, `teCopilot.tools.produceDiff`, `teCopilot.tools.applyDiff`
- Settings namespace: `teCopilot.*` (with fallbacks to `teCopilo.*` and `kaviaChat.*`)

## Development Notes

- Sources live in `src/`, webview assets in `media/webview/`, and build output in `out/`.
- The webview’s CSP and resource URIs are set at runtime. Only scripts with the injected nonce are allowed to run.
- Messages between webview and extension use strongly-typed discriminated unions, routed via a message router.

## License

MIT
