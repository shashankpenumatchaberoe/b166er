import { LLMHooksAdapter } from '../types';

export class CopilotAdapter implements LLMHooksAdapter {
  async onConversationEnd(
    taskId: string,
    terminalId: string,
    buffer: string
  ): Promise<void> {
    // Conversation ended
  }

  async onToolCall(taskId: string, tool: string, payload: unknown): Promise<void> {
    // Tool called
  }
}
