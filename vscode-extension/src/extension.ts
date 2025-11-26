import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';

/**
 * PUBLIC_INTERFACE
 * activate
 * This method is called when your extension is activated. Your extension is activated the very first time the command is executed or the view is opened.
 * It registers the webview view provider and the commands exposed by this extension.
 */
export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context);

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
  // Command: Open/focus the KAVIA Chat sidebar
  const openCommand = vscode.commands.registerCommand('kaviaChat.open', async () => {
    // Force reveal the view
    await vscode.commands.executeCommand('workbench.view.extension.kaviaChat'); // switch to custom container
    await vscode.commands.executeCommand('workbench.actions.focusContext'); // no-op focus helper
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('command:'), {}); // placeholder

    // Reveal the view by its id
    await vscode.commands.executeCommand('workbench.view.extension.kaviaChat');
    await vscode.commands.executeCommand('workbench.view.extension.kaviaChat'); // double-call to ensure on older versions
    await sidebarProvider.reveal();
  });

  // PUBLIC_INTERFACE
  // Command: Send Selection (placeholder)
  const sendSelectionCommand = vscode.commands.registerCommand('kaviaChat.sendSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    const selectedText = editor?.document.getText(editor.selection) ?? '';
    // TODO: Wire this to the webview/provider in later steps
    if (!selectedText) {
      vscode.window.showInformationMessage('KAVIA Chat: No selection to send.');
      return;
    }
    vscode.window.showInformationMessage('KAVIA Chat: Selection captured (placeholder).');
    // In later steps, post message to webview:
    // sidebarProvider.postMessage({ type: 'chat:sendSelection', payload: selectedText });
  });

  context.subscriptions.push(providerDisposable, openCommand, sendSelectionCommand);
}

/**
 * PUBLIC_INTERFACE
 * deactivate
 * Called when the extension is deactivated.
 */
export function deactivate() {
  // No-op for now
}
