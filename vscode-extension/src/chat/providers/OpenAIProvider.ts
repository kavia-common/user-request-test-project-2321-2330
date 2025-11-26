import * as vscode from 'vscode';
import { ChatMessage, ChatProvider } from '../ChatService';

/**
 * PUBLIC_INTERFACE
 * OpenAIProvider streams chat completions using the OpenAI-compatible REST API.
 * It supports:
 *  - Streaming via SSE (server-sent events) using fetch+ReadableStream
 *  - Cancellation via vscode.CancellationToken
 *  - Base URL override (for Azure/OpenAI-compatible backends)
 *  - Model selection via settings
 */
export class OpenAIProvider implements ChatProvider {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly model: string;

  constructor(opts: { apiKey: string; baseURL?: string; model?: string }) {
    if (!opts.apiKey) {
      throw new Error('Missing OpenAI API key');
    }
    this.apiKey = opts.apiKey;
    // Allow empty string to mean "use provider default"
    const base = (opts.baseURL ?? '').trim();
    this.baseURL = (base === '' ? 'https://api.openai.com/v1' : base).replace(/\/+$/, '');
    this.model = opts.model || 'gpt-4o-mini';
  }

  /**
   * Convert provider-agnostic messages to OpenAI chat format.
   */
  private mapMessages(messages: ChatMessage[]) {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Stream chat completions from OpenAI-compatible API.
   */
  // PUBLIC_INTERFACE
  stream(
    params: { messages: ChatMessage[]; config?: Record<string, unknown>; context?: Record<string, unknown>; model?: string },
    onDelta: (delta: string) => void,
    onDone: () => void,
    token: vscode.CancellationToken
  ): void {
    const model = params.model || this.model;
    const url = `${this.baseURL}/chat/completions`;

    const controller = new AbortController();
    const signal = controller.signal;

    // Cancel fetch when token is cancelled
    const sub = token.onCancellationRequested(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    });

    const body = {
      model,
      messages: this.mapMessages(params.messages),
      stream: true,
      // Basic sensible defaults; user can extend in future
      temperature: 0.2,
    };

    // Fire and forget fetch, parse streaming
    (async () => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `OpenAI API error: ${res.status} ${res.statusText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          if (token.isCancellationRequested) {
            try {
              reader.cancel();
            } catch {
              // ignore
            }
            return;
          }

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          // Parse SSE lines
          const lines = buffer.split('\n');
          // Keep last partial line in buffer
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) {
              continue;
            }
            const data = trimmed.replace(/^data:\s*/, '');
            if (data === '[DONE]') {
              try {
                onDone();
              } catch {
                // ignore
              }
              sub.dispose();
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length > 0) {
                onDelta(delta);
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }

        // End of stream
        try {
          onDone();
        } catch {
          // ignore
        }
      } catch (err) {
        if (token.isCancellationRequested) {
          // Cancelled: do not call onDone; ChatService handles done:true on stop.
          return;
        }
        throw err;
      } finally {
        sub.dispose();
      }
    })().catch((_e) => {
      // Errors are handled by ChatService via try/catch during start
      try {
        // Best effort finalize
        onDone();
      } catch {
        //
      }
    });
  }
}
