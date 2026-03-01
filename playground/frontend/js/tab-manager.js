/**
 * tab-manager.js — Tab bar DOM management.
 */

class TabManager {
  constructor() {
    this.tabsScroll = document.getElementById('tabs-scroll');
    this.activeId = null;
  }

  /**
   * Add a tab for the given terminal record.
   * @param {object} record - TerminalRecord
   */
  addTab(record) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.id = record.id;
    tab.title = `Task: ${record.taskId}`;

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = record.name;

    const taskSpan = document.createElement('span');
    taskSpan.className = 'tab-task-id';
    taskSpan.textContent = record.taskId;

    tab.appendChild(label);
    tab.appendChild(taskSpan);

    // Close button only for agent terminals (or all if user-initiated close)
    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close terminal';
    tab.appendChild(closeBtn);

    // Tab click → activate
    tab.addEventListener('click', (e) => {
      if (e.target === closeBtn) return;
      window.terminalManager.activate(record.id);
      this.setActive(record.id);
    });

    // Close button click
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._closeTerminal(record.id);
    });

    this.tabsScroll.appendChild(tab);
    this.scrollToTab(record.id);
  }

  /**
   * Remove a tab (agent exit or user close).
   */
  removeTab(id) {
    const tab = this.tabsScroll.querySelector(`[data-id="${id}"]`);
    if (tab) {
      tab.remove();
    }
    if (this.activeId === id) this.activeId = null;
  }

  /**
   * Remove all tabs that don't have corresponding terminals.
   * Useful for cleanup after reconnects or errors.
   */
  cleanupStaleTabs() {
    this.tabsScroll.querySelectorAll('.tab').forEach((tab) => {
      const id = tab.dataset.id;
      if (!window.terminalManager.has(id)) {
        tab.remove();
        if (this.activeId === id) this.activeId = null;
      }
    });
  }

  /**
   * Mark a tab as active.
   */
  setActive(id) {
    this.tabsScroll.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('tab--active', t.dataset.id === id);
    });
    this.activeId = id;
    
    // Save session state when terminal tab is activated
    if (window.saveSessionState) {
      setTimeout(window.saveSessionState, 50);
    }
  }

  /**
   * Scroll the tab bar so the given tab is visible.
   */
  scrollToTab(id) {
    const tab = this.tabsScroll.querySelector(`[data-id="${id}"]`);
    if (tab) {
      tab.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Show/hide tabs based on a task filter.
   * @param {string|null} taskId - null = show all
   */
  applyTaskFilter(taskId) {
    
    let firstVisibleId = null;
    let visibleCount = 0;
    const visibleTerminalIds = new Set();

    this.tabsScroll.querySelectorAll('.tab').forEach((tab) => {
      const id = tab.dataset.id;
      const rec = window.terminalManager.getRecord(id);
      
      // If terminal doesn't exist anymore, hide the tab (shouldn't happen but safeguard)
      if (!rec) {
        tab.style.display = 'none';
        return;
      }
      
      const visible = !taskId || rec.taskId === taskId;
      tab.style.display = visible ? '' : 'none';
      if (visible) {
        if (!firstVisibleId) firstVisibleId = id;
        visibleCount++;
        visibleTerminalIds.add(id);
      }
    });


    // Show/hide empty state based on visible terminal count
    const emptyState = document.getElementById('empty-state');
    const terminalContainer = document.getElementById('terminal-container');
    
    if (emptyState && terminalContainer) {
      if (visibleCount === 0) {
        emptyState.style.display = 'flex';
      } else {
        emptyState.style.display = 'none';
      }
    }

    // Determine if we need to activate a terminal
    const activeTab = this.tabsScroll.querySelector('.tab--active');
    const activeTerminalId = window.terminalManager.activeId;
    const activeTerminalRecord = activeTerminalId ? window.terminalManager.getRecord(activeTerminalId) : null;
    
    // Check if current active terminal belongs to the filtered task
    const needsActivation = 
      !activeTerminalId || // No active terminal
      !activeTerminalRecord || // Active terminal doesn't exist
      (taskId && activeTerminalRecord.taskId !== taskId) || // Active terminal is from different task
      (activeTab && activeTab.style.display === 'none'); // Active tab is hidden
    
    
    if (needsActivation && firstVisibleId) {
      // Activate the first visible terminal
      window.terminalManager.activate(firstVisibleId);
      this.setActive(firstVisibleId);
    } else if (needsActivation && !firstVisibleId) {
      // Need activation but no visible terminals - deactivate current
      if (activeTerminalId) {
        const entry = window.terminalManager.terminals.get(activeTerminalId);
        if (entry) {
          entry.wrapper.classList.remove('active');
        }
      }
      this.activeId = null;
      window.terminalManager.activeId = null;
    } else if (visibleCount === 0) {
      // No visible terminals at all
      if (activeTerminalId) {
        const entry = window.terminalManager.terminals.get(activeTerminalId);
        if (entry) {
          entry.wrapper.classList.remove('active');
        }
      }
      this.activeId = null;
      window.terminalManager.activeId = null;
    }
  }

  _closeTerminal(id) {
    // Emit close request to backend
    // The backend will send terminal:agent_exit when done, which triggers the actual UI removal
    window.socketManager.emit('terminal:close', { id });
  }
}

window.tabManager = new TabManager();
