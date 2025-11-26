import * as vscode from 'vscode';
import { ExtensionToWebviewMessage, MessageRouter, WebviewToExtensionMessage, postToWebview } from './messaging';
import { ChatService } from './chat/ChatService';
import { getActiveEditorContext } from './context/activeEditorContext';
import { getWorkspaceContext } from './context/workspaceContext';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'teCopilo.view';

  private _view?: vscode.WebviewView;
  private router = new MessageRouter();
  private chat = ChatService.getInstance();

  constructor(private readonly context: vscode.ExtensionContext) {
    // Register router handlers
    this.router
      .on('chat:loaded', (_message, webviewView) => {
        // Send initial config/context to webview on load
        const config = getConfigSnapshot();
        const ctx = getContextSnapshot();
        postToWebview(webviewView, { type: 'config:update', config });
        postToWebview(webviewView, { type: 'context:update', context: ctx });
      })
      .on('chat:send', (message, webviewView) => {
        const payload = (message as Extract<WebviewToExtensionMessage, { type: 'chat:send' }>).payload;
        const userText = (payload?.text || '').trim();
        if (!userText) {
          postToWebview(webviewView, { type: 'chat:error', error: 'Empty message' });
          return;
        }

        try {
          // Get model from settings (OpenAI specific)
          const primary = vscode.workspace.getConfiguration('teCopilo');
          const legacyTe = vscode.workspace.getConfiguration('teCopilot');
          const legacyK = vscode.workspace.getConfiguration('kaviaChat');
          const model = String(
            primary.get('teCopilo.openai.model') ??
            legacyTe.get('teCopilot.openai.model') ??
            legacyK.get('kaviaChat.openai.model') ??
            'gpt-4o-mini'
          );
          // Start provider streaming via ChatService, merging live context
          this.chat.startStreaming({
            userText,
            config: payload?.config,
            context: { ...(payload?.context ?? {}), ...getContextSnapshot() },
            model,
            webviewView: this._view,
          });
        } catch (e) {
          console.error('chat:send failed', e);
          postToWebview(webviewView, { type: 'chat:error', error: 'Failed to start chat' });
        }
      })
      .on('chat:stop', (_message, _webviewView) => {
        // Signal cancellation to provider via ChatService
        this.chat.stop(this._view);
      })
      .on('chat:openSettings', () => {
        // Open extension settings scoped to this extension
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:your-publisher.te-copilo-chat');
      });

    // Listen to editor/workspace events and emit context updates to webview
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.emitContextUpdate()),
      vscode.window.onDidChangeTextEditorSelection(() => this.emitContextUpdate()),
      vscode.window.onDidChangeVisibleTextEditors(() => this.emitContextUpdate()),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.emitContextUpdate())
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;

    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview')
      ]
    };

    // Provide full chat UI from bundled HTML and JS with CSP handled here
    const html = this.getHtmlForWebview(webview);
    webview.html = html;

    // Handle messages from the webview using our router
    webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      try {
        if (message?.type) {
          this.router.dispatch(message, webviewView);
        }
      } catch (err) {
        console.error('Error handling webview message:', err);
        postToWebview(webviewView, { type: 'chat:error', error: 'Internal error in extension' });
      }
    });
  }

  // PUBLIC_INTERFACE
  /**
   * Reveal the view in the activity bar container, if created.
   */
  async reveal(): Promise<void> {
    if (!this._view) {
      // If not yet resolved, trigger reveal by executing the built-in command to focus our container
      await vscode.commands.executeCommand('workbench.view.extension.teCopilo');
      return;
    }
    this._view?.show?.(true);
  }

  /**
   * Build HTML with proper CSP and asset URIs.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview');

    const indexCss = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'styles.css'));
    const appJs = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'app.js'));

    const csp = [
      "default-src 'none';",
      `img-src ${webview.cspSource} https: data:;`,
      `style-src ${webview.cspSource} 'unsafe-inline';`,
      `script-src 'nonce-${nonce}';`,
      `font-src ${webview.cspSource} https: data:;`,
      `connect-src https: ${webview.cspSource};`
    ].join(' ');

    // Recreate index.html with the same structure, but inject nonce
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TE-Copilo Chat</title>
  <link rel="stylesheet" href="${indexCss}">
</head>
<body>
  <div id="app" class="container">
    <header class="header">
      <div class="header-left">
        <div class="title">TE-Copilo Chat</div>
        <div class="subtitle">
          <span id="statusDot" class="status-dot idle"></span>
          <span id="statusText" aria-live="polite">Idle</span>
        </div>
      </div>
      <div class="header-right">
        <button id="openSettings" class="icon-btn" title="Settings" aria-label="Open Settings">⚙️</button>
      </div>
    </header>

    <main class="content">
      <div id="messages" class="messages" aria-live="polite" aria-label="Chat messages"></div>
      <div id="streamingIndicator" class="streaming hidden">
        <span class="dot dot1"></span><span class="dot dot2"></span><span class="dot dot3"></span>
        <span class="streaming-text">Assistant is thinking…</span>
      </div>
    </main>

    <footer class="composer">
      <div class="input-row">
        <textarea
          id="input"
          rows="1"
          placeholder="Type a message... (Press Enter to send, Shift+Enter for newline)"
          aria-label="Chat input"
        ></textarea>
        <div class="composer-actions">
          <button id="stopBtn" class="btn secondary" disabled title="Stop generation (Esc)">Stop</button>
          <button id="sendBtn" class="btn primary" title="Send (Ctrl/Cmd+Enter)">Send</button>
        </div>
      </div>
      <div class="hint">Tip: Use Ctrl/Cmd + Enter to submit</div>
    </footer>
  </div>

  <script nonce="${nonce}" src="${appJs}"></script>
</body>
</html>`;
  }

  /**
   * Post message to the webview.
   */
  // PUBLIC_INTERFACE
  postMessage(message: ExtensionToWebviewMessage) {
    this._view?.webview.postMessage(message);
  }

  /**
   * Emit a fresh context snapshot to the webview.
   */
  private emitContextUpdate() {
    const ctx = getContextSnapshot();
    postToWebview(this._view, { type: 'context:update', context: ctx });
  }
}

