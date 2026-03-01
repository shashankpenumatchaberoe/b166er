/**
 * agent-modal.js — Agent creation/editing dialog
 * Collects agent filename, name, description, and prompt
 */

class AgentModal {
  constructor() {
    this.overlay = document.getElementById('modal-agent-overlay');
    this.titleEl = document.getElementById('modal-agent-title');
    this.form = document.getElementById('modal-agent-form');
    this.filenameInput = document.getElementById('input-agent-filename');
    this.nameInput = document.getElementById('input-agent-name');
    this.descInput = document.getElementById('input-agent-desc');
    this.promptInput = document.getElementById('input-agent-prompt');
    this.errorEl = document.getElementById('modal-agent-error');
    this.btnConfirm = document.getElementById('btn-agent-confirm');
    this.btnCancel = document.getElementById('btn-agent-cancel');
    this.digitalRain = null;
    this.mode = 'create'; // 'create' or 'edit'
    this.editingFilename = null;

    this.btnConfirm.addEventListener('click', () => this._handleConfirm());
    this.btnCancel.addEventListener('click', () => this.close());
    
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
  openCreate() {
    this.mode = 'create';
    this.editingFilename = null;
    this.titleEl.textContent = 'Create New Agent';
    this.btnConfirm.textContent = 'Create';
    this.filenameInput.disabled = false;
    
    this.filenameInput.value = '';
    this.nameInput.value = '';
    this.descInput.value = '';
    this.promptInput.value = '';
    this.errorEl.textContent = '';
    
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
    this.mode = 'edit';
    this.editingFilename = filename;
    this.titleEl.textContent = 'Edit Agent';
    this.btnConfirm.textContent = 'Save';
    this.filenameInput.disabled = true;
    this.errorEl.textContent = '';

    try {
      // Load agent data
      const agent = await window.agentManager.getAgent(filename);
      if (!agent) {
        throw new Error('Agent not found');
      }

      this.filenameInput.value = agent.filename;
      this.nameInput.value = agent.name;
      this.descInput.value = agent.description;
      this.promptInput.value = agent.prompt;

      this.overlay.classList.remove('hidden');
      
      if (!this.digitalRain) {
        // eslint-disable-next-line no-undef
        this.digitalRain = new DigitalRain(this.overlay);
      }
      
      setTimeout(() => this.nameInput.focus(), 50);
    } catch (err) {
      console.error('[AgentModal] Error loading agent:', err);
      alert(`Failed to load agent: ${err.message}`);
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
    const name = this.nameInput.value.trim();
    const description = this.descInput.value.trim();
    const prompt = this.promptInput.value.trim();

    // Client-side validation
    if (!filename) {
      this.errorEl.textContent = 'Filename is required.';
      this.filenameInput.focus();
      return;
    }

    if (!name) {
      this.errorEl.textContent = 'Name is required.';
      this.nameInput.focus();
      return;
    }

    if (!description) {
      this.errorEl.textContent = 'Description is required.';
      this.descInput.focus();
      return;
    }

    if (!prompt) {
      this.errorEl.textContent = 'Prompt is required.';
      this.promptInput.focus();
      return;
    }

    this.errorEl.textContent = '';
    this.btnConfirm.disabled = true;
    this.btnConfirm.textContent = this.mode === 'create' ? 'Creating...' : 'Saving...';

    try {
      let result;
      if (this.mode === 'create') {
        result = await window.agentManager.createAgent({
          filename,
          name,
          description,
          prompt,
        });
      } else {
        result = await window.agentManager.updateAgent(this.editingFilename, {
          name,
          description,
          prompt,
        });
      }

      if (result.success) {
        this.close();
        // Refresh agent list view
        if (window.agentListView) {
          window.agentListView.render();
        }
      } else {
        // Display validation errors
        const errorMsg = result.errors.map((e) => e.message).join('; ');
        this.errorEl.textContent = errorMsg;
      }
    } catch (err) {
      console.error('[AgentModal] Error saving agent:', err);
      this.errorEl.textContent = `Failed to save: ${err.message}`;
    } finally {
      this.btnConfirm.disabled = false;
      this.btnConfirm.textContent = this.mode === 'create' ? 'Create' : 'Save';
    }
  }
}

window.agentModal = new AgentModal();
