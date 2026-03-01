export type HistoryEntryRole = 'user' | 'assistant' | 'system' | 'tool' | 'event';

/**
 * ConversationEntry represents a single interaction in the task history.
 * 
 * History stores only meaningful interaction outcomes for retrospection and skill-building:
 * - user_prompt (role: 'user') - What the user asked
 * - post_tool_use (role: 'assistant') - What the bot did/responded with
 * 
 * Internal agent events (pre_tool_use, session_start/end, errors) are logged to 
 * logs/copilot-sessions/<taskId>/*.log files for debugging but NOT stored in history.
 */
export interface ConversationEntry {
  taskId: string;
  terminalId: string;
  terminalName: string;
  agentName?: string | null;
  eventType: string;
  role: HistoryEntryRole;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface TaskHistory {
  taskId: string;
  createdAt: string;   // ISO timestamp
  updatedAt: string;   // ISO timestamp
  conversations: ConversationEntry[];
}
