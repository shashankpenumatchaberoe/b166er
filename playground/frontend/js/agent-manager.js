/**
 * agent-manager.js — Frontend manager for agents
 * Handles CRUD operations for agent files via backend API
 */

class AgentManager {
  constructor() {
    this._agents = [];
    this._changeListeners = [];
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Load all agents from backend
   */
  async loadAgents() {
    try {
      const response = await fetch('/agents');
      if (!response.ok) {
        throw new Error(`Failed to load agents: ${response.statusText}`);
      }
      this._agents = await response.json();
      this._notifyChange();
      return this._agents;
    } catch (err) {
      console.error('[AgentManager] Load error:', err);
      throw err;
    }
  }

  /**
   * Get a specific agent by filename
   */
  async getAgent(filename) {
    try {
      const response = await fetch(`/agents/${encodeURIComponent(filename)}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get agent: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[AgentManager] Get error:', err);
      throw err;
    }
  }

  /**
   * Create a new agent
   * @param {object} data - { filename, name, description, prompt }
   * @returns {Promise<object>} Result with success status
   */
  async createAgent(data) {
    try {
      const response = await fetch('/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // Validation errors or other errors
        return { success: false, errors: result.errors || [{ field: 'general', message: result.error }] };
      }

      // Reload agents list
      await this.loadAgents();
      return { success: true };
    } catch (err) {
      console.error('[AgentManager] Create error:', err);
      return { success: false, errors: [{ field: 'general', message: err.message }] };
    }
  }

  /**
   * Update an existing agent
   * @param {string} filename - Agent filename
   * @param {object} data - { name, description, prompt }
   * @returns {Promise<object>} Result with success status
   */
  async updateAgent(filename, data) {
    try {
      const response = await fetch(`/agents/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, errors: result.errors || [{ field: 'general', message: result.error }] };
      }

      // Reload agents list
      await this.loadAgents();
      return { success: true };
    } catch (err) {
      console.error('[AgentManager] Update error:', err);
      return { success: false, errors: [{ field: 'general', message: err.message }] };
    }
  }

  /**
   * Delete an agent
   * @param {string} filename - Agent filename
   * @returns {Promise<boolean>} True if successful
   */
  async deleteAgent(filename) {
    try {
      const response = await fetch(`/agents/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete agent');
      }

      // Reload agents list
      await this.loadAgents();
      return true;
    } catch (err) {
      console.error('[AgentManager] Delete error:', err);
      throw err;
    }
  }

  /**
   * Get list of agents (from cache)
   */
  getAgents() {
    return this._agents;
  }

  /**
   * Register a change listener
   */
  onChange(fn) {
    this._changeListeners.push(fn);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _notifyChange() {
    this._changeListeners.forEach((fn) => fn(this._agents));
  }
}

// Export to window
window.AgentManager = AgentManager;
