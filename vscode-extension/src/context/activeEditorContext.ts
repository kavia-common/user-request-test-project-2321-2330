import * as vscode from 'vscode';

/**
 * PUBLIC_INTERFACE
 * Shape of the active editor context data sent to the webview.
 */
export interface ActiveEditorContext {
  fileName?: string;
  languageId?: string;
  selection?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
    isEmpty: boolean;
    text?: string;
  };
  visibleRange?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  cursorPosition?: { line: number; character: number };
}

/**
 * PUBLIC_INTERFACE
 * Get a snapshot of the active editor context including filename, language, selection, visible range, and cursor position.
 */
export function getActiveEditorContext(): ActiveEditorContext {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return {};
  }

  const { document, selection } = editor;

  const selectionObj = {
    start: { line: selection.start.line, character: selection.start.character },
    end: { line: selection.end.line, character: selection.end.character },
    isEmpty: selection.isEmpty,
    text: undefined as string | undefined,
  };

  // Limit selection text length to avoid flooding the webview; include small selections for context
  try {
    const text = editor.document.getText(selection);
    if (text && text.length <= 20000) {
      selectionObj.text = text;
    }
  } catch {
    // ignore errors reading text
  }

  let visibleRange: ActiveEditorContext['visibleRange'];
  try {
    const vr = editor.visibleRanges?.[0];
    if (vr) {
      visibleRange = {
        start: { line: vr.start.line, character: vr.start.character },
        end: { line: vr.end.line, character: vr.end.character },
      };
    }
  } catch {
    // ignore
  }

  const cursorPosition = {
    line: selection.active.line,
    character: selection.active.character,
  };

  return {
    fileName: document?.fileName,
    languageId: document?.languageId,
    selection: selectionObj,
    visibleRange,
    cursorPosition,
  };
}
