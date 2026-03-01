import * as fs from 'fs';
import * as path from 'path';
import { TaskManager } from '../task/TaskManager';
import { WorkflowManager } from '../workflow/WorkflowManager';

interface TerminalMapping {
  taskId: string;
  terminalName?: string;
  createdAt: string;
  lastUsed: string;
}

interface TerminalMappingFile {
  version: string;
  mappings: Record<string, TerminalMapping>;
}

/**
 * In-memory terminal-to-task mapping manager with file persistence.
 * Pure backend approach - no fallback logic, just backend API.
 */
export class TerminalMappingManager {
  private mappings = new Map<string, TerminalMapping>();
  private readonly filePath: string;
  private autosaveTimer?: NodeJS.Timeout;
  private readonly AUTOSAVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly TASK_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
  private readonly STALE_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days
  private taskManager?: TaskManager;
  private workflowManager?: WorkflowManager;

  constructor(
    filePath: string = '.copilot-terminals.json',
    taskManager?: TaskManager,
    workflowManager?: WorkflowManager
  ) {
    this.filePath = path.resolve(filePath);
    this.taskManager = taskManager;
    this.workflowManager = workflowManager;
    this.load();
    this.cleanupStale();
    this.startAutosave();
    this.setupGracefulShutdown();
  }

  /**
   * Register a terminal with a task ID.
   */
  register(terminalId: string, taskId: string, terminalName?: string): void {
    if (!terminalId || !taskId) {
      throw new Error('terminalId and taskId are required');
    }

    if (!this.TASK_ID_REGEX.test(taskId)) {
      throw new Error(`Invalid taskId format: ${taskId}`);
    }

    const now = new Date().toISOString();
    const existing = this.mappings.get(terminalId);

    this.mappings.set(terminalId, {
      taskId,
      terminalName: terminalName ?? existing?.terminalName,
      createdAt: existing?.createdAt ?? now,
      lastUsed: now,
    });


    this.saveImmediate();
  }

  /**
   * Unregister a terminal.
   */
  unregister(terminalId: string): void {
    if (this.mappings.delete(terminalId)) {
      this.saveImmediate();
    }
  }

  /**
   * Get the task ID for a terminal.
   */
  getTaskId(terminalId: string): string | null {
    const mapping = this.mappings.get(terminalId);
    if (!mapping) {
      return null;
    }

    // Update lastUsed timestamp
    mapping.lastUsed = new Date().toISOString();
    return mapping.taskId;
  }

  /**
   * Get all mappings (for debugging).
   */
  getAll(): Record<string, TerminalMapping> {
    const result: Record<string, TerminalMapping> = {};
    this.mappings.forEach((mapping, id) => {
      result[id] = { ...mapping };
    });
    return result;
  }

  /**
   * Register a terminal with task validation.
   * Validates that the task exists and has an attached workflow.
   * 
   * @returns Validation result with taskId and workflowFilename on success
   */
  async registerWithValidation(
    terminalId: string,
    taskId: string,
    terminalName?: string
  ): Promise<TerminalRegistrationResult> {
    if (!this.taskManager || !this.workflowManager) {
      // Fallback to basic registration if managers not injected
      this.register(terminalId, taskId, terminalName);
      return { success: true, taskId };
    }

    // Validate task exists
    const task = await this.taskManager.getTask(taskId);
    if (!task) {
      return {
        success: false,
        error: `Task '${taskId}' not found`
      };
    }

    // Validate workflow attached
    if (!task.workflowFilename) {
      return {
        success: false,
        error: `Task '${taskId}' has no workflow attached. Workflows are required.`
      };
    }

    // Validate workflow exists
    const workflow = await this.workflowManager.getWorkflow(task.workflowFilename);
    if (!workflow) {
      return {
        success: false,
        error: `Workflow '${task.workflowFilename}' not found for task '${taskId}'`
      };
    }

    // Register mapping
    this.register(terminalId, taskId, terminalName);

    return {
      success: true,
      taskId: task.id,
      workflowFilename: task.workflowFilename
    };
  }

  /**
   * Load mappings from file.
   */
  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        return;
      }

      const content = fs.readFileSync(this.filePath, 'utf-8').trim();
      if (!content) {
        return; // Empty file, skip loading
      }
      
      const data: TerminalMappingFile = JSON.parse(content);

      if (data.version === '1.0' && data.mappings) {
        Object.entries(data.mappings).forEach(([id, mapping]) => {
          this.mappings.set(id, mapping);
        });
      }
    } catch (err) {
      console.error('[TerminalMapping] Failed to load mappings:', err);
    }
  }

  /**
   * Save mappings to file immediately.
   */
  private saveImmediate(): void {
    try {
      const data: TerminalMappingFile = {
        version: '1.0',
        mappings: this.getAll(),
      };

      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[TerminalMapping] Failed to save mappings:', err);
    }
  }

  /**
   * Clean up stale mappings (not used in 7 days).
   */
  private cleanupStale(): void {
    const now = Date.now();
    let removed = 0;

    this.mappings.forEach((mapping, id) => {
      const lastUsedTime = new Date(mapping.lastUsed).getTime();
      if (now - lastUsedTime > this.STALE_THRESHOLD) {
        this.mappings.delete(id);
        removed++;
      }
    });

    if (removed > 0) {
      this.saveImmediate();
    }
  }

  /**
   * Start periodic autosave.
   */
  private startAutosave(): void {
    this.autosaveTimer = setInterval(
      () => this.saveImmediate(),
      this.AUTOSAVE_INTERVAL
    );
  }

  /**
   * Setup graceful shutdown handlers.
   */
  private setupGracefulShutdown(): void {
    const shutdown = () => {
      if (this.autosaveTimer) {
        clearInterval(this.autosaveTimer);
      }
      this.saveImmediate();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * Cleanup resources (for testing).
   */
  destroy(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
    }
  }
}

/**
 * Result type for terminal registration with validation.
 */
export interface TerminalRegistrationResult {
  success: boolean;
  taskId?: string;
  workflowFilename?: string;
  error?: string;
}
