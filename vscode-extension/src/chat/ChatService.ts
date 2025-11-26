import * as vscode from 'vscode';
import { postToWebview } from '../messaging';
import { MockProvider } from './providers/MockProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';

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
  private static extContext: vscode.ExtensionContext | null = null;

  private constructor() {
    // Lazy default to mock; will re-evaluate on each startStreaming in case settings changed.
    this.provider = new MockProvider();
  }

  /**
   * Attach extension context for SecretStorage access.
   */
  public static attachContext(ctx: vscode.ExtensionContext) {
    ChatService.extContext = ctx;
  }

  /**
   * Initialize provider selection based on current settings and secrets.
   * If OpenAI is selected but no key is available, fall back to MockProvider and return an error string.
   */
  private async initProvider(): Promise<{ error?: string }> {
    const config = vscode.workspace.getConfiguration('kaviaChat');
    const providerId = (config.get<string>('kaviaChat.provider') || 'mock').toLowerCase();

    if (providerId !== 'openai') {
      this.provider = new MockProvider();
      return {};
    }

    // Read key from SecretStorage first, fallback to env var
    let key: string | undefined;
    try {
      key = await ChatService.extContext?.secrets.get('kaviaChat.openai.apiKey');
    } catch {
      // ignore
    }
    if (!key) {
      key = process.env.OPENAI_API_KEY;
    }

    if (!key) {
      this.provider = new MockProvider();
      return { error: 'OpenAI API key is not set. Run "KAVIA Chat: Set OpenAI API Key" command or set OPENAI_API_KEY env var.' };
    }

    const baseURL = config.get<string>('kaviaChat.openai.baseURL') || 'https://api.openai.com/v1';
    const model = config.get<string>('kaviaChat.openai.model') || 'gpt-4o-mini';
    try {
      this.provider = new OpenAIProvider({ apiKey: key, baseURL, model });
      return {};
    } catch (e: any) {
      this.provider = new MockProvider();
      return { error: e?.message || 'Failed to initialize OpenAI provider' };
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

    // Initialize provider based on current settings each time
    this.initProvider().then(({ error }) => {
      if (error) {
        // Immediately inform the webview about configuration problem and finish
        postToWebview(webviewView, { type: 'chat:error', error });
        postToWebview(webviewView, { type: 'chat:response', id: assistantId, done: true });
        if (this.currentCancellation === cts) {
          this.currentCancellation?.dispose();
          this.currentCancellation = undefined;
          this.currentAssistantId = undefined;
        }
        return;
      }

      // Decide model: prefer explicit model param; otherwise provider-specific setting for OpenAI
      const resolvedModel =
        model ||
        vscode.workspace.getConfiguration('kaviaChat').get<string>('kaviaChat.openai.model') ||
        'gpt-4o-mini';

      try {
        this.provider.stream(
          { messages, config, context, model: resolvedModel },
          (delta) => {
            postToWebview(webviewView, { type: 'chat:response', id: assistantId, delta });
          },
          () => {
            postToWebview(webviewView, { type: 'chat:response', id: assistantId, done: true });
            if (this.currentCancellation === cts) {
              this.currentCancellation?.dispose();
              this.currentCancellation = undefined;
              this.currentAssistantId = undefined;
            }
          },
          cts.token
        );
      } catch (e: any) {
        postToWebview(webviewView, { type: 'chat:error', error: e?.message || 'Failed to start provider' });
        postToWebview(webviewView, { type: 'chat:response', id: assistantId, done: true });
        if (this.currentCancellation === cts) {
          this.currentCancellation?.dispose();
          this.currentCancellation = undefined;
          this.currentAssistantId = undefined;
        }
      }
    }).catch((e: any) => {
      postToWebview(webviewView, { type: 'chat:error', error: e?.message || 'Failed to initialize provider' });
      postToWebview(webviewView, { type: 'chat:response', id: assistantId, done: true });
      if (this.currentCancellation === cts) {
        this.currentCancellation?.dispose();
        this.currentCancellation = undefined;
        this.currentAssistantId = undefined;
      }
    });

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
