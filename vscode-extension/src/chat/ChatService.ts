import * as vscode from 'vscode';
import { postToWebview } from '../messaging';
import { MockProvider } from './providers/MockProvider';

/**
 * Types representing a generic chat message and provider interface.
 */
export type ChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
};

export type ChatConfig = Record<string, unknown>;
export type ChatContext = Record<string, unknown>;

/**
 * PUBLIC_INTERFACE
 * Interface for chat providers that can stream text deltas and support cancellation.
 */
export interface ChatProvider {
  /**
   * Start a chat completion stream.
   * @param params The chat input including messages and optional config/context.
   * @param onDelta Callback invoked with each delta chunk of text.
   * @param onDone Callback invoked when the stream is complete.
   * @param token Cancellation token for stopping the stream.
   */
  stream(params: {
    messages: ChatMessage[];
    config?: ChatConfig;
    context?: ChatContext;
    model?: string;
  }, onDelta: (delta: string) => void, onDone: () => void, token: vscode.CancellationToken): void;
}

/**
 * PUBLIC_INTERFACE
 * Provider-agnostic ChatService that handles routing chat:send/stop to a selected provider,
 * manages cancellation tokens, and posts streaming chunks to the webview.
 */
export class ChatService {
  private static instance: ChatService | null = null;

  private provider: ChatProvider;
  private currentCancellation?: vscode.CancellationTokenSource;
  private currentAssistantId?: string;

  private constructor() {
    // Select provider based on configuration; for now, 'mock' only
    const config = vscode.workspace.getConfiguration('kaviaChat');
    const providerId = (config.get<string>('kaviaChat.provider') || 'mock').toLowerCase();
    switch (providerId) {
      case 'mock':
      default:
        this.provider = new MockProvider();
        break;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Singleton accessor for ChatService.
   */
  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  /**
   * PUBLIC_INTERFACE
   * Begin streaming a response for the given user text. Returns the generated assistant message id.
   * This will emit 'chat:response' messages with delta chunks and a final 'done: true'.
   */
  public startStreaming(params: {
    userText: string;
    config?: ChatConfig;
    context?: ChatContext;
    model?: string;
    webviewView: vscode.WebviewView | undefined;
  }): string {
    // Stop any in-flight generation first
    this.stop();

    const { userText, config, context, model, webviewView } = params;
    const cts = new vscode.CancellationTokenSource();
    this.currentCancellation = cts;
    const assistantId = String(Date.now());
    this.currentAssistantId = assistantId;

    const messages: ChatMessage[] = [{ role: 'user', content: userText }];

    // Wire provider streaming
    this.provider.stream(
      { messages, config, context, model },
      (delta) => {
        // Post delta chunk to webview
        postToWebview(webviewView, { type: 'chat:response', id: assistantId, delta });
      },
      () => {
        // Post done to webview
        postToWebview(webviewView, { type: 'chat:response', id: assistantId, done: true });
        // Clear cancellation state
        if (this.currentCancellation === cts) {
          this.currentCancellation?.dispose();
          this.currentCancellation = undefined;
          this.currentAssistantId = undefined;
        }
      },
      cts.token
    );

    return assistantId;
  }

  /**
   * PUBLIC_INTERFACE
   * Stop any currently active stream and notify the webview of completion.
   */
  public stop(webviewView?: vscode.WebviewView): void {
    if (this.currentCancellation) {
      this.currentCancellation.cancel();
      this.currentCancellation.dispose();
      this.currentCancellation = undefined;

      // Ensure webview receives a done:true to end UI streaming state
      if (webviewView && this.currentAssistantId) {
        postToWebview(webviewView, { type: 'chat:response', id: this.currentAssistantId, done: true });
      }
      this.currentAssistantId = undefined;
    }
  }
}
