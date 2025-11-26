import * as vscode from 'vscode';

/**
 * PUBLIC_INTERFACE
 * Shape of the workspace context data sent to the webview.
 */
export interface WorkspaceContext {
  workspaceFolders: { name: string; uri: string }[];
  openEditors: { fileName: string; languageId: string }[];
  vscodeVersion: string;
}

/**
 * PUBLIC_INTERFACE
 * Get a snapshot of the workspace context including workspace folders and open editors.
 */
export function getWorkspaceContext(): WorkspaceContext {
  const folders =
    vscode.workspace.workspaceFolders?.map((f) => ({
      name: f.name,
      uri: f.uri.toString(),
    })) ?? [];

  const openEditors =
    vscode.window.visibleTextEditors?.map((e) => ({
      fileName: e.document?.fileName ?? '',
      languageId: e.document?.languageId ?? '',
    })) ?? [];

  return {
    workspaceFolders: folders,
    openEditors,
    vscodeVersion: vscode.version,
  };
}
