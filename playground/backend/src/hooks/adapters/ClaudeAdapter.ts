import { LLMHooksAdapter } from '../types';

/**
 * Stub adapter for Claude hooks format.
 * Implement when Claude hook payloads are defined.
 */
export class ClaudeAdapter implements LLMHooksAdapter {
  async onConversationEnd(
    taskId: string,
    terminalId: string,
    buffer: string
  ): Promise<void> {
    // TODO: implement Claude-specific persistence logic
  }

  async onToolCall(taskId: string, tool: string, payload: unknown): Promise<void> {
    // TODO: implement Claude-specific tool tracking
  }
}
