import fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';
import { TaskManager } from '../task/TaskManager';

/**
 * Manages the mapping between VS Code session IDs and task IDs.
 * Each Copilot session can be associated with a specific task.
 */
export class SessionTaskManager {
  private filePath: string;
  private cache: Map<string, string> = new Map();
  private pendingTasks: string[] = [];  // Changed from single pendingTaskId to array
  private taskManager: TaskManager;

  constructor(dataDir: string, taskManager: TaskManager) {
    this.filePath = path.join(dataDir, '.session-tasks.json');
    this.taskManager = taskManager;
    // Eager load on construction for faster reads
    this.loadSync();
  }

  /**
   * Load session-task mappings from disk into memory cache (synchronous for startup)
   */
  private loadSync(): void {
    try {
      const content = fsSync.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(content) as { 
        sessions?: Record<string, string>; 
        pendingTaskId?: string;  // Legacy single pending task
        pendingTasks?: string[];  // New array of pending tasks
      };
      this.cache = new Map(Object.entries(data.sessions ?? {}));
      
      // Migrate from old single pendingTaskId to array
      if (data.pendingTaskId && !data.pendingTasks) {
        this.pendingTasks = [data.pendingTaskId];
      } else {
        this.pendingTasks = data.pendingTasks ?? [];
      }
      
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // File doesn't exist yet, start with empty cache
        this.cache = new Map();
        this.pendingTasks = [];
      } else {
        console.error('[SessionTaskManager] Failed to load session mappings:', err.message);
        throw err;
      }
    }
  }

  /**
   * Save session-task mappings from memory cache to disk
   */
  private async save(): Promise<void> {
    try {
      const data = {
        sessions: Object.fromEntries(this.cache),
        // Save as array for multiple pending tasks
        ...(this.pendingTasks.length > 0 && { pendingTasks: this.pendingTasks }),
      };
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[SessionTaskManager] Failed to save session mappings:', error);
      throw error;
    }
  }

  /**
   * Get the task ID associated with a session (read from memory cache)
   */
  async getTaskId(sessionId: string): Promise<string | null> {
    return this.cache.get(sessionId) ?? null;
  }

  /**
   * Set the task ID for a session (write to memory, then save to disk)
   */
  async setTaskId(sessionId: string, taskId: string): Promise<void> {
    this.cache.set(sessionId, taskId);
    await this.save();
  }

  /**
   * Remove the task mapping for a session (remove from memory, then save to disk)
   */
  async removeSession(sessionId: string): Promise<void> {
    const existed = this.cache.delete(sessionId);
    if (existed) {
      await this.save();
    }
  }

  /**
   * Get all session-task mappings (read from memory cache)
   */
  async getAll(): Promise<Record<string, string>> {
    return Object.fromEntries(this.cache);
  }

  /**
   * Clear all session-task mappings (clear memory, then save to disk)
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.pendingTasks = [];
    await this.save();
  }

  /**
   * Get and remove the next pending task ID from the queue (FIFO)
   * Returns null if no pending tasks
   */
  async getPendingTask(): Promise<string | null> {
    if (this.pendingTasks.length === 0) {
      return null;
    }
    
    const taskId = this.pendingTasks.shift()!;  // Remove first task from queue
    await this.save();
    return taskId;
  }

  /**
   * Peek at the next pending task without removing it
   */
  async peekPendingTask(): Promise<string | null> {
    return this.pendingTasks.length > 0 ? this.pendingTasks[0] : null;
  }

  /**
   * Get all pending tasks
   */
  async getAllPendingTasks(): Promise<string[]> {
    return [...this.pendingTasks];
  }

  /**
   * Add a task to the pending queue
   */
  async setPendingTask(taskId: string): Promise<void> {
    // Avoid duplicates
    if (!this.pendingTasks.includes(taskId)) {
      this.pendingTasks.push(taskId);
      await this.save();
    } else {
    }
  }

  /**
   * Remove a specific task from the pending queue
   */
  async removePendingTask(taskId: string): Promise<void> {
    const index = this.pendingTasks.indexOf(taskId);
    if (index !== -1) {
      this.pendingTasks.splice(index, 1);
      await this.save();
    }
  }

  /**
   * Clear all pending tasks
   */
  async clearPendingTask(): Promise<void> {
    this.pendingTasks = [];
    await this.save();
  }

  /**
   * Get the workflow filename for a session's task (read from memory cache)
   */
  async getWorkflowFilename(sessionId: string): Promise<string | null> {
    const taskId = this.cache.get(sessionId);
    
    if (!taskId) {
      return null;
    }

    return await this.taskManager.getWorkflow(taskId);
  }
}
