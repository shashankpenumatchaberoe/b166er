/**
 * task-modal.js — "New Task" creation dialog.
 * Collects a unique task name + optional description.
 */

class TaskModal {
  constructor() {
    this.overlay = document.getElementById('modal-task-overlay');
    this.form = document.getElementById('modal-task-form');
    this.nameInput = document.getElementById('input-task-name');
    this.descInput = document.getElementById('input-task-desc');
    this.workflowSelect = document.getElementById('input-task-workflow');
    this.errorEl = document.getElementById('modal-task-error');
    this.btnConfirm = document.getElementById('btn-task-confirm');
    this.btnCancel = document.getElementById('btn-task-cancel');
    this.digitalRain = null;

    this.btnConfirm.addEventListener('click', () => this._handleConfirm());
    this.btnCancel.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._handleConfirm();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
        this.close();
      }
    });
  }

  async open() {
    this.nameInput.value = '';
    this.descInput.value = '';
    this.errorEl.textContent = '';
    
    // Populate workflow dropdown
    await this._populateWorkflows();
    
    this.overlay.classList.remove('hidden');
    
    // Initialize digital rain effect
    if (!this.digitalRain) {
      // eslint-disable-next-line no-undef
      this.digitalRain = new DigitalRain(this.overlay);
    }
    
    setTimeout(() => this.nameInput.focus(), 50);
  }

  close() {
    this.overlay.classList.add('hidden');
    
    // Destroy digital rain effect
    if (this.digitalRain) {
      this.digitalRain.destroy();
      this.digitalRain = null;
    }
  }

  _handleConfirm() {
    const name = this.nameInput.value.trim();
    const description = this.descInput.value.trim();
    const workflowFilename = this.workflowSelect.value || null;

    if (!name) {
      this.errorEl.textContent = 'Task name is required.';
      this.nameInput.focus();
      return;
    }

    if (window.taskManager.isNameTaken(name)) {
      this.errorEl.textContent = `A task named "${name}" already exists.`;
      this.nameInput.focus();
      return;
    }

    this.errorEl.textContent = '';
    this.close();
    window.taskManager.createTask(name, description, workflowFilename);
  }

  async _populateWorkflows() {
    // Clear existing options except the first one
    while (this.workflowSelect.options.length > 1) {
      this.workflowSelect.remove(1);
    }
    
    // Load workflows if not already loaded
    if (window.workflowManager) {
      await window.workflowManager.loadWorkflows();
      const workflows = window.workflowManager.getWorkflows();
      
      workflows.forEach((workflow) => {
        const option = document.createElement('option');
        option.value = workflow.filename;
        option.textContent = `${workflow.filename.replace('.md', '')} - ${workflow.description}`;
        this.workflowSelect.appendChild(option);
      });
    }
  }
}

window.taskModal = new TaskModal();
