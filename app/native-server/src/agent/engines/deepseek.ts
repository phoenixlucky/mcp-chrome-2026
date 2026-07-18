import { randomUUID } from 'node:crypto';
import { CATGIRL_PERSONA_INSTRUCTIONS } from '@ethanwilkins/chrome-mcp-shared-2026';
import type { AgentMessage } from '../types';
import type { AgentEngine, EngineExecutionContext, EngineInitOptions } from './types';
import { getDeepSeekSettings } from '../settings-service';

interface DeepSeekChunk {
  choices?: Array<{
    delta?: { content?: string | null; reasoning_content?: string | null };
  }>;
}

function getApiErrorMessage(status: number, statusText: string, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
    const message = parsed.error?.message ?? parsed.message;
    if (typeof message === 'string' && message.trim()) {
      return `DeepSeek API ${status}: ${message.trim()}`;
    }
  } catch {
    // Use the status text below when the provider did not return JSON.
  }

  return `DeepSeek API ${status}: ${statusText || 'request failed'}`;
}

/** OpenAI-compatible DeepSeek chat-completions adapter. */
export class DeepSeekEngine implements AgentEngine {
  public readonly name = 'deepseek' as const;
  public readonly supportsMcp = false;

  async initializeAndRun(options: EngineInitOptions, ctx: EngineExecutionContext): Promise<void> {
    const instruction = options.instruction.trim();
    if (!instruction) throw new Error('DeepSeekEngine: instruction must not be empty');

    const savedSettings = await getDeepSeekSettings();
    const apiKey = savedSettings.apiKey?.trim() || process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'DeepSeekEngine: configure a DeepSeek API key in the extension or set DEEPSEEK_API_KEY before starting the native server.',
      );
    }

    const baseUrl = (
      savedSettings.baseUrl?.trim() ||
      process.env.DEEPSEEK_BASE_URL?.trim() ||
      'https://api.deepseek.com'
    ).replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model?.trim() || 'deepseek-v4-flash',
        stream: true,
        messages: [
          { role: 'system', content: CATGIRL_PERSONA_INSTRUCTIONS },
          { role: 'user', content: instruction },
        ],
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(getApiErrorMessage(response.status, response.statusText, detail));
    }
    if (!response.body) throw new Error('DeepSeekEngine: API response body is empty');

    const messageId = randomUUID();
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let pending = '';
    let answer = '';
    let reasoning = '';

    const emit = (isFinal: boolean): void => {
      const content = reasoning ? `💭 ${reasoning}${answer ? `\n\n${answer}` : ''}` : answer;
      if (!content) return;
      const message: AgentMessage = {
        id: messageId,
        sessionId: options.sessionId,
        role: 'assistant',
        content,
        messageType: 'chat',
        cliSource: this.name,
        requestId: options.requestId,
        isStreaming: !isFinal,
        isFinal,
        createdAt: new Date().toISOString(),
      };
      ctx.emit({ type: 'message', data: message });
    };

    const consume = (line: string): void => {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') return;
      let chunk: DeepSeekChunk;
      try {
        chunk = JSON.parse(data) as DeepSeekChunk;
      } catch {
        throw new Error('DeepSeek API returned malformed stream data.');
      }
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) return;
      if (delta.reasoning_content) reasoning += delta.reasoning_content;
      if (delta.content) answer += delta.content;
      emit(false);
    };

    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) consume(line);
      if (done) break;
    }
    if (pending) consume(pending);
    emit(true);
  }
}
