import * as vscode from 'vscode';
import { ChatMessage, ChatProvider } from '../ChatService';

/**
 * PUBLIC_INTERFACE
 * MockProvider streams a simple echo response by splitting the reply into word/space chunks.
 * It respects CancellationToken to stop early.
 */
export class MockProvider implements ChatProvider {
  stream(
    params: { messages: ChatMessage[]; config?: Record<string, unknown>; context?: Record<string, unknown>; model?: string },
    onDelta: (delta: string) => void,
    onDone: () => void,
    token: vscode.CancellationToken
  ): void {
    const userContent = (params.messages.find(m => m.role === 'user')?.content || '').trim();
    const reply = `You said: ${userContent}\n\n(MOCK PROVIDER: ${params.model || 'gpt-4o-mini'})`;

    // Split into chunks that include spaces so UI reads naturally
    const chunks = reply.split(/(\s+)/);
    let idx = 0;

    // Stream using interval and react to cancellation
    const interval = setInterval(() => {
      if (token.isCancellationRequested) {
        clearInterval(interval);
        // Do not call onDone if cancelled; the service will handle sending done:true upon stop
        return;
      }

      if (idx < chunks.length) {
        try {
          onDelta(chunks[idx] ?? '');
        } catch {
          // ignore individual delta errors
        }
        idx++;
      } else {
        clearInterval(interval);
        try {
          onDone();
        } catch {
          // ignore completion errors
        }
      }
    }, 40);

    // Ensure interval is cleared when cancelled externally
    token.onCancellationRequested(() => {
      clearInterval(interval);
    });
  }
}
