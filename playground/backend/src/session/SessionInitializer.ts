import { TaskManager } from '../task/TaskManager';
import { WorkflowManager } from '../workflow/WorkflowManager';
import { SessionTaskManager } from './SessionTaskManager';

/**
 * SessionInitializer handles initialization of VSCode Copilot sessions.
 * Ensures every session has a valid task with an attached workflow.
 */
export class SessionInitializer {
  constructor(
    private taskManager: TaskManager,
    private workflowManager: WorkflowManager,
    private sessionTaskManager: SessionTaskManager
  ) {}

  /**
   * Initialize a session with task validation.
   * If session already has valid mapping, returns it.
   * Otherwise returns status indicating task selection needed.
   * 
   * @param sessionId - VSCode Copilot session ID
   * @param promptForTask - Whether to indicate task selection required
   */
  async initialize(sessionId: string, promptForTask: boolean = false): Promise<SessionInitResult> {
    // Check if session already has task mapping
    const existingTaskId = await this.sessionTaskManager.getTaskId(sessionId);
    
    if (existingTaskId) {
      // Validate existing mapping
      const validation = await this.validateTaskWorkflow(existingTaskId);
      
      if (validation.valid) {
        return {
          status: 'ready',
          taskId: existingTaskId,
          workflowFilename: validation.workflowFilename!,
          message: `Session mapped to task: ${existingTaskId}`
        };
      }
      
      // Existing mapping invalid, clear it
      await this.sessionTaskManager.removeSession(sessionId);
    }
    
    // Check for pending task (getPendingTask pops from queue)
    const pendingTaskId = await this.sessionTaskManager.getPendingTask();
    if (pendingTaskId) {
      const validation = await this.validateTaskWorkflow(pendingTaskId);
      
      if (validation.valid) {
        // Map session to the task (task already removed from queue by getPendingTask)
        await this.sessionTaskManager.setTaskId(sessionId, pendingTaskId);
        
        return {
          status: 'ready',
          taskId: pendingTaskId,
          workflowFilename: validation.workflowFilename!,
          message: `Session auto-mapped to pending task: ${pendingTaskId}`
        };
      } else {
        // Task was invalid, but it's already been removed from queue
        // This is acceptable - prevents invalid tasks from blocking the queue
        console.warn(`[SessionInitializer] Pending task ${pendingTaskId} validation failed: ${validation.error}`);
      }
    }
    
    // No valid mapping, need task selection
    return {
      status: 'task_required',
      availableTasks: await this.getTasksWithWorkflows(),
      message: 'Please select a task with an attached workflow to continue'
    };
  }

  /**
   * Map a session to a task after user selection.
   * 
   * @param sessionId - VSCode Copilot session ID
   * @param taskId - User-selected task ID
   */
  async mapSession(sessionId: string, taskId: string): Promise<SessionMapResult> {
    const validation = await this.validateTaskWorkflow(taskId);
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Task validation failed'
      };
    }
    
    // Store mapping
    await this.sessionTaskManager.setTaskId(sessionId, taskId);
    
    return {
      success: true,
      taskId,
      workflowFilename: validation.workflowFilename!
    };
  }

  /**
   * Get list of tasks that have workflows attached.
   */
  private async getTasksWithWorkflows(): Promise<TaskSummary[]> {
    const allTasks = await this.taskManager.listTasks();
    
    const tasksWithWorkflows = allTasks.filter(task => !!task.workflowFilename);
    
    return tasksWithWorkflows.map(task => ({
      id: task.id,
      name: task.name,
      workflowFilename: task.workflowFilename!
    }));
  }

  /**
   * Validate that a task exists and has a valid workflow.
   */
  private async validateTaskWorkflow(taskId: string): Promise<TaskWorkflowValidation> {
    // Check task exists
    const task = await this.taskManager.getTask(taskId);
    if (!task) {
      return {
        valid: false,
        error: `Task '${taskId}' not found`
      };
    }
    
    // Check task has workflow
    if (!task.workflowFilename) {
      return {
        valid: false,
        error: `Task '${taskId}' has no workflow attached. Workflows are required.`
      };
    }
    
    // Check workflow exists
    const workflow = await this.workflowManager.getWorkflow(task.workflowFilename);
    if (!workflow) {
      return {
        valid: false,
        error: `Workflow '${task.workflowFilename}' not found for task '${taskId}'`
      };
    }
    
    return {
      valid: true,
      workflowFilename: task.workflowFilename
    };
  }
}

// ========== Type Definitions ==========

export interface SessionInitResult {
  status: 'ready' | 'task_required';
  taskId?: string;
  workflowFilename?: string;
  availableTasks?: TaskSummary[];
  message: string;
}

export interface SessionMapResult {
  success: boolean;
  taskId?: string;
  workflowFilename?: string;
  error?: string;
}

export interface TaskSummary {
  id: string;
  name: string;
  workflowFilename: string;
}

interface TaskWorkflowValidation {
  valid: boolean;
  workflowFilename?: string;
  error?: string;
}
