import * as vscode from 'vscode';
import { ChatMessage, ChatProvider } from '../ChatService';

/**
 * PUBLIC_INTERFACE
 * OllamaProvider streams chat completions from a local Ollama server.
 * Supports:
 *  - Streaming via /api/chat stream:true
 *  - Cancellation via vscode.CancellationToken
 *  - Configurable baseURL and model
 */
export class OllamaProvider implements ChatProvider {
  private readonly baseURL: string;
  private readonly model: string;
  private readonly temperature: number | undefined;
  private readonly maxTokens: number | undefined;
  private readonly topP: number | undefined;
  private readonly frequencyPenalty: number | undefined;
  private readonly presencePenalty: number | undefined;
  private readonly systemPrompt: string | undefined;

  constructor(opts: {
    baseURL?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    systemPrompt?: string;
  }) {
    this.baseURL = (opts.baseURL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.model = opts.model || 'llama3';
    this.temperature = opts.temperature;
    this.maxTokens = opts.maxTokens;
    this.topP = opts.topP;
    this.frequencyPenalty = opts.frequencyPenalty;
    this.presencePenalty = opts.presencePenalty;
    this.systemPrompt = opts.systemPrompt;
  }

  private mapMessages(messages: ChatMessage[]) {
    // Ollama expects messages in { role, content } similar to OpenAI
    const result = messages.map(m => ({ role: m.role, content: m.content }));
    if (this.systemPrompt) {
      // Prepend system prompt as system role if user didn't provide one
      const hasSystem = messages.some(m => m.role === 'system');
      if (!hasSystem) {
        result.unshift({ role: 'system', content: this.systemPrompt });
      }
    }
    return result;
  }

  // PUBLIC_INTERFACE
  stream(
    params: { messages: ChatMessage[]; config?: Record<string, unknown>; context?: Record<string, unknown>; model?: string },
    onDelta: (delta: string) => void,
    onDone: () => void,
    token: vscode.CancellationToken
  ): void {
    const model = params.model || this.model;
    const url = `${this.baseURL}/api/chat`;

    const controller = new AbortController();
    const signal = controller.signal;
    const sub = token.onCancellationRequested(() => {
      try { controller.abort(); } catch { /* ignore */ }
    });

    const body = {
      model,
      messages: this.mapMessages(params.messages),
      stream: true,
      options: {
        temperature: this.temperature ?? 0.2,
        num_predict: this.maxTokens, // Ollama uses num_predict for max tokens
        top_p: this.topP,
        frequency_penalty: this.frequencyPenalty,
        presence_penalty: this.presencePenalty
      }
    };

    (async () => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Ollama error: ${res.status} ${res.statusText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          if (token.isCancellationRequested) {
            try { reader.cancel(); } catch {}
            return;
          }
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          // Ollama streams as JSON objects separated by newlines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const json = JSON.parse(trimmed);
              const delta = json?.message?.content;
              if (typeof delta === 'string' && delta.length > 0) {
                onDelta(delta);
              }
              if (json?.done === true) {
                try { onDone(); } catch {}
                sub.dispose();
                return;
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
        try { onDone(); } catch {}
      } catch (err) {
        if (token.isCancellationRequested) return;
        // Surface error by completing; ChatService will still consider stream ended
        try { onDone(); } catch {}
      } finally {
        sub.dispose();
      }
    })().catch(() => {
      try { onDone(); } catch {}
    });
  }
}
