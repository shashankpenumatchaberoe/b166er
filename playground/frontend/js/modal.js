/**
 * modal.js — "New Terminal" dialog with agent selection and copilot command
 * Task ID is auto-assigned from the active task
 * Agent list populated from current workflow's handoff chain
 */

class Modal {
  constructor() {
    this.overlay = document.getElementById('modal-overlay');
    this.form = document.getElementById('modal-form');
    this.nameInput = document.getElementById('input-terminal-name');
    this.agentSelect = document.getElementById('input-terminal-agent');
    this.taskIdInput = document.getElementById('input-task-id');
    this.userPromptInput = document.getElementById('input-user-prompt');
    this.errorEl = document.getElementById('modal-error');
    this.btnConfirm = document.getElementById('btn-modal-confirm');
    this.btnCancel = document.getElementById('btn-modal-cancel');
    this.digitalRain = null;

    if (!this.nameInput) {
      console.error('[Modal] CRITICAL: nameInput element not found!');
    }

    this.btnConfirm.addEventListener('click', () => this._handleConfirm());
    this.btnCancel.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Submit on Enter (but not in textarea)
    this.form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target !== this.userPromptInput) {
        e.preventDefault();
        this._handleConfirm();
      }
    });

    // Escape closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
        this.close();
      }
    });
  }

  async open() {
    this.nameInput.value = '';
    this.userPromptInput.value = '';
    this.errorEl.textContent = '';
    
    // Get and display current task ID
    const taskId = window.taskManager.getActive();
    this.taskIdInput.value = taskId || '(No task selected)';
    
    // Load agents from current task's workflow
    await this._loadAgentsFromWorkflow(taskId);
    
    this.overlay.classList.remove('hidden');
    
    // Initialize digital rain effect
    if (!this.digitalRain) {
      // eslint-disable-next-line no-undef
      this.digitalRain = new DigitalRain(this.overlay);
    }
    
    setTimeout(() => {
      this.nameInput.focus();
    }, 50);
  }

  close() {
    this.overlay.classList.add('hidden');
    
    // Destroy digital rain effect
    if (this.digitalRain) {
      this.digitalRain.destroy();
      this.digitalRain = null;
    }
  }

  async _loadAgentsFromWorkflow(taskId) {
    // Clear existing options except placeholder
    this.agentSelect.innerHTML = '<option value="">Select agent...</option>';
    
    if (!taskId) {
      return;
    }

    try {
      // Get task to find workflow
      const response = await fetch(`http://localhost:3001/tasks/${taskId}`);
      if (!response.ok) {
        console.error('[Modal] Failed to fetch task:', response.status);
        return;
      }
      
      const task = await response.json();
      
      if (!task.workflowFilename) {
        console.warn('[Modal] Task has no workflow attached');
        return;
      }

      // Get workflow to extract agents
      const workflowResponse = await fetch(`http://localhost:3001/workflows/${task.workflowFilename}`);
      if (!workflowResponse.ok) {
        console.error('[Modal] Failed to fetch workflow:', workflowResponse.status);
        return;
      }

      const workflow = await workflowResponse.json();
      
      // Extract unique agent names from handoff chain
      const agentNames = new Set();
      workflow.handoffChain.forEach(handoff => {
        agentNames.add(handoff.fromAgent);
        agentNames.add(handoff.toAgent);
      });


      // Populate dropdown
      const sortedAgents = Array.from(agentNames).sort();
      sortedAgents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent;
        option.textContent = agent;
        this.agentSelect.appendChild(option);
      });

    } catch (error) {
      console.error('[Modal] Error loading agents:', error);
    }
  }

  _handleConfirm() {
    
    const name = this.nameInput.value.trim();
    const agent = this.agentSelect.value;
    const userPrompt = this.userPromptInput.value.trim();


    if (!name) {
      console.error('[Modal] Name validation failed - name is empty');
      this.errorEl.textContent = 'Terminal name is required.';
      this.nameInput.focus();
      return;
    }


    // Check if agent dropdown has options (other than placeholder)
    const hasAgentOptions = this.agentSelect.options.length > 1;
    
    if (hasAgentOptions && !agent) {
      console.error('[Modal] Agent validation failed - no agent selected');
      this.errorEl.textContent = 'Please select an agent from the workflow.';
      this.agentSelect.focus();
      return;
    }


    // Get or auto-create the active task
    const taskId = window.taskManager.getActiveOrCreate();

    // Client-side duplicate check within the active task
    const existing = window.terminalManager.getAllRecords();
    const duplicate = existing.find((r) => r.taskId === taskId && r.name === name);
    if (duplicate) {
      console.error('[Modal] Duplicate terminal name found');
      this.errorEl.textContent = `A terminal named "${name}" already exists in this task.`;
      this.nameInput.focus();
      return;
    }

    this.errorEl.textContent = '';
    this.close();

    // Build copilot command only if agent is selected
    const command = agent ? this._buildCopilotCommand(taskId, agent, userPrompt) : undefined;


    window.socketManager.emit('terminal:create', {
      taskId,
      name,
      agent: agent || undefined,
      userPrompt: userPrompt || undefined,
      command,
      isAgent: !!agent,
      cols: 80,
      rows: 24,
    });
  }

  _buildCopilotCommand(taskId, agent, userPrompt) {
    let cmd = `copilot --allow-all --agent ${agent} --interactive 'taskid:${taskId}`;
    
    if (userPrompt) {
      // Escape single quotes in user prompt
      const escapedPrompt = userPrompt.replace(/'/g, "'\\''");
      cmd += ` user prompt: ${escapedPrompt}`;
    }
    
    cmd += `'`;
    return cmd;
  }
}

window.modal = new Modal();
