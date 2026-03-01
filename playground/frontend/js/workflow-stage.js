/**
 * workflow-stage.js — Pipeline stage indicator bar.
 * Shows Orchestrator → Coder → Reviewer → Test → Lead.
 * Each stage lights up when a terminal with that role name exists in the active task.
 */

const WORKFLOW_ROLES = ['orchestrator', 'coder', 'reviewer', 'test', 'lead'];

class WorkflowStage {
  constructor() {
    this.stageList = document.getElementById('stage-list');
    this.btnSplitView = document.getElementById('btn-split-view');

    this.btnSplitView.addEventListener('click', () => {
      const enabled = !window.terminalManager.splitView;
      window.terminalManager.setSplitView(enabled);
      this.btnSplitView.classList.toggle('btn-split--active', enabled);
      this.btnSplitView.title = enabled ? 'Exit split view' : 'Toggle split orchestration view';
    });
  }

  /**
   * Update stage indicators based on current terminal records.
   * @param {object[]} records - All terminal records
   * @param {string|null} activeTaskId - Currently selected task filter
   */
  update(records, activeTaskId) {
    const relevant = activeTaskId
      ? records.filter((r) => r.taskId === activeTaskId)
      : records;

    WORKFLOW_ROLES.forEach((role) => {
      const el = this.stageList.querySelector(`.stage-item[data-role="${role}"]`);
      if (!el) return;

      const match = relevant.find(
        (r) => r.name.toLowerCase() === role && r.alive !== false
      );

      el.classList.toggle('stage-item--active', !!match);
      el.dataset.terminalId = match ? match.id : '';
    });
  }
}

// ── Click-to-activate wiring (done after DOM is ready) ─────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('stage-list').addEventListener('click', (e) => {
    const item = e.target.closest('.stage-item');
    if (!item || !item.dataset.terminalId) return;
    const id = item.dataset.terminalId;
    window.terminalManager.activate(id);
    window.tabManager.setActive(id);
  });
});

window.workflowStage = new WorkflowStage();
