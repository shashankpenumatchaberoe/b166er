import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { TaskHistory, ConversationEntry } from './types';

/**
 * JSON-file based history store. Each task gets its own <taskId>.json file
 * inside the configured data directory. No native dependencies required.
 */
export class HistoryManager {
  private readonly dataDir: string;

  constructor() {
    this.dataDir = config.dataDir;
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Initialize an empty history file for a new task.
   * Called when a task is first created to ensure the history file exists.
   */
  initializeHistory(taskId: string): void {
    
    // Validate taskId
    if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
      console.warn('[HISTORY MANAGER] ❌ Cannot initialize: Invalid taskId');
      return;
    }
    
    const filePath = this._filePath(taskId);
    
    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return;
    }
    
    // Create empty history
    const now = new Date().toISOString();
    const emptyHistory: TaskHistory = {
      taskId,
      createdAt: now,
      updatedAt: now,
      conversations: [],
    };
    
    this._write(taskId, emptyHistory);
  }

  upsert(taskId: string, entry: ConversationEntry): void {
    
    // Validate taskId
    if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
      console.warn('[HISTORY MANAGER] ❌ VALIDATION FAILED: Invalid taskId');
      console.warn('[HISTORY MANAGER] taskId value:', taskId);
      console.warn('[HISTORY MANAGER] taskId type:', typeof taskId);
      return;
    }
    
    
    // Validate entry
    if (!entry || typeof entry !== 'object') {
      console.warn('[HISTORY MANAGER] ❌ VALIDATION FAILED: Invalid entry object');
      console.warn('[HISTORY MANAGER] entry value:', entry);
      console.warn('[HISTORY MANAGER] entry type:', typeof entry);
      return;
    }
    
    
    this.upsertMany(taskId, [entry]);
    
  }

  upsertMany(taskId: string, entries: ConversationEntry[]): void {
    
    // Validate taskId
    if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
      console.warn('[HISTORY MANAGER] ❌ VALIDATION FAILED: Invalid taskId in upsertMany');
      return;
    }
    
    
    // Filter out invalid entries
    const validEntries = entries.filter((entry, index) => {
      
      if (!entry || typeof entry !== 'object') {
        console.warn(`[HISTORY MANAGER] ❌ Entry ${index + 1}: Invalid entry object`);
        return false;
      }
      
      
      if (!entry.message || typeof entry.message !== 'string') {
        console.warn(`[HISTORY MANAGER] ❌ Entry ${index + 1}: Missing or invalid message`);
        console.warn(`[HISTORY MANAGER] Message value:`, entry.message);
        return false;
      }
      
      return true;
    });
    
    
    if (validEntries.length === 0) {
      console.warn('[HISTORY MANAGER] ❌ No valid entries to save');
      return;
    }

    const now = new Date().toISOString();
    const existing = this.get(taskId);

    
    if (existing) {
      const updated: TaskHistory = {
        ...existing,
        updatedAt: now,
        conversations: [...existing.conversations, ...validEntries],
      };
      this._write(taskId, updated);
    } else {
      const created: TaskHistory = {
        taskId,
        createdAt: now,
        updatedAt: now,
        conversations: validEntries,
      };
      this._write(taskId, created);
    }
    
  }

  get(taskId: string): TaskHistory | null {
    const filePath = this._filePath(taskId);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      
      const parsed = JSON.parse(raw) as TaskHistory;
      
      const normalized = this._normalizeHistory(taskId, parsed);
      
      return normalized;
    } catch (error) {
      console.error('[HISTORY MANAGER] ❌ Error reading/parsing file:', error);
      return null;
    }
  }

  getAll(): TaskHistory[] {
    if (!fs.existsSync(this.dataDir)) return [];
    return fs
      .readdirSync(this.dataDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const raw = fs.readFileSync(path.join(this.dataDir, f), 'utf-8');
          const parsed = JSON.parse(raw) as TaskHistory;
          return this._normalizeHistory(parsed.taskId, parsed);
        } catch {
          return null;
        }
      })
      .filter((h): h is TaskHistory => h !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  updateMessage(taskId: string, index: number, message: string): TaskHistory | null {
    const existing = this.get(taskId);
    if (!existing) {
      return null;
    }

    if (index < 0 || index >= existing.conversations.length) {
      return null;
    }

    const updatedEntries = existing.conversations.map((entry, entryIndex) => {
      if (entryIndex !== index) {
        return entry;
      }

      return {
        ...entry,
        message,
      };
    });

    const updated: TaskHistory = {
      ...existing,
      updatedAt: new Date().toISOString(),
      conversations: updatedEntries,
    };

    this._write(taskId, updated);
    return updated;
  }

  deleteEntry(taskId: string, index: number): TaskHistory | null {
    const existing = this.get(taskId);
    if (!existing) {
      return null;
    }

    if (index < 0 || index >= existing.conversations.length) {
      return null;
    }

    const updatedEntries = existing.conversations.filter((_, entryIndex) => entryIndex !== index);

    const updated: TaskHistory = {
      ...existing,
      updatedAt: new Date().toISOString(),
      conversations: updatedEntries,
    };

    this._write(taskId, updated);
    return updated;
  }

  /** No-op — kept for API compatibility with the original SQLite version. */
  close(): void {}

  private _filePath(taskId: string): string {
    // Sanitise taskId so it's safe as a filename
    const safe = taskId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    return path.join(this.dataDir, `${safe}.json`);
  }

  private _write(taskId: string, data: TaskHistory): void {
    const filePath = this._filePath(taskId);
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      
      // Verify the file was written
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
      } else {
        console.error('[HISTORY MANAGER] ❌ File does not exist after write!');
      }
    } catch (error) {
      console.error('[HISTORY MANAGER] ❌ Error writing file:', error);
      throw error;
    }
  }

  private _normalizeHistory(taskId: string, history: TaskHistory): TaskHistory {
    if (!Array.isArray(history.conversations)) {
      return {
        taskId,
        createdAt: history.createdAt ?? new Date().toISOString(),
        updatedAt: history.updatedAt ?? new Date().toISOString(),
        conversations: [],
      };
    }

    const normalizedEntries = history.conversations
      .map((entry) => {
        const candidate = entry as unknown as Record<string, unknown>;

        if (typeof candidate.message === 'string' && typeof candidate.timestamp === 'string') {
          return candidate as unknown as ConversationEntry;
        }

        const fallbackMessage =
          (typeof candidate.finalMessage === 'string' && candidate.finalMessage) ||
          (typeof candidate.buffer === 'string' && candidate.buffer) ||
          '';

        const timestamp =
          (typeof candidate.timestamp === 'string' && candidate.timestamp) ||
          (typeof candidate.endedAt === 'string' && candidate.endedAt) ||
          history.updatedAt ||
          new Date().toISOString();

        return {
          taskId,
          terminalId: String(candidate.terminalId ?? 'unknown'),
          terminalName: String(candidate.terminalName ?? candidate.terminalId ?? 'unknown'),
          agentName: null,
          eventType: 'legacy',
          role: 'assistant',
          message: fallbackMessage,
          timestamp,
          metadata: typeof candidate.metadata === 'object' && candidate.metadata !== null
            ? (candidate.metadata as Record<string, unknown>)
            : undefined,
        } satisfies ConversationEntry;
      })
      .filter((entry) => entry.message.trim().length > 0);

    return {
      taskId,
      createdAt: history.createdAt ?? new Date().toISOString(),
      updatedAt: history.updatedAt ?? new Date().toISOString(),
      conversations: normalizedEntries,
    };
  }
}
