/**
 * terminal-manager.js — XTerm.js instance management.
 * Terminals are never destroyed — only hidden/shown.
 */

class TerminalManager {
  constructor() {
    /** @type {Map<string, { record: object, xterm: Terminal, fitAddon: FitAddon }>} */
    this.terminals = new Map();
    this.activeId = null;
    this.splitView = false;
    this.container = document.getElementById('terminal-container');
    this.emptyState = document.getElementById('empty-state');
  }

  /**
   * Create a new xterm instance for a terminal record.
   * @param {object} record - TerminalRecord from server
   * @param {string} [replayBuffer] - Optional buffer to write immediately
   */
  create(record, replayBuffer = '') {
    // Prevent duplicate creation
    if (this.terminals.has(record.id)) {
      console.warn(`[TerminalManager] Terminal ${record.id} already exists, skipping creation`);
      return;
    }

    console.log(`[TerminalManager] Creating terminal ${record.id}${replayBuffer ? ' with buffer' : ''}`);

    const wrapper = document.createElement('div');
    wrapper.className = 'terminal-wrapper';
    wrapper.dataset.id = record.id;
    this.container.appendChild(wrapper);

    // eslint-disable-next-line no-undef
    const xterm = new Terminal({
      theme: {
        background: '#030303',
        foreground: '#00FF41',
        cursor: '#00FF41',
        cursorAccent: '#030303',
        selectionBackground: 'rgba(28, 161, 82, 0.3)',
        black: '#030303',
        red: '#008529',
        green: '#8fb3b3',
        yellow: '#8fb3b3',
        blue: '#4a9a9a',
        magenta: '#009a22',
        cyan: '#6b8e8e',
        white: '#1CA152',
        brightBlack: '#404040',
        brightRed: '#36ba01',
        brightGreen: '#8fb3b3',
        brightYellow: '#8fb3b3',
        brightBlue: '#5db5b5',
        brightMagenta: '#36ba01',
        brightCyan: '#8fb3b3',
        brightWhite: '#1CA152',
      },
      fontFamily: "'Share Tech Mono', 'Cascadia Code', 'JetBrains Mono', monospace",
      fontSize: 14,
      fontWeight: 'bold',
      lineHeight: 1.3,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
    });

    // eslint-disable-next-line no-undef
    const fitAddon = new FitAddon.FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(wrapper);

    // Forward user input to server
    xterm.onData((data) => {
      window.socketManager.emit('terminal:input', { id: record.id, data });
    });

    // In split view, clicking any pane transfers focus to it
    wrapper.addEventListener('mousedown', () => {
      if (this.splitView && this.activeId !== record.id) {
        this.activate(record.id);
        window.tabManager?.setActive(record.id);
      }
    });

    // Replay buffer on restore
    if (replayBuffer) {
      console.log(`[TerminalManager] Writing ${replayBuffer.length} chars to ${record.id}`);
      xterm.write(replayBuffer);
    }

    this.terminals.set(record.id, { record, xterm, fitAddon, wrapper });
    fitAddon.fit();
  }

  /**
   * Write output data to a specific terminal.
   */
  write(id, data) {
    const entry = this.terminals.get(id);
    if (entry) {
      entry.xterm.write(data);
    }
  }

  /**
   * Activate (show) a terminal, deactivate the previous one.
   */
  activate(id) {
    if (this.activeId === id) return;

    // Deactivate current
    if (this.activeId) {
      const prev = this.terminals.get(this.activeId);
      if (prev) {
        prev.wrapper.classList.remove('active');
      }
    }

    const entry = this.terminals.get(id);
    if (!entry) {
      console.warn(`[TerminalManager] Cannot activate terminal ${id} - not found`);
      return;
    }

    entry.wrapper.classList.add('active');
    this.activeId = id;

    // Fit after becoming visible
    requestAnimationFrame(() => {
      entry.fitAddon.fit();
      entry.xterm.focus();
      this._sendResize(id, entry);
    });

    this._updateEmptyState();
    sessionStorage.setItem('activeTerminalId', id);
  }

  /**
   * Remove a terminal (tab closed or agent exited).
   */
  remove(id) {
    const entry = this.terminals.get(id);
    if (!entry) return;

    const wasActive = this.activeId === id;
    const removedTaskId = entry.record.taskId;

    entry.wrapper.remove();
    entry.xterm.dispose();
    this.terminals.delete(id);

    if (wasActive) {
      this.activeId = null;
      
      // Try to auto-focus another terminal from the same task
      const currentTaskId = window.taskManager?.getActive();
      const ids = [...this.terminals.keys()];
      
      if (ids.length > 0 && currentTaskId) {
        // Find a terminal from the same task
        const sameTaskTerminal = ids.find((termId) => {
          const rec = this.getRecord(termId);
          return rec && rec.taskId === currentTaskId;
        });
        
        if (sameTaskTerminal) {
          this.activate(sameTaskTerminal);
        }
      }
    }

    this._updateEmptyState();
  }

  /**
   * Resize a terminal to fit its wrapper.
   */
  fitActive() {
    if (!this.activeId) return;
    const entry = this.terminals.get(this.activeId);
    if (!entry) return;

    const oldCols = entry.xterm.cols;
    const oldRows = entry.xterm.rows;
    
    entry.fitAddon.fit();
    
    // Only send resize if dimensions actually changed
    const newCols = entry.xterm.cols;
    const newRows = entry.xterm.rows;
    
    if (oldCols !== newCols || oldRows !== newRows) {
      console.log(`[TerminalManager] Resizing ${this.activeId} from ${oldCols}x${oldRows} to ${newCols}x${newRows}`);
      
      // Clear the xterm display buffer to prevent visual duplicates
      entry.xterm.clear();
      
      this._sendResize(this.activeId, entry);
    }
  }

  _sendResize(id, entry) {
    window.socketManager.emit('terminal:resize', {
      id,
      cols: entry.xterm.cols,
      rows: entry.xterm.rows,
    });
  }

  _updateEmptyState() {
    if (this.terminals.size === 0) {
      this.emptyState.classList.remove('hidden');
    } else {
      this.emptyState.classList.add('hidden');
    }
  }

  /**
   * Toggle split-screen view showing up to 4 terminals simultaneously.
   * @param {boolean} enabled
   */
  setSplitView(enabled) {
    this.splitView = enabled;
    this.container.classList.toggle('split-view', enabled);

    if (enabled) {
      // Show up to 4 terminals from the active task (or all if no filter)
      const activeTaskId = window.taskManager?.getActive() ?? null;
      const records = this.getAllRecords().filter(
        (r) => !activeTaskId || r.taskId === activeTaskId
      );
      const toShow = records.slice(0, 4);

      this.terminals.forEach(({ wrapper, fitAddon }, id) => {
        const inSet = toShow.some((r) => r.id === id);
        wrapper.classList.toggle('split-visible', inSet);
        if (inSet) {
          requestAnimationFrame(() => {
            fitAddon.fit();
            this._sendResize(id, this.terminals.get(id));
          });
        }
      });
    } else {
      // Revert to single-active mode
      this.terminals.forEach(({ wrapper }) => {
        wrapper.classList.remove('split-visible');
      });
      // Re-activate the current terminal to restore normal display
      if (this.activeId) {
        const id = this.activeId;
        this.activeId = null;
        this.activate(id);
      }
    }
  }

  has(id) {
    return this.terminals.has(id);
  }

  getRecord(id) {
    return this.terminals.get(id)?.record ?? null;
  }

  getAllRecords() {
    return [...this.terminals.values()].map((e) => e.record);
  }
}

window.terminalManager = new TerminalManager();
