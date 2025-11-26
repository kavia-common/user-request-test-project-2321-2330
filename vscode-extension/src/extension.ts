import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';
import { getActiveEditorContext } from './context/activeEditorContext';
import { getWorkspaceContext } from './context/workspaceContext';
import { ChatService } from './chat/ChatService';

/**
 * PUBLIC_INTERFACE
 * activate
 * This method is called when your extension is activated. Your extension is activated the very first time the command is executed or the view is opened.
 * It registers the webview view provider and the commands exposed by this extension.
 */
export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context);

  // Allow ChatService to access SecretStorage
  ChatService.attachContext(context);

  // Register the webview view for the activity bar container
  const providerDisposable = vscode.window.registerWebviewViewProvider(
    SidebarProvider.viewId,
    sidebarProvider,
    {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }
  );

  // PUBLIC_INTERFACE
  // Command: Open/focus the TE-Copilot sidebar
  const openCommand = vscode.commands.registerCommand('teCopilot.open', async () => {
    // Force reveal the view now placed in the secondary sidebar container
    await vscode.commands.executeCommand('workbench.view.extension.teCopilot');
    await sidebarProvider.reveal();
  });

  // PUBLIC_INTERFACE
  // Command: Send Selection -> updates context and informs the chat panel
  const sendSelectionCommand = vscode.commands.registerCommand('teCopilot.sendSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    const selectedText = editor?.document.getText(editor.selection) ?? '';
    if (!selectedText.trim()) {
      vscode.window.showInformationMessage('TE-Copilot: No selection to send.');
      return;
    }

    // Ensure the chat view is visible
    await vscode.commands.executeCommand('teCopilot.open');

    // Build a fresh context snapshot that includes current selection text
    const ctx = safeContextSnapshotWithSelection();

    // Post context update first
    sidebarProvider.postMessage({
      type: 'context:update',
      context: ctx
    });

    // Notify the user inside the chat panel
    sidebarProvider.postMessage({
      type: 'chat:response',
      text: 'Selection sent to chat context. You can reference it in your next message.',
      done: true
    });
  });

  // PUBLIC_INTERFACE
  // Command: Set OpenAI API Key (stores in SecretStorage)
  const setOpenAIKeyCommand = vscode.commands.registerCommand('teCopilot.setOpenAIKey', async () => {
    const input = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'Enter your OpenAI API Key',
      prompt: 'Your key will be saved securely in VS Code Secret Storage for this machine.',
      validateInput: (val) => (val && val.trim().length > 5 ? undefined : 'Please enter a valid key'),
    });
    if (!input) {
      return;
    }
    await context.secrets.store('teCopilot.openai.apiKey', input.trim());
    // Also store legacy keys for backward compatibility with older versions
    await context.secrets.store('teCopilo.openai.apiKey', input.trim());
    await context.secrets.store('kaviaChat.openai.apiKey', input.trim());
    vscode.window.showInformationMessage('TE-Copilot: OpenAI API key saved.');
  });

  context.subscriptions.push(providerDisposable, openCommand, sendSelectionCommand, setOpenAIKeyCommand);
}

/**
 * PUBLIC_INTERFACE
 * deactivate
 * Called when the extension is deactivated.
 */
export function deactivate() {
  // No-op for now
}

/**
 * Build a fresh context snapshot; ensures selection text is included (with length guard).
 */
function safeContextSnapshotWithSelection(): Record<string, unknown> {
  try {
    const activeEditor = getActiveEditorContext();
    const workspace = getWorkspaceContext();

    return {
      ...workspace,
      activeEditor
    };
  } catch {
    return {};
  }
}
