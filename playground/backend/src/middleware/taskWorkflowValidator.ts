import { Request, Response, NextFunction } from 'express';
import { TaskManager } from '../task/TaskManager';
import { WorkflowManager } from '../workflow/WorkflowManager';

/**
 * Express middleware to enforce task+workflow requirement.
 * Validates that the task exists and has an attached workflow.
 */
export function createTaskWorkflowValidator(
  taskManager: TaskManager,
  workflowManager: WorkflowManager
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { taskId } = req.body;

    if (!taskId) {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }

    try {
      // Validate task exists
      const task = await taskManager.getTask(taskId);

      if (!task) {
        res.status(404).json({ 
          error: 'Task not found',
          taskId 
        });
        return;
      }

      // Validate workflow attached
      if (!task.workflowFilename) {
        res.status(422).json({
          error: 'Task has no workflow attached. Workflows are required.',
          taskId: task.id,
          requireWorkflow: true
        });
        return;
      }

      // Validate workflow exists
      const workflow = await workflowManager.getWorkflow(task.workflowFilename);
      
      if (!workflow) {
        res.status(422).json({
          error: `Workflow '${task.workflowFilename}' not found for task '${taskId}'`,
          taskId: task.id,
          workflowFilename: task.workflowFilename
        });
        return;
      }

      // Attach validated data to request for downstream use
      (req as any).validatedTask = task;
      (req as any).validatedWorkflow = workflow;

      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[taskWorkflowValidator] Error:', message);
      res.status(500).json({ error: 'Internal server error during task validation' });
    }
  };
}

/**
 * Type augmentation for Express Request to include validated task/workflow.
 * Usage in route handlers:
 * 
 * ```typescript
 * app.post('/copilot/event', requireTaskWorkflow, (req: ValidatedRequest, res) => {
 *   const task = req.validatedTask;
 *   const workflow = req.validatedWorkflow;
 * });
 * ```
 */
export interface ValidatedRequest extends Request {
  validatedTask: {
    id: string;
    name: string;
    workflowFilename: string;
    createdAt: string;
    updatedAt: string;
  };
  validatedWorkflow: {
    filename: string;
    description: string;
    handoffChain: Array<{
      fromAgent: string;
      toAgent: string;
      condition: string;
    }>;
  };
}
