/**
 * app.js — Bootstrap and coordinates all modules.
 */

const BACKEND_URL = '';

// ── Load project name from parent package.json ─────────────────────────────

async function loadProjectName() {
  try {
    const res = await fetch(`${BACKEND_URL}/package-info`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const projectNameEl = document.getElementById('project-name');
    if (projectNameEl && data.name) {
      projectNameEl.textContent = data.name;
    }
  } catch (err) {
    console.warn('[loadProjectName] Failed to load package info:', err);
    const projectNameEl = document.getElementById('project-name');
    if (projectNameEl) {
      projectNameEl.textContent = 'MAX';
    }
  }
}

// ── View tab switching ─────────────────────────────────────────────────────

let splitViewActive = false;
let lastTaskView = 'terminals'; // Track last task-level view (terminals/history)

function switchToView(view) {
  const viewTabsEl = document.getElementById('view-tabs');
  const terminalBar = document.getElementById('terminal-bar');
  const mainArea = document.getElementById('main-area');
  const historyView = document.getElementById('history-view');
  const workflowsView = document.getElementById('workflows-view');
  const agentsView = document.getElementById('agents-view');
  const taskContentArea = document.getElementById('task-content-area');

  // Track task-level views
  if (view === 'terminals' || view === 'history') {
    lastTaskView = view;
  }

  // If split view is active and switching between terminals/history, just update active tab
  if (splitViewActive && (view === 'terminals' || view === 'history')) {
    viewTabsEl.querySelectorAll('.view-tab').forEach((b) => {
      b.classList.toggle('view-tab--active', b.dataset.view === view);
    });
    return;
  }

  // Otherwise, exit split view and hide all views first
  if (splitViewActive) {
    toggleSplitView(false);
  }

  terminalBar.classList.add('hidden');
  mainArea.classList.add('hidden');
  historyView.classList.add('hidden');
  workflowsView.classList.add('hidden');
  agentsView.classList.add('hidden');

  // Update active tab
  viewTabsEl.querySelectorAll('.view-tab').forEach((b) => {
    b.classList.toggle('view-tab--active', b.dataset.view === view);
  });

  // Show selected view
  switch (view) {
    case 'terminals':
      terminalBar.classList.remove('hidden');
      mainArea.classList.remove('hidden');
      window.terminalManager.fitActive();
      break;
    case 'history':
      historyView.classList.remove('hidden');
      const taskId = window.taskManager.getActive();
      
      if (!window.historyPanel) {
        console.warn('[App] historyPanel not initialized yet');
        break;
      }
      
      if (taskId) {
        // Only reload if it's a different task or history isn't loaded yet
        if (window.historyPanel._currentTaskId !== taskId || 
            !window.historyPanel.list.querySelector('.history-entry')) {
          window.historyPanel.loadForTask(taskId);
        } else {
        }
      } else {
        window.historyPanel.renderEmpty('Select a task to view its history.');
      }
      break;
    case 'workflows':
      workflowsView.classList.remove('hidden');
      // Load and render workflows
      window.workflowManager.loadWorkflows().then(() => {
        window.workflowListView.render();
      });
      break;
    case 'agents':
      agentsView.classList.remove('hidden');
      // Load and render agents
      window.agentManager.loadAgents().then(() => {
        window.agentListView.render();
      });
      break;
  }
}

function toggleSplitView(enable) {
  const taskContentArea = document.getElementById('task-content-area');
  const mainArea = document.getElementById('main-area');
  const historyView = document.getElementById('history-view');
  const terminalBar = document.getElementById('terminal-bar');
  const btnSplitHistory = document.getElementById('btn-split-history');

  if (enable === undefined) {
    enable = !splitViewActive;
  }

  splitViewActive = enable;

  if (enable) {
    // Enter split view: show both terminals and history
    taskContentArea.classList.add('split-view');
    terminalBar.classList.remove('hidden');
    mainArea.classList.remove('hidden');
    historyView.classList.remove('hidden');
    btnSplitHistory.classList.add('btn-split--active');
    btnSplitHistory.title = 'Exit split view';

    // Create resize handle if it doesn't exist
    let resizeHandle = taskContentArea.querySelector('.split-resize-handle');
    if (!resizeHandle) {
      resizeHandle = document.createElement('div');
      resizeHandle.className = 'split-resize-handle';
      taskContentArea.insertBefore(resizeHandle, historyView);
      
      // Add resize functionality
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;
      
      resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = historyView.offsetWidth;
        resizeHandle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const delta = startX - e.clientX;
        const newWidth = Math.max(350, Math.min(800, startWidth + delta));
        historyView.style.flexBasis = `${newWidth}px`;
        
        // Fit terminals during resize
        window.terminalManager.fitActive();
      });
      
      document.addEventListener('mouseup', () => {
        if (isResizing) {
          isResizing = false;
          resizeHandle.classList.remove('dragging');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }

    // Load history for current task
    const taskId = window.taskManager.getActive();
    if (taskId && window.historyPanel) {
      window.historyPanel.loadForTask(taskId);
    }

    // Fit terminals after layout change
    setTimeout(() => window.terminalManager.fitActive(), 100);
  } else {
    // Exit split view: return to single view mode
    taskContentArea.classList.remove('split-view');
    btnSplitHistory.classList.remove('btn-split--active');
    btnSplitHistory.title = 'Split view: History + Terminals';
    
    // Remove resize handle
    const resizeHandle = taskContentArea.querySelector('.split-resize-handle');
    if (resizeHandle) {
      resizeHandle.remove();
    }

    // Determine which view to show based on active tab
    const activeTab = document.querySelector('.view-tab--active');
    const view = activeTab?.dataset.view || 'terminals';
    
    if (view === 'terminals') {
      historyView.classList.add('hidden');
      mainArea.classList.remove('hidden');
      terminalBar.classList.remove('hidden');
    } else if (view === 'history') {
      mainArea.classList.add('hidden');
      terminalBar.classList.add('hidden');
      historyView.classList.remove('hidden');
    }

    setTimeout(() => window.terminalManager.fitActive(), 100);
  }
}

function initViewTabs() {
  const viewTabsEl = document.getElementById('view-tabs');

  viewTabsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.view-tab');
    if (!btn) return;

    const view = btn.dataset.view;
    switchToView(view);
  });

  // Header navigation buttons for Workflows and Agents
  const btnWorkflows = document.getElementById('btn-workflows');
  const btnAgents = document.getElementById('btn-agents');

  if (btnWorkflows) {
    btnWorkflows.addEventListener('click', () => {
      // Remove active state from view tabs
      viewTabsEl.querySelectorAll('.view-tab').forEach(b => {
        b.classList.remove('view-tab--active');
      });
      switchToView('workflows');
      // Save state to persist workflows view
      window.saveSessionState();
    });
  }

  if (btnAgents) {
    btnAgents.addEventListener('click', () => {
      // Remove active state from view tabs
      viewTabsEl.querySelectorAll('.view-tab').forEach(b => {
        b.classList.remove('view-tab--active');
      });
      switchToView('agents');
      // Save state to persist agents view
      window.saveSessionState();
    });
  }

  // Make switchToView globally accessible
  window.switchToView = switchToView;
  window.toggleSplitView = toggleSplitView;

  // Split view button
  const btnSplitHistory = document.getElementById('btn-split-history');
  if (btnSplitHistory) {
    btnSplitHistory.addEventListener('click', () => {
      toggleSplitView();
    });
  }

  // Collapse history button
  const btnCollapseHistory = document.getElementById('btn-collapse-history');
  if (btnCollapseHistory) {
    btnCollapseHistory.addEventListener('click', () => {
      toggleHistoryCollapse();
    });
  }
}

