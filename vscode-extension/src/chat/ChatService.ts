import * as vscode from 'vscode';
import { postToWebview } from '../messaging';
import { MockProvider } from './providers/MockProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { LangChainAgent } from './providers/LangChainAgent';

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
    // Default to mock; will re-evaluate on each startStreaming according to settings.
    this.provider = new MockProvider();
  }

  /**
   * Attach extension context for SecretStorage access.
   */
  public static attachContext(ctx: vscode.ExtensionContext) {
    ChatService.extContext = ctx;
  }

  /**
   * Initialize provider/agent selection based on current settings and secrets.
   */
  private async initProvider(): Promise<{ error?: string }> {
    const cfg = vscode.workspace.getConfiguration('kaviaChat');
    const providerId = (cfg.get<string>('kaviaChat.provider') || 'mock').toLowerCase();
    const mode = (cfg.get<string>('kaviaChat.mode') || 'assistant').toLowerCase();

    // Agent mode currently only available for langchain selection; otherwise behave like assistant
    if (providerId === 'langchain') {
      this.provider = new LangChainAgent();
      return {};
    }

    if (providerId === 'ollama') {
      const baseURL = cfg.get<string>('kaviaChat.ollama.baseURL') || 'http://localhost:11434';
      const model = cfg.get<string>('kaviaChat.ollama.model') || 'llama3.1';
      const temperature = cfg.get<number>('kaviaChat.temperature');
      const maxTokens = cfg.get<number>('kaviaChat.maxTokens');
      const topP = cfg.get<number>('kaviaChat.topP');
      const frequencyPenalty = cfg.get<number>('kaviaChat.frequencyPenalty');
      const presencePenalty = cfg.get<number>('kaviaChat.presencePenalty');
      const systemPrompt = cfg.get<string>('kaviaChat.systemPrompt') || undefined;
      this.provider = new OllamaProvider({
        baseURL, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, systemPrompt
      });
      return {};
    }

    if (providerId === 'openai') {
      // Read key from SecretStorage first, fallback to env var
      let key: string | undefined;
      try {
        key = await ChatService.extContext?.secrets.get('kaviaChat.openai.apiKey');
      } catch { /* ignore */ }
      if (!key) {
        key = process.env.OPENAI_API_KEY;
      }
      if (!key) {
        this.provider = new MockProvider();
        return { error: 'OpenAI API key is not set. Run "KAVIA Chat: Set OpenAI API Key" or set OPENAI_API_KEY env var.' };
      }
      const baseURL = cfg.get<string>('kaviaChat.openai.baseURL') || 'https://api.openai.com/v1';
      const model = cfg.get<string>('kaviaChat.openai.model') || 'gpt-4o-mini';
      try {
        this.provider = new OpenAIProvider({ apiKey: key, baseURL, model });
        return {};
      } catch (e: any) {
        this.provider = new MockProvider();
        return { error: e?.message || 'Failed to initialize OpenAI provider' };
      }
    }

    // default mock
    this.provider = new MockProvider();
    return {};
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
        postToWebview(webviewView, { type: 'chat:error', error });
        postToWebview(webviewView, { type: 'chat:response', id: assistantId, done: true });
        if (this.currentCancellation === cts) {
          this.currentCancellation?.dispose();
          this.currentCancellation = undefined;
          this.currentAssistantId = undefined;
        }
        return;
      }

      // Decide model: prefer explicit param; otherwise provider-specific setting fallback
      const cfg = vscode.workspace.getConfiguration('kaviaChat');
      const providerId = (cfg.get<string>('kaviaChat.provider') || 'mock').toLowerCase();
      let resolvedModel = model;
      if (!resolvedModel) {
        if (providerId === 'openai') resolvedModel = cfg.get<string>('kaviaChat.openai.model') || 'gpt-4o-mini';
        if (providerId === 'ollama') resolvedModel = cfg.get<string>('kaviaChat.ollama.model') || 'llama3.1';
      }

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

      if (webviewView && this.currentAssistantId) {
        postToWebview(webviewView, { type: 'chat:response', id: this.currentAssistantId, done: true });
      }
      this.currentAssistantId = undefined;
    }
  }
}
