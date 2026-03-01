export interface LLMHooksAdapter {
  onConversationEnd(taskId: string, terminalId: string, buffer: string): Promise<void>;
  onToolCall(taskId: string, tool: string, payload: unknown): Promise<void>;
}

export interface HookEventPayload {
  event_type: string;
  task_id?: string;
  terminal_id?: string;
  terminal_name?: string;
  agent_name?: string;
  timestamp?: string;
  tool?: string;
  [key: string]: unknown;
}
