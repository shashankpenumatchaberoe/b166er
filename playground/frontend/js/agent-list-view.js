/**
 * agent-list-view.js — Renders agent list
 */

class AgentListView {
  constructor() {
    this.listContainer = document.getElementById('agent-list');
    this.btnNew = document.getElementById('btn-new-agent');

    this.btnNew.addEventListener('click', () => {
      window.agentModal.openCreate();
    });
  }

  async render() {
    try {
      const agents = window.agentManager.getAgents();
      
      if (agents.length === 0) {
        this.listContainer.innerHTML = '<div class="management-empty">No agents yet. Create one to get started.</div>';
        return;
      }

      this.listContainer.innerHTML = '';

      agents.forEach((agent) => {
        const item = document.createElement('div');
        item.className = 'management-item';

        const info = document.createElement('div');
        info.className = 'management-item-info';

        const name = document.createElement('div');
        name.className = 'management-item-name';
        name.textContent = agent.name;

        const filename = document.createElement('div');
        filename.className = 'management-item-filename';
        filename.textContent = `(${agent.filename}.md)`;

        const desc = document.createElement('div');
        desc.className = 'management-item-desc';
        desc.textContent = agent.description;

        info.appendChild(name);
        info.appendChild(filename);
        info.appendChild(desc);

        const actions = document.createElement('div');
        actions.className = 'management-item-actions';

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-sm btn-ghost';
        btnEdit.textContent = 'Edit';
        btnEdit.addEventListener('click', () => {
          window.agentModal.openEdit(agent.filename);
        });

        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-sm btn-ghost btn-danger';
        btnDelete.textContent = 'Delete';
        btnDelete.addEventListener('click', async () => {
          if (confirm(`Delete agent "${agent.name}"?\nThis cannot be undone.`)) {
            try {
              await window.agentManager.deleteAgent(agent.filename);
              this.render();
            } catch (err) {
              alert(`Failed to delete agent: ${err.message}`);
            }
          }
        });

        actions.appendChild(btnEdit);
        actions.appendChild(btnDelete);

        item.appendChild(info);
        item.appendChild(actions);

        this.listContainer.appendChild(item);
      });
    } catch (err) {
      console.error('[AgentListView] Render error:', err);
      this.listContainer.innerHTML = `<div class="management-empty">Error loading agents: ${err.message}</div>`;
    }
  }
}

window.AgentListView = AgentListView;
