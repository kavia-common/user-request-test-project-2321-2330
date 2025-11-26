import * as vscode from 'vscode';
import { ChatMessage, ChatProvider } from '../ChatService';
import { ensureMcpCommandsRegistered, mcpReadFile, mcpWriteFile, mcpDiffApply, mcpProduceDiff } from '../../commands/mcpTools';

/**
 * PUBLIC_INTERFACE
 * LangChainAgent
 * A minimal agent-like orchestrator that streams reasoning based on messages and can optionally use MCP-like tools
 * (read, write, diff). This is a lightweight placeholder to allow selection of "langchain" provider and
 * "agent" mode without pulling full LangChain dependency.
 *
 * It demonstrates:
 *  - Using internal tool commands conditionally based on settings
 *  - Guarding write/diff-apply with confirmation prompts
 *  - Streaming interim traces to UI for a responsive feel
 */
export class LangChainAgent implements ChatProvider {
  private readonly temperature: number | undefined;
  private readonly maxTokens: number | undefined;
  private readonly topP: number | undefined;
  private readonly frequencyPenalty: number | undefined;
  private readonly presencePenalty: number | undefined;
  private readonly systemPrompt: string | undefined;
  private readonly enableRead: boolean;
  private readonly enableWrite: boolean;
  private readonly enableDiff: boolean;

  constructor() {
    const primary = vscode.workspace.getConfiguration('teCopilot');
    const legacyCopilo = vscode.workspace.getConfiguration('teCopilo');
    const oldCfg = vscode.workspace.getConfiguration('kaviaChat');
    this.temperature = (primary.get<number>('teCopilot.temperature') ?? legacyCopilo.get<number>('teCopilo.temperature') ?? oldCfg.get<number>('kaviaChat.temperature')) as number | undefined;
    this.maxTokens = (primary.get<number>('teCopilot.maxTokens') ?? legacyCopilo.get<number>('teCopilo.maxTokens') ?? oldCfg.get<number>('kaviaChat.maxTokens')) as number | undefined;
    this.topP = (primary.get<number>('teCopilot.topP') ?? legacyCopilo.get<number>('teCopilo.topP') ?? oldCfg.get<number>('kaviaChat.topP')) as number | undefined;
    this.frequencyPenalty = (primary.get<number>('teCopilot.frequencyPenalty') ?? legacyCopilo.get<number>('teCopilo.frequencyPenalty') ?? oldCfg.get<number>('kaviaChat.frequencyPenalty')) as number | undefined;
    this.presencePenalty = (primary.get<number>('teCopilot.presencePenalty') ?? legacyCopilo.get<number>('teCopilo.presencePenalty') ?? oldCfg.get<number>('kaviaChat.presencePenalty')) as number | undefined;
    this.systemPrompt = (primary.get<string>('teCopilot.systemPrompt') ?? legacyCopilo.get<string>('teCopilo.systemPrompt') ?? oldCfg.get<string>('kaviaChat.systemPrompt')) || 'You are a concise, helpful coding assistant. Prefer brevity, show minimal necessary code, and ask for missing details when required.';
    this.enableRead = !!(primary.get<boolean>('teCopilot.langchain.tools.enableRead') ?? legacyCopilo.get<boolean>('teCopilo.langchain.tools.enableRead') ?? oldCfg.get<boolean>('kaviaChat.langchain.tools.enableRead'));
    this.enableWrite = !!(primary.get<boolean>('teCopilot.langchain.tools.enableWrite') ?? legacyCopilo.get<boolean>('teCopilo.langchain.tools.enableWrite') ?? oldCfg.get<boolean>('kaviaChat.langchain.tools.enableWrite'));
    this.enableDiff = !!(primary.get<boolean>('teCopilot.langchain.tools.enableDiff') ?? legacyCopilo.get<boolean>('teCopilo.langchain.tools.enableDiff') ?? oldCfg.get<boolean>('kaviaChat.langchain.tools.enableDiff'));

    // Ensure commands exist
    ensureMcpCommandsRegistered();
  }

  // PUBLIC_INTERFACE
  stream(
    params: { messages: ChatMessage[]; config?: Record<string, unknown>; context?: Record<string, unknown>; model?: string },
    onDelta: (delta: string) => void,
    onDone: () => void,
    token: vscode.CancellationToken
  ): void {
    // Minimal "agent" that tries to parse user intent for tool usage
    const userContent = params.messages.find(m => m.role === 'user')?.content ?? '';
    const lower = userContent.toLowerCase();

    const chunks: string[] = [];
    const push = (s: string) => chunks.push(s);

    push(`Agent initialized (T=${this.temperature ?? 'default'}, MaxTokens=${this.maxTokens ?? 'default'})\n`);
    if (this.systemPrompt) push(`System: ${this.systemPrompt}\n\n`);

    // Tool heuristics
    const wantsRead = this.enableRead && /(read|show|open)\s+file/i.test(userContent);
    const wantsWrite = this.enableWrite && /(write|save|replace)\s+file/i.test(userContent);
    const wantsDiff = this.enableDiff && /(diff|patch)\b/i.test(userContent);

    // Extract a path if present in quotes or code block-like syntax
    const pathMatch = userContent.match(/["'`](.+?\.[a-zA-Z0-9]+)["'`]/)?.[1] ||
                      userContent.match(/\b([A-Za-z0-9_\-./]+\.[a-zA-Z0-9]+)\b/)?.[1];

    const maybePathInfo = pathMatch ? `Target path: ${pathMatch}\n` : 'No explicit file path detected.\n';
    push(maybePathInfo);

    (async () => {
      try {
        if (token.isCancellationRequested) return;

        if (wantsRead && pathMatch) {
          push('\n[Tool] Reading file...\n');
          const content = await mcpReadFile(pathMatch);
          push('\n[Tool:read] --- BEGIN FILE ---\n');
          push(content ?? '(empty file or not found)');
          push('\n[Tool:read] --- END FILE ---\n');
        }

        if (!token.isCancellationRequested && wantsDiff && pathMatch) {
          push('\n[Tool] Producing diff preview...\n');
          const proposed = await mcpProduceDiff(pathMatch);
          push('\n[Tool:diff] --- BEGIN DIFF ---\n');
          push(proposed || '(no changes proposed)');
          push('\n[Tool:diff] --- END DIFF ---\n');

          // Ask to apply diff
          const apply = await mcpDiffApply(pathMatch, proposed || '');
          push(`\n[Tool:diff] Apply status: ${apply ? 'applied' : 'not applied'}\n`);
        }

        if (!token.isCancellationRequested && wantsWrite && pathMatch) {
          push('\n[Tool] Writing file (confirmation required)...\n');
          // Derive a trivial write from user instruction: append a comment line
          const textToWrite = `// Updated by LangChainAgent at ${new Date().toISOString()}\n`;
          const ok = await mcpWriteFile(pathMatch, textToWrite, { append: true });
          push(`[Tool:write] ${ok ? 'Write confirmed and completed' : 'Write cancelled'}\n`);
        }

        // Final assistant reasoning response
        push('\nDone. If you need additional actions, specify the file path and desired changes.\n');

        // Stream chunks word-by-word for better UX
        const full = chunks.join('');
        const parts = full.split(/(\s+)/);
        for (const p of parts) {
          if (token.isCancellationRequested) return;
          if (p) onDelta(p);
          await new Promise(r => setTimeout(r, 10));
        }
        onDone();
      } catch {
        // Best-effort finalize
        try { onDone(); } catch {}
      }
    })().catch(() => {
      try { onDone(); } catch {}
    });
  }
}
