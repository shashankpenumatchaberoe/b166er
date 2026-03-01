/**
 * prompt-composer.js — Standalone prompt composition tool.
 * Allows users to compose and edit prompts with character/word count and clipboard copy.
 */

class PromptComposer {
  constructor() {
    this.overlay = document.getElementById('modal-prompt-overlay');
    this.textarea = document.getElementById('input-prompt-text');
    this.charCount = document.getElementById('prompt-char-count');
    this.wordCount = document.getElementById('prompt-word-count');
    this.btnCopy = document.getElementById('btn-prompt-copy');
    this.btnClear = document.getElementById('btn-prompt-clear');
    this.btnCancel = document.getElementById('btn-prompt-cancel');
    this.floatingBtn = document.getElementById('btn-prompt-composer');
    this.taskContextEl = document.getElementById('prompt-task-context');
    this.taskInfoEl = document.getElementById('prompt-task-info');
    this.digitalRain = null;

    // Restore saved prompt from localStorage
    this._restorePrompt();

    // Event listeners
    this.floatingBtn.addEventListener('click', () => this.open());
    this.btnCopy.addEventListener('click', () => this._handleCopy());
    this.btnClear.addEventListener('click', () => this._handleClear());
    this.btnCancel.addEventListener('click', () => this.close());
    
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Update stats on input
    this.textarea.addEventListener('input', () => {
      this._updateStats();
      this._savePrompt();
    });

    // Keyboard shortcuts
    this.textarea.addEventListener('keydown', (e) => {
      // Ctrl+Enter to copy and close
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this._handleCopy();
      }
    });

    document.addEventListener('keydown', (e) => {
      // Escape to close
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) {
        this.close();
      }
      // Ctrl+P to open (when not in input/textarea)
      if (e.ctrlKey && e.key === 'p' && 
          !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        this.open();
      }
    });
  }

  open() {
    this.overlay.classList.remove('hidden');
    this._updateStats();
    this._updateTaskContext();
    
    // Initialize digital rain effect
    if (!this.digitalRain) {
      // eslint-disable-next-line no-undef
      this.digitalRain = new DigitalRain(this.overlay);
    }
    
    setTimeout(() => {
      this.textarea.focus();
      // Move cursor to end
      this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length);
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

  async _handleCopy() {
    const text = this.textarea.value.trim();
    
    if (!text) {
      this._showCopyFeedback('Nothing to copy', false);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this._showCopyFeedback('Copied to clipboard!', true);
      setTimeout(() => this.close(), 500);
    } catch (err) {
      console.error('Failed to copy:', err);
      this._showCopyFeedback('Copy failed', false);
    }
  }

  _handleClear() {
    if (this.textarea.value.trim() && !confirm('Clear all text?')) {
      return;
    }
    this.textarea.value = '';
    this._updateStats();
    this._savePrompt();
    this.textarea.focus();
  }

  _updateStats() {
    const text = this.textarea.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    this.charCount.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
    this.wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
  }

  _showCopyFeedback(message, success) {
    const originalText = this.btnCopy.innerHTML;
    const icon = success 
      ? '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 3l5 5M8 3l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    
    this.btnCopy.innerHTML = `${icon} ${message}`;
    this.btnCopy.disabled = true;
    
    setTimeout(() => {
      this.btnCopy.innerHTML = originalText;
      this.btnCopy.disabled = false;
    }, 1500);
  }

  _savePrompt() {
    try {
      localStorage.setItem('prompt-composer-text', this.textarea.value);
    } catch (err) {
      console.warn('Failed to save prompt to localStorage:', err);
    }
  }

  _restorePrompt() {
    try {
      const saved = localStorage.getItem('prompt-composer-text');
      if (saved) {
        this.textarea.value = saved;
      }
    } catch (err) {
      console.warn('Failed to restore prompt from localStorage:', err);
    }
  }

  _updateTaskContext() {
    if (!window.taskManager) {
      this.taskContextEl.classList.add('hidden');
      return;
    }

    const activeTaskId = window.taskManager.getActive();
    
    if (!activeTaskId) {
      this.taskContextEl.classList.add('hidden');
      return;
    }

    const task = window.taskManager._tasks.find(t => t.id === activeTaskId);
    
    if (!task) {
      this.taskContextEl.classList.add('hidden');
      return;
    }

    // Show context
    this.taskContextEl.classList.remove('hidden');

    if (task.workflowFilename) {
      this.taskInfoEl.innerHTML = `
        <span class="task-context-label">Task:</span>
        <span class="task-context-value">${task.name || task.id}</span>
        <span class="task-context-separator">|</span>
        <span class="task-context-label">Workflow:</span>
        <span class="task-context-value">${task.workflowFilename.replace('.md', '')}</span>
      `;
    } else {
      this.taskInfoEl.innerHTML = `
        <span class="task-context-label">Task:</span>
        <span class="task-context-value">${task.name || task.id}</span>
        <span class="task-context-separator">|</span>
        <span class="task-context-warning">⚠️ No workflow</span>
      `;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.promptComposer = new PromptComposer();
  });
} else {
  window.promptComposer = new PromptComposer();
}
