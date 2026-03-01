import * as fs from 'fs';
import * as path from 'path';

/**
 * Manages task-to-workflow mappings in a dedicated JSON file
 * Provides fast lookup and bidirectional mapping between tasks and workflows
 */
export class TaskWorkflowMapper {
    private mappingFile: string;
    private mappings: Map<string, string>; // taskId -> workflowFilename

    constructor(dataDir: string) {
        this.mappingFile = path.join(dataDir, 'task-workflow-mapping.json');
        this.mappings = new Map();
        this.load();
    }

    /**
     * Load mappings from disk
     */
    private load(): void {
        try {
            if (fs.existsSync(this.mappingFile)) {
                const data = fs.readFileSync(this.mappingFile, 'utf-8');
                const json = JSON.parse(data);
                
                // Convert object to Map
                if (json && typeof json === 'object') {
                    Object.entries(json).forEach(([taskId, workflowFilename]) => {
                        if (typeof workflowFilename === 'string') {
                            this.mappings.set(taskId, workflowFilename);
                        }
                    });
                }
                
            } else {
            }
        } catch (error) {
            console.error('[TaskWorkflowMapper] Error loading mappings:', error);
            this.mappings = new Map();
        }
    }

    /**
     * Save mappings to disk
     */
    private save(): void {
        try {
            // Convert Map to object for JSON serialization
            const obj: Record<string, string> = {};
            this.mappings.forEach((workflowFilename, taskId) => {
                obj[taskId] = workflowFilename;
            });

            const json = JSON.stringify(obj, null, 2);
            fs.writeFileSync(this.mappingFile, json, 'utf-8');
        } catch (error) {
            console.error('[TaskWorkflowMapper] Error saving mappings:', error);
            throw error;
        }
    }

    /**
     * Set workflow for a task
     */
    setWorkflow(taskId: string, workflowFilename: string | null): void {
        
        if (workflowFilename) {
            this.mappings.set(taskId, workflowFilename);
        } else {
            // Remove mapping if workflow is cleared
            this.mappings.delete(taskId);
        }
        
        this.save();
    }

    /**
     * Get workflow for a task
     */
    getWorkflow(taskId: string): string | null {
        return this.mappings.get(taskId) || null;
    }

    /**
     * Get all tasks using a specific workflow
     */
    getTasksByWorkflow(workflowFilename: string): string[] {
        const tasks: string[] = [];
        this.mappings.forEach((workflow, taskId) => {
            if (workflow === workflowFilename) {
                tasks.push(taskId);
            }
        });
        return tasks;
    }

    /**
     * Remove a task's workflow mapping
     */
    removeTask(taskId: string): void {
        this.mappings.delete(taskId);
        this.save();
    }

    /**
     * Get all mappings
     */
    getAllMappings(): Record<string, string> {
        const obj: Record<string, string> = {};
        this.mappings.forEach((workflowFilename, taskId) => {
            obj[taskId] = workflowFilename;
        });
        return obj;
    }

    /**
     * Check if a task has a workflow
     */
    hasWorkflow(taskId: string): boolean {
        return this.mappings.has(taskId);
    }

    /**
     * Get statistics
     */
    getStats(): { totalMappings: number; uniqueWorkflows: number } {
        const uniqueWorkflows = new Set(this.mappings.values());
        return {
            totalMappings: this.mappings.size,
            uniqueWorkflows: uniqueWorkflows.size
        };
    }
}
