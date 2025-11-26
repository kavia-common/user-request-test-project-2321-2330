 /**
 * Centralized message types and a simple router for webview <-> extension communication.
 * Includes utility helpers to post messages safely.
 */

import * as vscode from 'vscode';

/**
 * PUBLIC_INTERFACE
 * Discriminated union for messages coming from the webview to the extension.
 */
export type WebviewToExtensionMessage =
  | { type: 'chat:loaded' }
  | { type: 'chat:send'; payload: { text: string; config?: Record<string, unknown>; context?: Record<string, unknown>; clientTs?: number } }
  | { type: 'chat:stop' }
  | { type: 'chat:openSettings' };

/**
 * PUBLIC_INTERFACE
 * Discriminated union for messages sent from the extension to the webview.
 */
export type ExtensionToWebviewMessage =
  | { type: 'chat:response'; id?: string; delta?: string; text?: string; done?: boolean }
  | { type: 'chat:error'; error?: string }
  | { type: 'config:update'; config: Record<string, unknown> }
  | { type: 'context:update'; context: Record<string, unknown> }
  | { type: 'chat:sendSelection'; payload: { text: string } };

/**
 * PUBLIC_INTERFACE
 * Handler function signature for routing incoming messages from the webview.
 */
export type WebviewMessageHandler = (message: WebviewToExtensionMessage, webviewView: vscode.WebviewView) => void;

/**
 * PUBLIC_INTERFACE
 * Simple message router class that allows registering handlers for different message types.
 */
export class MessageRouter {
  private handlers: Partial<Record<WebviewToExtensionMessage['type'], WebviewMessageHandler>> = {};

  /**
   * PUBLIC_INTERFACE
   * Register a handler for a specific message type.
   */
  on<T extends WebviewToExtensionMessage['type']>(type: T, handler: WebviewMessageHandler): this {
    this.handlers[type] = handler;
    return this;
  }

  /**
   * PUBLIC_INTERFACE
   * Dispatch an incoming message to its corresponding handler if registered.
   */
  dispatch(message: WebviewToExtensionMessage, webviewView: vscode.WebviewView): void {
    const handler = this.handlers[message.type];
    if (handler) {
      handler(message, webviewView);
    } else {
      console.warn(`No handler for message type: ${message.type}`);
    }
  }
}

/**
 * PUBLIC_INTERFACE
 * Post a message to a webview view safely.
 */
export function postToWebview(view: vscode.WebviewView | undefined, message: ExtensionToWebviewMessage): void {
  view?.webview.postMessage(message);
}
