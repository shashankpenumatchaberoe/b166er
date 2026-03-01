/**
 * workflow-list-view.js — Renders workflow list
 */

class WorkflowListView {
  constructor() {
    this.listContainer = document.getElementById('workflow-list');
    this.btnNew = document.getElementById('btn-new-workflow');

    this.btnNew.addEventListener('click', () => {
      window.workflowModal.openCreate();
    });
  }

  async render() {
    try {
      const workflows = window.workflowManager.getWorkflows();
      
      if (workflows.length === 0) {
        this.listContainer.innerHTML = '<div class="management-empty">No workflows yet. Create one to get started.</div>';
        return;
      }

      this.listContainer.innerHTML = '';

      workflows.forEach((workflow) => {
        const item = document.createElement('div');
        item.className = 'management-item';

        const info = document.createElement('div');
        info.className = 'management-item-info';

        const name = document.createElement('div');
        name.className = 'management-item-name';
        name.textContent = workflow.filename;

        const desc = document.createElement('div');
        desc.className = 'management-item-desc';
        desc.textContent = workflow.description;

        info.appendChild(name);
        info.appendChild(desc);

        const actions = document.createElement('div');
        actions.className = 'management-item-actions';

        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-sm btn-ghost';
        btnEdit.textContent = 'Edit';
        btnEdit.addEventListener('click', () => {
          window.workflowModal.openEdit(workflow.filename);
        });

        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-sm btn-ghost btn-danger';
        btnDelete.textContent = 'Delete';
        btnDelete.addEventListener('click', async () => {
          if (confirm(`Delete workflow "${workflow.filename}"?\nThis cannot be undone.`)) {
            try {
              await window.workflowManager.deleteWorkflow(workflow.filename);
              this.render();
            } catch (err) {
              alert(`Failed to delete workflow: ${err.message}`);
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
      console.error('[WorkflowListView] Render error:', err);
      this.listContainer.innerHTML = `<div class="management-empty">Error loading workflows: ${err.message}</div>`;
    }
  }
}

window.WorkflowListView = WorkflowListView;
