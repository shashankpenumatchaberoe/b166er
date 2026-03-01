/**
 * workflow-modal.js — Workflow creation/editing dialog
 * Collects workflow filename, description, and handoff chain
 */

class WorkflowModal {
  constructor() {
    this.overlay = document.getElementById('modal-workflow-overlay');
    this.titleEl = document.getElementById('modal-workflow-title');
    this.form = document.getElementById('modal-workflow-form');
    this.filenameInput = document.getElementById('input-workflow-filename');
    this.descInput = document.getElementById('input-workflow-desc');
    this.handoffContainer = document.getElementById('workflow-handoff-container');
    this.btnAddHandoff = document.getElementById('btn-add-handoff');
    this.errorEl = document.getElementById('modal-workflow-error');
    this.btnConfirm = document.getElementById('btn-workflow-confirm');
    this.btnCancel = document.getElementById('btn-workflow-cancel');
    this.digitalRain = null;
    this.mode = 'create'; // 'create' or 'edit'
    this.editingFilename = null;
    this.handoffRows = [];

    this.btnConfirm.addEventListener('click', () => this._handleConfirm());
    this.btnCancel.addEventListener('click', () => this.close());
    this.btnAddHandoff.addEventListener('click', () => this._addHandoffRow());
    
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    this.form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
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

  /**
   * Open modal in create mode
   */
  async openCreate() {
    // Lazy load agents if not already loaded
    if (window.agentManager) {
      await window.agentManager.loadAgents();
    }
    
    this.mode = 'create';
    this.editingFilename = null;
    this.titleEl.textContent = 'Create New Workflow';
    this.btnConfirm.textContent = 'Create';
    this.filenameInput.disabled = false;
    
    this.filenameInput.value = '';
    this.descInput.value = '';
    this.errorEl.textContent = '';
    this.handoffRows = [];
    this.handoffContainer.innerHTML = '';
    
    // Add one empty row by default
    this._addHandoffRow();
    
    this.overlay.classList.remove('hidden');
    
    if (!this.digitalRain) {
      // eslint-disable-next-line no-undef
      this.digitalRain = new DigitalRain(this.overlay);
    }
    
    setTimeout(() => this.filenameInput.focus(), 50);
  }

  /**
   * Open modal in edit mode
   */
  async openEdit(filename) {
    // Lazy load agents if not already loaded
    if (window.agentManager) {
      await window.agentManager.loadAgents();
    }
    
    this.mode = 'edit';
    this.editingFilename = filename;
    this.titleEl.textContent = 'Edit Workflow';
    this.btnConfirm.textContent = 'Save';
    this.filenameInput.disabled = true;
    this.errorEl.textContent = '';

    try {
      // Load workflow data
      const workflow = await window.workflowManager.getWorkflow(filename);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      this.filenameInput.value = workflow.filename;
      this.descInput.value = workflow.description;
      
      // Clear and rebuild handoff rows
      this.handoffRows = [];
      this.handoffContainer.innerHTML = '';
      
      if (workflow.handoffChain && workflow.handoffChain.length > 0) {
        workflow.handoffChain.forEach((handoff) => {
          this._addHandoffRow(handoff);
        });
      } else {
        this._addHandoffRow();
      }

      this.overlay.classList.remove('hidden');
      
      if (!this.digitalRain) {
        // eslint-disable-next-line no-undef
        this.digitalRain = new DigitalRain(this.overlay);
      }
      
      setTimeout(() => this.descInput.focus(), 50);
    } catch (err) {
      console.error('[WorkflowModal] Error loading workflow:', err);
      alert(`Failed to load workflow: ${err.message}`);
    }
  }

  close() {
    this.overlay.classList.add('hidden');
    
    if (this.digitalRain) {
      this.digitalRain.destroy();
      this.digitalRain = null;
    }
  }

  async _handleConfirm() {
    const filename = this.filenameInput.value.trim();
    const description = this.descInput.value.trim();
    const handoffChain = this._collectHandoffChain();

    // Client-side validation
    if (!filename) {
      this.errorEl.textContent = 'Filename is required.';
      this.filenameInput.focus();
      return;
    }

    if (!description) {
      this.errorEl.textContent = 'Description is required.';
      this.descInput.focus();
      return;
    }

    if (handoffChain.length === 0) {
      this.errorEl.textContent = 'At least one handoff rule is required.';
      return;
    }

    // Check that all handoff fields are filled
    for (let i = 0; i < handoffChain.length; i++) {
      const h = handoffChain[i];
      if (!h.fromAgent || !h.toAgent || !h.condition) {
        this.errorEl.textContent = `Handoff rule ${i + 1}: All fields are required.`;
        return;
      }
    }

    this.errorEl.textContent = '';
    this.btnConfirm.disabled = true;
    this.btnConfirm.textContent = this.mode === 'create' ? 'Creating...' : 'Saving...';

    try {
      let result;
      if (this.mode === 'create') {
        result = await window.workflowManager.createWorkflow({
          filename,
          description,
          handoffChain,
        });
      } else {
        result = await window.workflowManager.updateWorkflow(this.editingFilename, {
          description,
          handoffChain,
        });
      }

      if (result.success) {
        this.close();
        // Refresh workflow list view
        if (window.workflowListView) {
          window.workflowListView.render();
        }
      } else {
        // Display validation errors
        const errorMsg = result.errors.map((e) => e.message).join('; ');
        this.errorEl.textContent = errorMsg;
      }
    } catch (err) {
      console.error('[WorkflowModal] Error saving workflow:', err);
      this.errorEl.textContent = `Failed to save: ${err.message}`;
    } finally {
      this.btnConfirm.disabled = false;
      this.btnConfirm.textContent = this.mode === 'create' ? 'Create' : 'Save';
    }
  }

  _addHandoffRow(data = null) {
    const row = document.createElement('div');
    row.className = 'handoff-row';
    
    const agents = window.agentManager ? window.agentManager.getAgents() : [];
    
    const fromSelect = this._createAgentSelect('From Agent', data?.fromAgent || '');
    const toSelect = this._createAgentSelect('To Agent', data?.toAgent || '');
    const conditionInput = document.createElement('input');
    conditionInput.type = 'text';
    conditionInput.className = 'handoff-condition';
    conditionInput.placeholder = 'Condition (e.g., "Always", "If issues found")';
    conditionInput.value = data?.condition || '';
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-handoff';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove rule';
    removeBtn.addEventListener('click', () => {
      row.remove();
      const index = this.handoffRows.indexOf(row);
      if (index > -1) {
        this.handoffRows.splice(index, 1);
      }
    });
    
    row.appendChild(fromSelect);
    row.appendChild(toSelect);
    row.appendChild(conditionInput);
    row.appendChild(removeBtn);
    
    this.handoffContainer.appendChild(row);
    this.handoffRows.push(row);
  }

  _createAgentSelect(placeholder, selectedValue) {
    const select = document.createElement('select');
    select.className = 'agent-select';
    
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = `-- ${placeholder} --`;
    select.appendChild(emptyOption);
    
    const agents = window.agentManager ? window.agentManager.getAgents() : [];
    agents.forEach((agent) => {
      const option = document.createElement('option');
      option.value = agent.name;
      option.textContent = agent.name;
      if (agent.name === selectedValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    
    return select;
  }

  _collectHandoffChain() {
    const chain = [];
    this.handoffRows.forEach((row) => {
      const fromSelect = row.querySelector('.agent-select:nth-of-type(1)');
      const toSelect = row.querySelector('.agent-select:nth-of-type(2)');
      const conditionInput = row.querySelector('.handoff-condition');
      
      const fromAgent = fromSelect?.value.trim() || '';
      const toAgent = toSelect?.value.trim() || '';
      const condition = conditionInput?.value.trim() || '';
      
      // Include even empty rows (backend will validate)
      chain.push({ fromAgent, toAgent, condition });
    });
    return chain;
  }
}

window.workflowModal = new WorkflowModal();
