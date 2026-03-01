/**
 * TaskManager.ts — Manages persistent task storage
 * Tasks are stored as JSON files in data/tasks/*.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { TaskWorkflowMapper } from './TaskWorkflowMapper';

export interface Task {
  id: string;
  name: string;
  workflowFilename?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskListItem {
  id: string;
  name: string;
  workflowFilename?: string;
  createdAt: string;
  updatedAt: string;
}

export class TaskManager {
  private tasksDir: string;
  private workflowMapper: TaskWorkflowMapper;
  private taskCache: Map<string, Task> = new Map();

  constructor(dataDir: string = path.join(process.cwd(), 'data', 'tasks')) {
    this.tasksDir = dataDir;
    const mappingDataDir = path.join(process.cwd(), 'data');
    this.workflowMapper = new TaskWorkflowMapper(mappingDataDir);
    this._ensureTasksDir();
    // Eager load all tasks into memory on startup
    this._loadAllTasks();
  }

  /**
   * Load all tasks from disk into memory cache (synchronous for startup)
   */
  private _loadAllTasks(): void {
    try {
      const taskFiles = fs.readdirSync(this.tasksDir).filter(f => f.endsWith('.json'));
      for (const file of taskFiles) {
        try {
          const content = fs.readFileSync(path.join(this.tasksDir, file), 'utf-8');
          const task: Task = JSON.parse(content);
          this.taskCache.set(task.id, task);
        } catch (err) {
          console.error(`[TaskManager] Error loading task ${file}:`, err);
        }
      }
    } catch (err) {
      console.error('[TaskManager] Error loading tasks:', err);
    }
  }

  /**
   * Ensure tasks directory exists
   */
  private _ensureTasksDir(): void {
    if (!fs.existsSync(this.tasksDir)) {
      fs.mkdirSync(this.tasksDir, { recursive: true });
    }
  }

  /**
   * Get the file path for a task
   */
  private _getTaskPath(taskId: string): string {
    return path.join(this.tasksDir, `${taskId}.json`);
  }

  /**
   * Create a new task (write to memory, then save to disk)
   */
  async createTask(name: string, workflowFilename?: string): Promise<Task> {
    const taskId = this._generateTaskId(name);
    const now = new Date().toISOString();

    const task: Task = {
      id: taskId,
      name,
      workflowFilename,
      createdAt: now,
      updatedAt: now,
    };

    // Write to memory cache first (fast)
    this.taskCache.set(taskId, task);
    // Then persist to disk
    await this._saveTask(task);
    
    // Sync to mapping file if workflow provided
    if (workflowFilename) {
      this.workflowMapper.setWorkflow(taskId, workflowFilename);
    }
    
    return task;
  }

  /**
   * Get a task by ID (read from memory cache)
   */
  async getTask(taskId: string): Promise<Task | null> {
    return this.taskCache.get(taskId) ?? null;
  }

  /**
   * Get workflow filename for a task
   */
  async getWorkflow(taskId: string): Promise<string | null> {
    const task = await this.getTask(taskId);
    return task?.workflowFilename || null;
  }

  /**
   * Set workflow for a task (update memory, then save to disk)
   */
  async setWorkflow(taskId: string, workflowFilename: string | null): Promise<Task | null> {
    const task = this.taskCache.get(taskId);
    if (!task) {
      return null;
    }

    task.workflowFilename = workflowFilename || undefined;
    task.updatedAt = new Date().toISOString();

    // Update memory cache
    this.taskCache.set(taskId, task);
    // Then persist to disk
    await this._saveTask(task);
    
    // Update the mapping file
    this.workflowMapper.setWorkflow(taskId, workflowFilename);
    
    return task;
  }

  /**
   * Update a task (update memory, then save to disk)
   */
  async updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task | null> {
    const task = this.taskCache.get(taskId);
    if (!task) {
      return null;
    }

    Object.assign(task, updates);
    task.updatedAt = new Date().toISOString();

    // Update memory cache
    this.taskCache.set(taskId, task);
    // Then persist to disk
    await this._saveTask(task);
    return task;
  }

  /**
   * Delete a task (remove from memory, then delete from disk)
   */
  async deleteTask(taskId: string): Promise<boolean> {
    const task = this.taskCache.get(taskId);
    if (!task) {
      return false;
    }

    const taskPath = this._getTaskPath(taskId);
    
    try {
      // Remove from memory cache first
      this.taskCache.delete(taskId);
      // Then delete from disk
      fs.unlinkSync(taskPath);
      
      // Remove from mapping file
      this.workflowMapper.removeTask(taskId);
      
      return true;
    } catch (err) {
      console.error(`[TaskManager] Error deleting task ${taskId}:`, err);
      // Restore to cache if disk delete failed
      this.taskCache.set(taskId, task);
      return false;
    }
  }

  /**
   * List all tasks (read from memory cache)
   */
  async listTasks(): Promise<TaskListItem[]> {
    const tasks: TaskListItem[] = [];

    for (const task of this.taskCache.values()) {
      tasks.push({
        id: task.id,
        name: task.name,
        workflowFilename: task.workflowFilename,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      });
    }

    // Sort by creation date (newest first)
    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return tasks;
  }

  /**
   * Get the workflow mapper instance
   */
  getWorkflowMapper(): TaskWorkflowMapper {
    return this.workflowMapper;
  }

  /**
   * Get all task-workflow mappings
   */
  getAllWorkflowMappings(): Record<string, string> {
    return this.workflowMapper.getAllMappings();
  }

  /**
   * Get tasks using a specific workflow
   */
  getTasksByWorkflow(workflowFilename: string): string[] {
    return this.workflowMapper.getTasksByWorkflow(workflowFilename);
  }

  /**
   * Save a task to disk
   */
  private async _saveTask(task: Task): Promise<void> {
    const taskPath = this._getTaskPath(task.id);
    const content = JSON.stringify(task, null, 2);
    
    try {
      fs.writeFileSync(taskPath, content, 'utf-8');
    } catch (err) {
      console.error(`[TaskManager] Error saving task ${task.id}:`, err);
      throw err;
    }
  }

  /**
   * Generate a unique task ID from the task name
   */
  private _generateTaskId(name: string): string {
    // Create a URL-safe ID from the name
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Add timestamp to ensure uniqueness
    const timestamp = Date.now();
    return `${base}-${timestamp}`;
  }
}
