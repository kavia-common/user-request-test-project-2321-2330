import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

let registered = false;

/**
 * PUBLIC_INTERFACE
 * Ensure MCP-like tool commands are registered exactly once.
 */
export function ensureMcpCommandsRegistered() {
  if (registered) return;
  registered = true;

  vscode.commands.registerCommand('teCopilo.tools.readFile', async (filePath?: string) => {
    return mcpReadFile(filePath);
  });

  vscode.commands.registerCommand('teCopilo.tools.writeFile', async (filePath?: string, content?: string, options?: { append?: boolean }) => {
    return mcpWriteFile(filePath, content, options);
  });

  vscode.commands.registerCommand('teCopilo.tools.produceDiff', async (filePath?: string) => {
    return mcpProduceDiff(filePath);
  });

  vscode.commands.registerCommand('teCopilo.tools.applyDiff', async (filePath?: string, diff?: string) => {
    return mcpDiffApply(filePath, diff);
  });
}

/**
 * PUBLIC_INTERFACE
 * Read file contents from current workspace safely.
 */
export async function mcpReadFile(filePath?: string): Promise<string | undefined> {
  try {
    const abs = await resolveWorkspacePath(filePath);
    if (!abs) {
      vscode.window.showWarningMessage('TE-Copilo: No file path provided or not within workspace.');
      return;
    }
    const stat = await fs.stat(abs).catch(() => null);
    if (!stat || !stat.isFile()) {
      vscode.window.showWarningMessage('TE-Copilo: Path is not a file.');
      return;
    }
    const buf = await fs.readFile(abs, 'utf-8');
    return buf;
  } catch (e: any) {
    vscode.window.showErrorMessage(`TE-Copilo: Read failed - ${e?.message || e}`);
    return;
  }
}

/**
 * PUBLIC_INTERFACE
 * Write file with a confirmation prompt. Supports append mode.
 */
export async function mcpWriteFile(filePath?: string, content?: string, options?: { append?: boolean }): Promise<boolean> {
  try {
    const abs = await resolveWorkspacePath(filePath);
    if (!abs) {
      vscode.window.showWarningMessage('Te-copilot Chat: No file path provided or not within workspace.');
      return false;
    }
    const ok = await vscode.window.showWarningMessage(
      `TE-Copilo: Confirm ${options?.append ? 'append to' : 'write'} file?\n${abs}`,
      { modal: true },
      'Yes'
    );
    if (ok !== 'Yes') return false;

    await fs.mkdir(path.dirname(abs), { recursive: true }).catch(() => {});
    if (options?.append) {
      await fs.appendFile(abs, content ?? '');
    } else {
      await fs.writeFile(abs, content ?? '', 'utf-8');
    }
    return true;
  } catch (e: any) {
    vscode.window.showErrorMessage(`TE-Copilo: Write failed - ${e?.message || e}`);
    return false;
  }
}

/**
 * PUBLIC_INTERFACE
 * Produce a synthetic diff: in real MCP this would compute changes; here we demo adding a header comment.
 */
export async function mcpProduceDiff(filePath?: string): Promise<string | undefined> {
  const abs = await resolveWorkspacePath(filePath);
  if (!abs) {
    vscode.window.showWarningMessage('TE-Copilo: No file path provided or not within workspace.');
    return;
  }
  const before = (await fs.readFile(abs, 'utf-8').catch(() => '')) ?? '';
  const header = `// Updated by TE-Copilo at ${new Date().toISOString()}\n`;
  const after = before.startsWith(header) ? before : header + before;

  // Very minimal unified-like diff header for display only
  const diff =
`--- a/${path.basename(abs)}
+++ b/${path.basename(abs)}
@@
-${before.split('\n')[0] ?? ''}
+${after.split('\n')[0] ?? ''}

`;
  return diff;
}

/**
 * PUBLIC_INTERFACE
 * Apply a simple diff with confirmation. This just prepends a header as per mcpProduceDiff.
 */
export async function mcpDiffApply(filePath?: string, diff?: string): Promise<boolean> {
  const abs = await resolveWorkspacePath(filePath);
  if (!abs) {
    vscode.window.showWarningMessage('KAVIA Chat: No file path provided or not within workspace.');
    return false;
  }
  const ok = await vscode.window.showWarningMessage(
    `TE-Copilo: Apply proposed diff to ${abs}?`,
    { modal: true },
    'Apply'
  );
  if (ok !== 'Apply') return false;

  // Our demo diff always adds a header line
  const before = (await fs.readFile(abs, 'utf-8').catch(() => '')) ?? '';
  const header = `// Updated by TE-Copilo at ${new Date().toISOString()}\n`;
  const after = before.startsWith(header) ? before : header + before;
  await fs.writeFile(abs, after, 'utf-8');
  return true;
}

async function resolveWorkspacePath(filePath?: string): Promise<string | undefined> {
  if (!filePath || filePath.trim() === '') {
    const editor = vscode.window.activeTextEditor;
    return editor?.document?.uri?.fsPath;
  }
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  // If path is already absolute and inside workspace, return as-is
  if (path.isAbsolute(filePath)) {
    const allowed = folders.some(f => filePath.startsWith(f.uri.fsPath));
    return allowed ? filePath : undefined;
  }
  // Resolve relative to first workspace folder
  const abs = path.join(folders[0].uri.fsPath, filePath);
  const allowed = abs.startsWith(folders[0].uri.fsPath);
  return allowed ? abs : undefined;
}
