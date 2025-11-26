import * as vscode from 'vscode';
import { ExtensionToWebviewMessage, MessageRouter, WebviewToExtensionMessage, postToWebview } from './messaging';
import { ChatService } from './chat/ChatService';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'kaviaChat.view';

  private _view?: vscode.WebviewView;
  private router = new MessageRouter();
  private chat = ChatService.getInstance();

  constructor(private readonly context: vscode.ExtensionContext) {
    // Register router handlers
    this.router
      .on('chat:loaded', (_message, webviewView) => {
        // Send initial config/context to webview on load
        const config = getConfigSnapshot();
        const context = getContextSnapshot();
        postToWebview(webviewView, { type: 'config:update', config });
        postToWebview(webviewView, { type: 'context:update', context });
      })
      .on('chat:send', (message, webviewView) => {
        const payload = (message as Extract<WebviewToExtensionMessage, { type: 'chat:send' }>).payload;
        const userText = (payload?.text || '').trim();
        if (!userText) {
          postToWebview(webviewView, { type: 'chat:error', error: 'Empty message' });
          return;
        }

        try {
          // Get model from settings
          const model = String(vscode.workspace.getConfiguration('kaviaChat').get('kaviaChat.model') || 'gpt-4o-mini');
          // Start provider streaming via ChatService
          this.chat.startStreaming({
            userText,
            config: payload?.config,
            context: payload?.context,
            model,
            webviewView: this._view,
          });
        } catch (e) {
          console.error('chat:send failed', e);
          postToWebview(webviewView, { type: 'chat:error', error: 'Failed to start chat' });
        }
      })
      .on('chat:stop', (_message, webviewView) => {
        // Signal cancellation to provider via ChatService
        this.chat.stop(this._view);
      })
      .on('chat:openSettings', () => {
        // Open extension settings scoped to this extension
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:your-publisher.kavia-chat');
      });
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
      await vscode.commands.executeCommand('workbench.view.extension.kaviaChat');
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
  <title>KAVIA Chat</title>
  <link rel="stylesheet" href="${indexCss}">
</head>
<body>
  <div id="app" class="container">
    <header class="header">
      <div class="header-left">
        <div class="title">KAVIA Chat</div>
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
 * In future steps, read actual settings. For now, provide minimal mock config.
 */
function getConfigSnapshot(): Record<string, unknown> {
  const config = vscode.workspace.getConfiguration('kaviaChat');
  return {
    provider: config.get('kaviaChat.provider', 'mock'),
    model: config.get('kaviaChat.model', 'gpt-4o-mini'),
  };
}

/**
 * Return a snapshot of context data (e.g., workspace info) to the webview.
 */
function getContextSnapshot(): Record<string, unknown> {
  const folders = vscode.workspace.workspaceFolders?.map(f => f.name) ?? [];
  return {
    workspaceFolders: folders,
    vscodeVersion: vscode.version,
  };
}
