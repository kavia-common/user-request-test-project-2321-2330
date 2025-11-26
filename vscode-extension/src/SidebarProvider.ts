import * as vscode from 'vscode';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'kaviaChat.view';

  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

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

    const html = this.getHtmlForWebview(webview);
    webview.html = html;

    // Handle messages from the webview
    webview.onDidReceiveMessage((message) => {
      // Placeholder: log message
      if (message?.type) {
        console.log('KAVIA Chat webview message:', message);
      }
      // TODO: route messages in later steps
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

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KAVIA Chat</title>
  <link rel="stylesheet" href="${indexCss}">
</head>
<body>
  <div id="app" class="container">
    <header class="header">
      <div class="title">KAVIA Chat</div>
      <div class="subtitle">Welcome</div>
    </header>
    <main class="content">
      <p class="muted">This is a placeholder. Chat features will be implemented in later steps.</p>
      <button id="openDocs" class="btn">Open Settings</button>
    </main>
  </div>

  <script nonce="${nonce}" src="${appJs}"></script>
</body>
</html>`;
  }

  /**
   * Post message to the webview (to be used in later steps).
   */
  // PUBLIC_INTERFACE
  postMessage(message: unknown) {
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
