/**
 * task-manager.js — Persistent task list with backend API and localStorage fallback.
 * Tasks have a user-supplied name (unique), optional description, and optional workflow.
 */

const STORAGE_KEY = 'playground-tasks';
const COUNTER_KEY = 'playground-task-counter';

class TaskManager {
  constructor() {
    this.activeTaskId = null;
    this.listContainer = document.getElementById('task-list');
    this._tasks = [];           // { id, name, description, workflowFilename, createdAt }[]
    this._lastRecords = [];     // terminal records from the backend
    this._changeListeners = [];

    this._counter = parseInt(localStorage.getItem(COUNTER_KEY) ?? '0', 10);
    this._loadFromStorage();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Returns the currently active task ID (null = none). */
  getActive() {
    return this.activeTaskId;
  }

  hasActiveTask() {
    return !!this.activeTaskId;
  }

  getTaskCount() {
    return this._tasks.length;
  }

  hasTasks() {
    return this._tasks.length > 0;
  }

  /**
   * Returns the active task ID.
   * If none is active, auto-creates a task named "Task N" as a fallback
   * (used by modal.js when the user creates a terminal without first picking a task).
   */
  getActiveOrCreate() {
    if (this.activeTaskId) return this.activeTaskId;

    if (!this.hasTasks()) {
      window.taskModal?.open();
      return null;
    }

    this.activeTaskId = this._tasks[0].id;
    this._updateActiveTaskDisplay();
    this._renderList(this._lastRecords);
    window.tabManager.applyTaskFilter(this.activeTaskId);
    return this.activeTaskId;

  }

  /**
   * Create a new task with a user-supplied name and optional description.
   * Returns the new taskId, or null if name is taken.
   */
  async createTask(name, description = '', workflowFilename = null) {
    if (this.isNameTaken(name)) return null;
    
    // Try to create on backend first
    try {
      const response = await fetch(`${BACKEND_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, workflowFilename }),
      });
      
      if (response.ok) {
        const task = await response.json();
        // Update local cache
        this._tasks.push(task);
        this._saveToStorage();
        this.activeTaskId = task.id;
        this._renderList(this._lastRecords);
        this._updateActiveTaskDisplay();
        window.tabManager.applyTaskFilter(task.id);
        if (window.workflowStage) {
          window.workflowStage.update(this._lastRecords, task.id);
        }
        this._changeListeners.forEach((fn) => fn(task.id));
        return task.id;
      }
    } catch (err) {
      console.warn('[TaskManager] Backend unavailable, using localStorage:', err);
    }
    
    // Fallback to localStorage-only mode
    const n = this._nextCounter();
    return this._doCreate(name, description, n);
  }

  /** Returns true if a task with the given name already exists (case-insensitive). */
  isNameTaken(name) {
    const lower = name.trim().toLowerCase();
    return this._tasks.some((t) => t.name.toLowerCase() === lower);
  }

  /** Set the active task; update tab filter + history panel. */
  setActive(taskId) {
    this.activeTaskId = taskId;
    this._renderList(this._lastRecords);
    this._updateActiveTaskDisplay();
    // Clean up any stale tabs before applying filter
    window.tabManager.cleanupStaleTabs();
    window.tabManager.applyTaskFilter(taskId);
    if (window.workflowStage) {
      window.workflowStage.update(this._lastRecords, taskId);
    }
    // Auto-switch to terminals view when task is selected
    if (window.switchToView) {
      window.switchToView('terminals');
    }
    // Refresh history if History tab is currently visible
    const historyView = document.getElementById('history-view');
    if (historyView && !historyView.classList.contains('hidden')) {
      if (taskId) {
        window.historyPanel.loadForTask(taskId);
      } else {
        window.historyPanel.renderEmpty('Select a task to view its history.');
      }
    }
    this._changeListeners.forEach((fn) => fn(taskId));
  }

  /**
   * Re-derive terminal-count badges from the current terminal records.
   * Called every time terminals are created or removed.
   */
  refresh(records) {
    this._lastRecords = records;
    this._renderList(records);
    if (window.workflowStage) {
      window.workflowStage.update(records, this.activeTaskId);
    }
  }

  /**
   * Delete a task: close all its terminals, remove from storage, re-render.
   */
  async deleteTask(taskId) {
    const records = this._lastRecords.filter((r) => r.taskId === taskId);
    records.forEach((r) => {
      window.socketManager.emit('terminal:close', { id: r.id });
      window.terminalManager.remove(r.id);
      window.tabManager.removeTab(r.id);
    });

    // Try to delete from backend
    try {
      await fetch(`${BACKEND_URL}/tasks/${taskId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('[TaskManager] Failed to delete from backend:', err);
    }

    this._tasks = this._tasks.filter((t) => t.id !== taskId);
    this._saveToStorage();

    if (this.activeTaskId === taskId) {
      // Switch to first remaining task, or null
      this.activeTaskId = this._tasks.length > 0 ? this._tasks[0].id : null;
    }

    const remaining = window.terminalManager.getAllRecords();
    this._lastRecords = remaining;
    this._renderList(remaining);
    this._updateActiveTaskDisplay();
    window.tabManager.applyTaskFilter(this.activeTaskId);
    if (window.workflowStage) {
      window.workflowStage.update(remaining, this.activeTaskId);
    }
    
    // Clear history if the deleted task's history was being displayed
    if (window.historyPanel && window.historyPanel._currentTaskId === taskId) {
      if (this.activeTaskId) {
        window.historyPanel.loadForTask(this.activeTaskId);
      } else {
        window.historyPanel.renderEmpty('Select a task to view its history.');
      }
    }
    
    // Notify listeners that task list changed
    this._changeListeners.forEach((fn) => fn(this.activeTaskId));
  }

  onChange(fn) {
    this._changeListeners.push(fn);
  }

  /**
   * Load tasks from backend API
   */
  async loadTasks() {
    try {
      const response = await fetch(`${BACKEND_URL}/tasks`);
      if (response.ok) {
        const tasks = await response.json();
        this._tasks = tasks;
        this._saveToStorage();
        
        // Auto-select first task if none is active
        if (tasks.length > 0 && !this.activeTaskId) {
          this.activeTaskId = tasks[0].id;
        }
        
        // Load workflows for dropdown population
        if (window.workflowManager) {
          await window.workflowManager.loadWorkflows().catch(() => {
            // Ignore workflow load errors
          });
        }
        
        this._renderList(this._lastRecords);
        this._updateActiveTaskDisplay();
        return true;
      }
    } catch (err) {
      console.warn('[TaskManager] Failed to load tasks from backend:', err);
    }
    return false;
  }

  /**
   * Update task workflow assignment
   */
  async updateTaskWorkflow(taskId, workflowFilename) {
    try {
      const response = await fetch(`${BACKEND_URL}/tasks/${taskId}/workflow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowFilename }),
      });
      
      if (response.ok) {
        const task = await response.json();
        // Update local cache
        const index = this._tasks.findIndex((t) => t.id === taskId);
        if (index !== -1) {
          this._tasks[index] = task;
          this._saveToStorage();
          this._renderList(this._lastRecords);
        }
        return true;
      }
    } catch (err) {
      console.warn('[TaskManager] Failed to update workflow:', err);
    }
    return false;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId) {
    return this._tasks.find((t) => t.id === taskId);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _doCreate(name, description, n) {
    if (!n) n = this._nextCounter();
    const taskId = `task-${n}`;
    const task = {
      id: taskId,
      name: name.trim(),
      description: (description ?? '').trim(),
      workflowFilename: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this._tasks.push(task);
    this._saveToStorage();
    this.activeTaskId = taskId;
    this._renderList(this._lastRecords);
    this._updateActiveTaskDisplay();
    window.tabManager.applyTaskFilter(taskId);
    if (window.workflowStage) {
      window.workflowStage.update(this._lastRecords, taskId);
    }
    // Notify listeners that task list changed
    this._changeListeners.forEach((fn) => fn(taskId));
    return taskId;
  }

  _nextCounter() {
    this._counter += 1;
    localStorage.setItem(COUNTER_KEY, String(this._counter));
    return this._counter;
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this._tasks = raw ? JSON.parse(raw) : [];
    } catch {
      this._tasks = [];
    }
    // Auto-select first task if any exist
    if (this._tasks.length > 0 && !this.activeTaskId) {
      this.activeTaskId = this._tasks[0].id;
    }
    // Update display
    this._updateActiveTaskDisplay();
  }

  _saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._tasks));
  }

  _updateActiveTaskDisplay() {
    const taskIdEl = document.getElementById('current-task-id');
    if (!taskIdEl) return;
    
    if (this.activeTaskId) {
      const task = this._tasks.find((t) => t.id === this.activeTaskId);
      taskIdEl.textContent = task
        ? `${task.name} (${task.id})`
        : this.activeTaskId;
    } else {
      taskIdEl.textContent = 'None';
    }
  }

  _renderList(records) {
    // Build a terminal-count map per taskId
    const countMap = {};
    records.forEach((r) => {
      if (r.taskId) countMap[r.taskId] = (countMap[r.taskId] ?? 0) + 1;
    });

    this.listContainer.innerHTML = '';

    if (this._tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'task-list-empty';
      empty.textContent = 'No tasks yet. Click + to add one.';
      this.listContainer.appendChild(empty);
      return;
    }

    this._tasks.forEach((task) => {
      const item = document.createElement('div');
      item.className = 'task-item' + (this.activeTaskId === task.id ? ' task-item--active' : '');
      item.dataset.id = task.id;

      const body = document.createElement('div');
      body.className = 'task-item-body';

      const nameEl = document.createElement('div');
      nameEl.className = 'task-item-name';
      
      // Add warning icon if no workflow
      if (!task.workflowFilename) {
        const warningIcon = document.createElement('span');
        warningIcon.className = 'task-workflow-warning';
        warningIcon.textContent = '⚠️';
        warningIcon.title = 'This task needs a workflow. Agents cannot be used without a workflow.';
        nameEl.appendChild(warningIcon);
        nameEl.appendChild(document.createTextNode(' '));
      }
      
      nameEl.appendChild(document.createTextNode(task.name));

      body.appendChild(nameEl);

      const idEl = document.createElement('div');
      idEl.className = 'task-item-meta';
      idEl.textContent = task.id;
      body.appendChild(idEl);

      if (task.description) {
        const descEl = document.createElement('div');
        descEl.className = 'task-item-desc';
        descEl.textContent = task.description;
        body.appendChild(descEl);
      }

      const count = countMap[task.id] ?? 0;
      if (count > 0) {
        const metaEl = document.createElement('div');
        metaEl.className = 'task-item-meta';
        metaEl.textContent = `${count} terminal${count !== 1 ? 's' : ''}`;
        body.appendChild(metaEl);
      }

      // Add workflow selector
      const workflowContainer = document.createElement('div');
      workflowContainer.className = 'task-item-workflow';

      const workflowLabel = document.createElement('label');
      workflowLabel.className = 'task-workflow-label';
      workflowLabel.textContent = 'Workflow:';

      const workflowSelect = document.createElement('select');
      workflowSelect.className = 'task-workflow-select';
      
      // Add "No workflow" option
      const noneOption = document.createElement('option');
      noneOption.value = '';
      noneOption.textContent = '-- None --';
      workflowSelect.appendChild(noneOption);

      // Populate workflows if available
      if (window.workflowManager) {
        const workflows = window.workflowManager.getWorkflows();
        workflows.forEach((workflow) => {
          const option = document.createElement('option');
          option.value = workflow.filename;
          option.textContent = workflow.filename.replace('.md', '');
          workflowSelect.appendChild(option);
        });
      }

      // Set current value
      workflowSelect.value = task.workflowFilename || '';

      // Handle workflow change
      workflowSelect.addEventListener('change', async (e) => {
        e.stopPropagation();
        const newWorkflow = workflowSelect.value || null;
        const success = await this.updateTaskWorkflow(task.id, newWorkflow);
        if (!success) {
          alert('Failed to update workflow');
          // Revert selection
          workflowSelect.value = task.workflowFilename || '';
        }
      });

      // Prevent click from selecting task
      workflowSelect.addEventListener('click', (e) => e.stopPropagation());

      workflowContainer.appendChild(workflowLabel);
      workflowContainer.appendChild(workflowSelect);
      
      // Add warning message if no workflow selected
      if (!task.workflowFilename) {
        const warningMsg = document.createElement('div');
        warningMsg.className = 'task-workflow-warning-msg';
        warningMsg.textContent = '⚠️ Agents require a workflow to proceed';
        workflowContainer.appendChild(warningMsg);
      }
      
      body.appendChild(workflowContainer);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'task-item-delete';
      deleteBtn.textContent = '×';
      deleteBtn.title = `Delete "${task.name}"`;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTask(task.id);
      });

      item.appendChild(body);
      item.appendChild(deleteBtn);

      item.addEventListener('click', () => this.setActive(task.id));

      this.listContainer.appendChild(item);
    });
  }
}

window.taskManager = new TaskManager();
