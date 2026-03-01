/**
 * workflow-manager.js — Frontend manager for workflows
 * Handles CRUD operations for workflow files via backend API
 */

class WorkflowManager {
  constructor() {
    this._workflows = [];
    this._changeListeners = [];
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Load all workflows from backend
   */
  async loadWorkflows() {
    try {
      const response = await fetch('/workflows');
      if (!response.ok) {
        throw new Error(`Failed to load workflows: ${response.statusText}`);
      }
      this._workflows = await response.json();
      this._notifyChange();
      return this._workflows;
    } catch (err) {
      console.error('[WorkflowManager] Load error:', err);
      throw err;
    }
  }

  /**
   * Get a specific workflow by filename
   */
  async getWorkflow(filename) {
    try {
      const response = await fetch(`/workflows/${encodeURIComponent(filename)}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get workflow: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[WorkflowManager] Get error:', err);
      throw err;
    }
  }

  /**
   * Create a new workflow
   * @param {object} data - { filename, description, handoffChain }
   * @returns {Promise<object>} Result with success status
   */
  async createWorkflow(data) {
    try {
      const response = await fetch('/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // Validation errors or other errors
        return { success: false, errors: result.errors || [{ field: 'general', message: result.error }] };
      }

      // Reload workflows list
      await this.loadWorkflows();
      return { success: true };
    } catch (err) {
      console.error('[WorkflowManager] Create error:', err);
      return { success: false, errors: [{ field: 'general', message: err.message }] };
    }
  }

  /**
   * Update an existing workflow
   * @param {string} filename - Workflow filename
   * @param {object} data - { description, handoffChain }
   * @returns {Promise<object>} Result with success status
   */
  async updateWorkflow(filename, data) {
    try {
      const response = await fetch(`/workflows/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, errors: result.errors || [{ field: 'general', message: result.error }] };
      }

      // Reload workflows list
      await this.loadWorkflows();
      return { success: true };
    } catch (err) {
      console.error('[WorkflowManager] Update error:', err);
      return { success: false, errors: [{ field: 'general', message: err.message }] };
    }
  }

  /**
   * Delete a workflow
   * @param {string} filename - Workflow filename
   * @returns {Promise<boolean>} True if successful
   */
  async deleteWorkflow(filename) {
    try {
      const response = await fetch(`/workflows/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete workflow');
      }

      // Reload workflows list
      await this.loadWorkflows();
      return true;
    } catch (err) {
      console.error('[WorkflowManager] Delete error:', err);
      throw err;
    }
  }

  /**
   * Get list of workflows (from cache)
   */
  getWorkflows() {
    return this._workflows;
  }

  /**
   * Register a change listener
   */
  onChange(fn) {
    this._changeListeners.push(fn);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _notifyChange() {
    this._changeListeners.forEach((fn) => fn(this._workflows));
  }
}

// Export to window
window.WorkflowManager = WorkflowManager;