function toggleHistoryCollapse() {
  const historyView = document.getElementById('history-view');
  const btnCollapse = document.getElementById('btn-collapse-history');
  const isCollapsed = historyView.classList.toggle('collapsed');
  
  if (isCollapsed) {
    btnCollapse.title = 'Expand history panel';
    btnCollapse.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M4 9L7 6L4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  } else {
    btnCollapse.title = 'Collapse history panel';
    btnCollapse.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M9 4L6 7L3 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  // Fit terminals after layout change
  setTimeout(() => window.terminalManager.fitActive(), 100);
}

function isHistoryTabActive() {
  const btn = document.querySelector('.view-tab--active');
  return btn?.dataset.view === 'history';
}

// ── Connection status ──────────────────────────────────────────────────────

function setStatus(state, message) {
  const dot  = document.getElementById('connection-dot');
  const text = document.getElementById('connection-text');
  const pill = document.getElementById('connection-status');
  const bar  = document.getElementById('status-bar');
  const msg  = document.getElementById('status-message');

  bar.classList.remove('disconnected', 'error');
  pill.classList.remove('connected');
  dot.classList.remove('connected');

  switch (state) {
    case 'connected':
      dot.classList.add('connected');
      pill.classList.add('connected');
      text.textContent = 'Connected';
      msg.textContent = message ?? 'Ready';
      break;
    case 'connecting':
      text.textContent = 'Connecting…';
      bar.classList.add('disconnected');
      msg.textContent = 'Connecting to backend…';
      break;
    case 'reconnecting':
      text.textContent = `Retry #${message ?? ''}`;
      bar.classList.add('disconnected');
      msg.textContent = 'Lost connection — reconnecting…';
      break;
    case 'disconnected':
      text.textContent = 'Disconnected';
      bar.classList.add('disconnected');
      msg.textContent = 'Backend not reachable · is the server running?';
      break;
    case 'error':
      text.textContent = 'Error';
      bar.classList.add('error');
      msg.textContent = message ?? 'An error occurred';
      setTimeout(() => setStatus('connected'), 4000);
      break;
  }
}

function updateAgentCount() {
  const records = window.terminalManager.getAllRecords();
  const n = records.filter((r) => r.isAgent).length;
  const el = document.getElementById('status-agent-count');
  if (el) el.textContent = n > 0 ? `${n}/5 agents` : '';
}

function refreshOrchestratorPanels() {
  const records = window.terminalManager.getAllRecords();
  window.taskManager.refresh(records);
}

function typeText(element, text, delay = 50, callback) {
  element.textContent = '';
  let index = 0;
  
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  element.appendChild(cursor);
  
  const typeChar = () => {
    if (index < text.length) {
      element.textContent = text.substring(0, index + 1);
      element.appendChild(cursor);
      index++;
      setTimeout(typeChar, delay);
    } else {
      // Remove cursor after typing completes
      setTimeout(() => {
        cursor.remove();
        if (callback) callback();
      }, 500);
    }
  };
  
  typeChar();
}

// Make typeText available globally for other modules
window.typeText = typeText;

function updateEmptyStateCta() {
  const btn = document.getElementById('btn-open-terminal');
  const heading = document.getElementById('empty-heading');
  const sub = document.getElementById('empty-sub');
  const hint = document.getElementById('empty-hint');
  const icon = document.getElementById('empty-icon');
  if (!btn) return;

  const hasTask = window.taskManager.hasActiveTask();
  const svg = btn.querySelector('svg');
  
  if (hasTask) {
    // Has task - show terminal creation message with Agent Smith
    if (heading) {
      heading.classList.add('typing');
      heading.textContent = '';
      setTimeout(() => {
        typeText(heading, 'No terminals open', 80, () => {
          if (sub) {
            sub.textContent = '';
            sub.classList.add('typing');
            typeText(sub, 'Mr. Andreson, create a terminal to run a shell or agent', 50);
          }
        });
      }, 800);
    }
    if (hint) hint.style.display = '';
    if (icon) {
      icon.src = 'icons8-agent-smith-48.png';
      icon.style.display = '';
    }
    btn.textContent = '';
    if (svg) btn.appendChild(svg);
    btn.appendChild(document.createTextNode(' New Terminal'));
  } else {
    // No task - prompt to add task first with typing effect
    if (heading) {
      heading.classList.add('typing');
      heading.textContent = '';
      setTimeout(() => {
        typeText(heading, 'Get started', 80, () => {
          // After heading completes, type the subtitle
          if (sub) {
            sub.textContent = '';
            sub.classList.add('typing');
            typeText(sub, 'Add a task to see how deep the rabbit hole goes!', 50);
          }
        });
      }, 800);
    }
    if (hint) hint.style.display = '';
    if (icon) {
      icon.src = 'icons8-morpheus-48.png';
      icon.style.display = '';
    }
    btn.textContent = '';
    if (svg) btn.appendChild(svg);
    btn.appendChild(document.createTextNode(' Add Task'));
  }
}

// ── Restore terminals on (re)connect ──────────────────────────────────────

async function restoreTerminals() {
  try {
    const res = await fetch(`${BACKEND_URL}/terminals`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const records = await res.json();
    const savedId = sessionStorage.getItem('activeTerminalId');

    for (const record of records) {
      if (!window.terminalManager.has(record.id)) {
        window.terminalManager.create(record, record.buffer ?? '');
        window.tabManager.addTab(record);
      }
    }

    if (savedId && window.terminalManager.has(savedId)) {
      window.terminalManager.activate(savedId);
      window.tabManager.setActive(savedId);
    } else if (records.length > 0) {
      window.terminalManager.activate(records[0].id);
      window.tabManager.setActive(records[0].id);
    }

    updateAgentCount();
    // Refresh task panel with restored terminal counts
    window.taskManager.refresh(records);
    // Clean up any stale tabs
    window.tabManager.cleanupStaleTabs();
    // Apply filter for the current active task
    window.tabManager.applyTaskFilter(window.taskManager.getActive());
    // Update empty state CTA based on task presence
    updateEmptyStateCta();
    
    // Apply pending state restoration after terminals are ready
    applyPendingStateRestore();
  } catch (err) {
    console.warn('[App] restoreTerminals failed:', err.message);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

// ── Session State Persistence ─────────────────────────────────────────────

// Use URL hash for instant state restoration (no delays)
window.saveSessionState = function saveSessionState() {
  // Determine current view - check both task-level and top-level views
  const activeViewTab = document.querySelector('.view-tab--active');
  const taskLevelView = activeViewTab?.dataset.view;
  
  // Check if we're on workflows or agents view
  const workflowsView = document.getElementById('workflows-view');
  const agentsView = document.getElementById('agents-view');
  const isOnWorkflows = workflowsView && !workflowsView.classList.contains('hidden');
  const isOnAgents = agentsView && !agentsView.classList.contains('hidden');
  
  let currentView = taskLevelView;
  if (isOnWorkflows) currentView = 'workflows';
  if (isOnAgents) currentView = 'agents';
  
  const state = {
    taskId: window.taskManager?.getActive(),
    terminalId: window.terminalManager?.activeId,
    splitView: splitViewActive,
    view: currentView || 'terminals',
  };
  
  // Build URL hash
  const params = new URLSearchParams();
  if (state.taskId) params.set('task', state.taskId);
  if (state.terminalId) params.set('terminal', state.terminalId);
  if (state.view && state.view !== 'terminals') params.set('view', state.view);
  if (state.splitView) params.set('split', '1');
  
  const hash = params.toString();
  const newUrl = hash ? `#${hash}` : window.location.pathname;
  const currentUrl = window.location.hash ? `#${window.location.hash.slice(1)}` : window.location.pathname;
  
  // Only update if URL actually changed (avoid unnecessary history updates)
  if (newUrl !== currentUrl) {
    history.replaceState(null, '', newUrl);
  }
  
  // Also save to localStorage as fallback (including lastTaskView for persistence)
  localStorage.setItem('playground-session-state', JSON.stringify({
    ...state,
    lastTaskView: lastTaskView,
    timestamp: Date.now()
  }));
}

function restoreSessionState() {
  try {
    let state = null;
    
    // Try to restore from URL hash first (instant, no delays needed)
    if (window.location.hash) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      state = {
        taskId: params.get('task'),
        terminalId: params.get('terminal'),
        view: params.get('view') || 'terminals',
        splitView: params.get('split') === '1',
      };
      
      // Get lastTaskView from localStorage as URL doesn't store it
      const saved = localStorage.getItem('playground-session-state');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.lastTaskView) {
            state.lastTaskView = parsed.lastTaskView;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
    } else {
      // Fallback to localStorage
      const saved = localStorage.getItem('playground-session-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Don't restore if state is too old (>24 hours)
        if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
          localStorage.removeItem('playground-session-state');
          return;
        }
        state = parsed;
      }
    }
    
    if (!state) return;
    
    // Update lastTaskView based on restored state
    if (state.view === 'terminals' || state.view === 'history') {
      lastTaskView = state.view;
    } else if (state.lastTaskView) {
      // Restore lastTaskView from localStorage for workflows/agents
      lastTaskView = state.lastTaskView;
    }
    
    // Store state for use after async operations complete
    window._pendingStateRestore = state;
    
  } catch (err) {
    console.warn('[App] Failed to restore session state:', err);
  }
}

function applyPendingStateRestore() {
  const state = window._pendingStateRestore;
  if (!state) {
    return;
  }
  
  
  try {
    // Check if we should defer task restoration
    let tasksNotLoaded = false;
    
    // Restore task - only if tasks are loaded
    if (state.taskId && window.taskManager) {
      const tasks = window.taskManager._tasks;
      
      if (tasks.length === 0) {
        // Tasks not loaded yet - defer only task restoration, but continue with view/terminal restoration
        tasksNotLoaded = true;
      } else {
        const taskExists = tasks.some(t => t.id === state.taskId);
        
        if (taskExists) {
          window.taskManager.activeTaskId = state.taskId;
          window.taskManager._updateActiveTaskDisplay();
          window.tabManager.applyTaskFilter(state.taskId);
          if (window.historyPanel) {
            window.historyPanel.loadForTask(state.taskId);
          }
        } else {
          console.warn(`[App] Task ${state.taskId} not found in loaded tasks`);
        }
      }
    }
    
    // Restore terminal (even if tasks not loaded)
    if (state.terminalId && window.terminalManager.terminals.has(state.terminalId)) {
      window.terminalManager.activate(state.terminalId);
      window.tabManager.setActive(state.terminalId);
    }
    
    // Only mark as complete if tasks were loaded, otherwise allow retry
    if (tasksNotLoaded) {
      return; // Don't restore view yet - wait for tasks, then restore everything
    }
    
    // Restore view (only after tasks are loaded if a task is needed)
    if (state.view === 'workflows') {
      // Restore workflows view
      switchToView('workflows');
    } else if (state.view === 'agents') {
      // Restore agents view
      switchToView('agents');
    } else if (state.view === 'history') {
      // Restore history view and update lastTaskView
      lastTaskView = state.view;
      const tab = document.querySelector(`.view-tab[data-view="${state.view}"]`);
      if (tab) {
        tab.click();
      } else {
        console.error('[App] History tab not found!');
      }
    } else {
      // Default to terminals
      lastTaskView = 'terminals';
    }
    
    // Mark as partially restored to prevent double restoration
    window._statePartiallyRestored = true;
    
    // Restore split view
    if (state.splitView && !splitViewActive) {
      toggleSplitView();
    }
    
    // Clear pending state
    window._pendingStateRestore = null;
    window._statePartiallyRestored = false;
    
  } catch (err) {
    console.warn('[App] Failed to apply pending state:', err);
  }
}

// Save state when things change
function setupStatePersistence() {
  // Save on task change
  window.taskManager.onChange(() => window.saveSessionState());
  
  // Save on view change
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setTimeout(window.saveSessionState, 100);
    });
  });
  
  // Save on split view toggle
  const btnSplitHistory = document.getElementById('btn-split-history');
  if (btnSplitHistory) {
    btnSplitHistory.addEventListener('click', () => {
      setTimeout(window.saveSessionState, 100);
    });
  }
  
  // Save before page unload
  window.addEventListener('beforeunload', window.saveSessionState);
}