/**
 * Helper to generate a random nonce for CSP.
 */
function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Return a snapshot of configuration that should be sent to the webview on load.
 * Reads new primary namespace teCopilo, with fallbacks to teCopilot and kaviaChat.
 */
function getConfigSnapshot(): Record<string, unknown> {
  const primary = vscode.workspace.getConfiguration('teCopilo');
  const legacyTe = vscode.workspace.getConfiguration('teCopilot');
  const legacyKavia = vscode.workspace.getConfiguration('kaviaChat');
  return {
    provider: primary.get('teCopilo.provider', (legacyTe.get('teCopilot.provider', legacyKavia.get('kaviaChat.provider', 'mock')) as string)),
    mode: primary.get('teCopilo.mode', (legacyTe.get('teCopilot.mode', legacyKavia.get('kaviaChat.mode', 'assistant')) as string)),
    temperature: primary.get('teCopilo.temperature') ?? legacyTe.get('teCopilot.temperature') ?? legacyKavia.get('kaviaChat.temperature'),
    maxTokens: primary.get('teCopilo.maxTokens') ?? legacyTe.get('teCopilot.maxTokens') ?? legacyKavia.get('kaviaChat.maxTokens'),
    topP: primary.get('teCopilo.topP') ?? legacyTe.get('teCopilot.topP') ?? legacyKavia.get('kaviaChat.topP'),
    frequencyPenalty: primary.get('teCopilo.frequencyPenalty') ?? legacyTe.get('teCopilot.frequencyPenalty') ?? legacyKavia.get('kaviaChat.frequencyPenalty'),
    presencePenalty: primary.get('teCopilo.presencePenalty') ?? legacyTe.get('teCopilot.presencePenalty') ?? legacyKavia.get('kaviaChat.presencePenalty'),
    systemPrompt: (primary.get('teCopilo.systemPrompt') ?? legacyTe.get('teCopilot.systemPrompt') ?? legacyKavia.get('kaviaChat.systemPrompt')) as string | undefined,
    openai: {
      model: primary.get('teCopilo.openai.model', (legacyTe.get('teCopilot.openai.model', legacyKavia.get('kaviaChat.openai.model', 'gpt-4o-mini')) as string)),
      baseURL: primary.get('teCopilo.openai.baseURL', (legacyTe.get('teCopilot.openai.baseURL', legacyKavia.get('kaviaChat.openai.baseURL', 'https://api.openai.com/v1')) as string)),
    },
    ollama: {
      model: primary.get('teCopilo.ollama.model', (legacyTe.get('teCopilot.ollama.model', legacyKavia.get('kaviaChat.ollama.model', 'llama3.1')) as string)),
      baseURL: primary.get('teCopilo.ollama.baseURL', (legacyTe.get('teCopilot.ollama.baseURL', legacyKavia.get('kaviaChat.ollama.baseURL', 'http://localhost:11434')) as string)),
    },
    langchain: {
      tools: {
        enableRead: (primary.get('teCopilo.langchain.tools.enableRead') ?? legacyTe.get('teCopilot.langchain.tools.enableRead') ?? legacyKavia.get('kaviaChat.langchain.tools.enableRead')) as boolean ?? false,
        enableWrite: (primary.get('teCopilo.langchain.tools.enableWrite') ?? legacyTe.get('teCopilot.langchain.tools.enableWrite') ?? legacyKavia.get('kaviaChat.langchain.tools.enableWrite')) as boolean ?? false,
        enableDiff: (primary.get('teCopilo.langchain.tools.enableDiff') ?? legacyTe.get('teCopilot.langchain.tools.enableDiff') ?? legacyKavia.get('kaviaChat.langchain.tools.enableDiff')) as boolean ?? false,
      }
    }
  };
}

/**
 * Return a snapshot of context data (workspace + active editor) to the webview.
 */
function getContextSnapshot(): Record<string, unknown> {
  return {
    ...getWorkspaceContext(),
    activeEditor: getActiveEditorContext(),
  };
}