function init() {
  const socket   = window.socketManager;
  const termMgr  = window.terminalManager;
  const tabMgr   = window.tabManager;
  const modalDlg = window.modal;

  // Initialize workflow and agent management
  window.workflowManager = new WorkflowManager();
  window.agentManager = new AgentManager();
  window.workflowListView = new WorkflowListView();
  window.agentListView = new AgentListView();

  // Load tasks from backend
  window.taskManager.loadTasks().then(() => {
    // Apply pending state after tasks are loaded
    if (window._pendingStateRestore && !window._statePartiallyRestored) {
      applyPendingStateRestore();
    }
  }).catch((err) => {
    console.warn('[App] Failed to load tasks from backend:', err);
  });

  // Load project name from parent package.json
  loadProjectName();

  // Restore previous session state
  restoreSessionState();

  initViewTabs();
  
  // Setup state persistence
  setupStatePersistence();

  // ── Socket lifecycle ──

  socket.on('_connecting',    ()  => setStatus('connecting'));
  socket.on('_reconnecting',  (n) => setStatus('reconnecting', n));
  socket.on('_disconnected',  ()  => setStatus('disconnected'));
  socket.on('_connect_error', ()  => setStatus('disconnected'));

  socket.on('_connected', async () => {
    setStatus('connected');
    await restoreTerminals();
  });

  // ── Terminal events ──

  socket.on('terminal:created', (record) => {
    termMgr.create(record);
    tabMgr.addTab(record);

    // Switch to appropriate view if not already on task-level view
    const workflowsView = document.getElementById('workflows-view');
    const agentsView = document.getElementById('agents-view');
    const mainArea = document.getElementById('main-area');
    const historyView = document.getElementById('history-view');
    
    const onWorkflowsOrAgents = !workflowsView.classList.contains('hidden') || 
                                 !agentsView.classList.contains('hidden');
    
    if (onWorkflowsOrAgents) {
      // Restore to last task view when creating terminal from workflows/agents
      document.querySelector(`.view-tab[data-view="${lastTaskView}"]`).click();
    } else if (isHistoryTabActive()) {
      // Switch to Terminals view if currently on History
      document.querySelector('.view-tab[data-view="terminals"]').click();
    }

    const activeTask = window.taskManager.getActive();
    if (!activeTask || record.taskId === activeTask) {
      termMgr.activate(record.id);
      tabMgr.setActive(record.id);
      window.saveSessionState();
    }

    updateAgentCount();
    refreshOrchestratorPanels();
    tabMgr.applyTaskFilter(window.taskManager.getActive());
    updateEmptyStateCta();

    setStatus('connected', `Terminal "${record.name}" created`);
  });

  socket.on('terminal:output', ({ id, data }) => {
    termMgr.write(id, data);
  });

  socket.on('terminal:agent_exit', ({ id }) => {
    const rec = termMgr.getRecord(id);
    const taskId = rec?.taskId ?? window.taskManager.getActive();

    termMgr.remove(id);
    tabMgr.removeTab(id);

    // Clean up any stale tabs
    tabMgr.cleanupStaleTabs();

    updateAgentCount();
    refreshOrchestratorPanels();

    // Re-apply task filter to update visibility and empty state
    const currentTaskId = window.taskManager.getActive();
    if (currentTaskId) {
      tabMgr.applyTaskFilter(currentTaskId);
    }
    updateEmptyStateCta();

    if (taskId && isHistoryTabActive() && window.historyPanel) {
      window.historyPanel.loadForTask(taskId);
    }

    setStatus('connected', `Agent exited · ${id.slice(0, 8)}…`);
  });

  socket.on('terminal:error', ({ message }) => {
    setStatus('error', message);
    console.error('[Terminal Error]', message);
  });

  // ── UI: new terminal ──

  function openNewTerminal() {
    if (!socket.isConnected()) {
      setStatus('disconnected');
      return;
    }

    // If no task selected, prompt task creation first
    if (!window.taskManager.hasActiveTask()) {
      window.taskModal.open();
      return;
    }

    modalDlg.open();
  }

  document.getElementById('btn-new-terminal').addEventListener('click', openNewTerminal);
  document.getElementById('btn-open-terminal').addEventListener('click', openNewTerminal);

  // "Add Task" button in sidebar
  document.getElementById('btn-add-task').addEventListener('click', () => {
    window.taskModal.open();
  });

  // Collapse sidebar button
  document.getElementById('btn-collapse-sidebar').addEventListener('click', () => {
    const sidebar = document.getElementById('task-sidebar');
    sidebar.classList.toggle('collapsed');
    
    // Fit terminals after collapse/expand animation completes
    setTimeout(() => {
      window.terminalManager.fitActive();
    }, 250);
  });

  // Update empty state CTA when task changes
  window.taskManager._changeListeners.push(() => {
    updateEmptyStateCta();
  });

  // Ctrl+Shift+` shortcut
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'Backquote') {
      e.preventDefault();
      openNewTerminal();
    }
  });

  // ── Resize ──
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => termMgr.fitActive(), 100);
  });

  socket.connect();
}

document.addEventListener('DOMContentLoaded', init);
