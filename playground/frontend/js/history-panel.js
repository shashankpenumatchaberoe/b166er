/**
 * history-panel.js — History log for the active task.
 * Renders into #history-list; shown/hidden via view tabs (not a toggle panel).
 */

class HistoryPanel {
  constructor() {
    this.list = document.getElementById('history-list');
    this._currentTaskId = null;
    this._activeInlineEditor = null;
    this._cachedHistory = null;
    this._setupRealtimeUpdates();
  }

  /**
   * Setup real-time history updates via socket.io
   */
  _setupRealtimeUpdates() {
    if (window.socketManager) {
      window.socketManager.on('history:updated', (data) => {
        // Only update if this is for the currently viewed task
        if (data.taskId === this._currentTaskId && this._cachedHistory) {
          this._addEntryLive(data.entry);
        }
      });
    } else {
      console.warn('[HistoryPanel] socketManager not available yet, will retry on first load');
    }
  }

  /**
   * Load and render history for a given task.
   */
  async loadForTask(taskId) {
    this._currentTaskId = taskId;
    this._cachedHistory = null;

    if (!taskId) {
      this.renderEmpty('Select a task to view its history.');
      return;
    }

    this.list.innerHTML = '<div class="history-loading">Loading…</div>';

    try {
      const res = await fetch(`/history/${encodeURIComponent(taskId)}`);
      
      if (res.status === 404) {
        this.renderEmpty('No history yet for this task.');
        this._cachedHistory = { conversations: [] };
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const history = await res.json();
      
      this._cachedHistory = history;
      this._render(history);
    } catch (err) {
      console.error('[HistoryPanel] Error loading history:', err);
      this.renderEmpty(`Failed to load history: ${err.message}`);
    }
  }

  renderEmpty(msg) {
    const isTaskNotSelected = msg === 'Select a task to view its history.';
    const isNoHistory = msg === 'No history yet for this task.';
    
    if (isTaskNotSelected || isNoHistory) {
      this.list.innerHTML = `
        <div class="history-empty">
          <img src="icons8-oracle-48.png" alt="" class="history-oracle-icon" />
          <div id="history-empty-text" class="history-empty-text typing"></div>
          <div id="history-empty-subtext" class="history-empty-subtext typing"></div>
        </div>
      `;
      // Add typing effect
      setTimeout(() => {
        const textEl = document.getElementById('history-empty-text');
        if (textEl && window.typeText) {
          if (isNoHistory) {
            // For no history, type first line then second line
            window.typeText(textEl, msg, 60, () => {
              const subtext = document.getElementById('history-empty-subtext');
              if (subtext) {
                subtext.textContent = '';
                window.typeText(subtext, 'Everything That Has A Beginning Has An End.', 50);
              }
            });
          } else {
            // For task not selected, type first line then second line
            window.typeText(textEl, msg, 60, () => {
              const subtext = document.getElementById('history-empty-subtext');
              if (subtext) {
                subtext.textContent = '';
                window.typeText(subtext, 'We Can Never See Past The Choices We Don\'t Understand.', 50);
              }
            });
          }
        }
      }, 800);
    } else {
      this.list.innerHTML = `<div class="history-empty">${msg}</div>`;
    }
  }

  /**
   * Strip ANSI escape sequences from terminal output
   */
  _stripAnsi(text) {
    if (!text) return text;
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')  // CSI sequences
               .replace(/\x1b\].*?\x07/g, '')           // OSC sequences
               .replace(/\x1b[=>]/g, '')                // Other escape sequences
               .replace(/\x1b\[[\?0-9;]*[hlm]/g, '');   // Private mode sequences
  }

  // ── Private ───────────────────────────────────────────────────────────────

  _render(history) {
    if (!history?.conversations?.length) {
      this.renderEmpty('No completed conversations yet.');
      return;
    }

    // If there was an empty state message, clear it first
    const emptyState = this.list.querySelector('.history-empty');
    if (emptyState) {
      this.list.innerHTML = '';
    }

    // Store the current scroll position
    const scrollParent = this.list.parentElement;
    const wasScrolledToBottom = scrollParent && 
      (scrollParent.scrollHeight - scrollParent.scrollTop - scrollParent.clientHeight < 50);

    this.list.innerHTML = '';
    const entries = [...history.conversations].reverse(); // newest first

    const totalEntries = history.conversations.length;

    entries.forEach((entry, renderedIndex) => {
      const originalIndex = totalEntries - 1 - renderedIndex;
      this._renderEntry(entry, originalIndex, history, false);
    });

    // Restore scroll position or scroll to bottom if was at bottom
    if (wasScrolledToBottom && scrollParent) {
      scrollParent.scrollTop = scrollParent.scrollHeight;
    }
  }

  /**
   * Add a new entry live (real-time update)
   */
  _addEntryLive(entry) {
    // If we're showing empty state, clear it and initialize
    const emptyState = this.list.querySelector('.history-empty, .history-loading');
    if (emptyState) {
      this.list.innerHTML = '';
      if (!this._cachedHistory) {
        this._cachedHistory = { conversations: [] };
      }
    }

    // Add to cache
    if (this._cachedHistory) {
      this._cachedHistory.conversations.push(entry);
    }

    // Render the new entry at the top (newest first)
    const newIndex = this._cachedHistory ? this._cachedHistory.conversations.length - 1 : 0;
    const card = this._renderEntry(entry, newIndex, this._cachedHistory || { taskId: entry.taskId }, true);

    // Add animation and insert at top
    card.classList.add('history-entry-new');
    this.list.insertBefore(card, this.list.firstChild);

    // Scroll to top to show new entry
    const scrollParent = this.list.parentElement;
    if (scrollParent) {
      scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Remove animation class after animation completes
    setTimeout(() => {
      card.classList.remove('history-entry-new');
    }, 500);
  }

  /**
   * Render a single history entry
   */
  _renderEntry(entry, originalIndex, history, isLive = false) {
      const card = document.createElement('div');
      card.className = 'history-entry';

      const header = document.createElement('div');
      header.className = 'history-entry-header';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'history-entry-name';
      nameSpan.textContent = entry.terminalName || entry.terminalId || 'unknown-terminal';

      const tags = document.createElement('div');
      tags.className = 'history-entry-tags';

      const taskTag = document.createElement('span');
      taskTag.className = 'history-entry-tag';
      taskTag.textContent = `task:${entry.taskId || history.taskId || 'unknown'}`;
      tags.appendChild(taskTag);

      // Display custom agent name if this is a task tool invocation
      let displayAgentName = entry.agentName;
      if (entry.eventType === 'post_tool_use' && 
          entry.metadata?.toolName === 'task' && 
          entry.metadata?.toolArgs?.agent_type) {
        displayAgentName = entry.metadata.toolArgs.agent_type;
      }

      if (displayAgentName) {
        const agentTag = document.createElement('span');
        agentTag.className = 'history-entry-tag';
        agentTag.textContent = `agent:${displayAgentName}`;
        tags.appendChild(agentTag);
      }

      if (entry.role) {
        const roleTag = document.createElement('span');
        roleTag.className = 'history-entry-tag';
        roleTag.textContent = `role:${entry.role}`;
        tags.appendChild(roleTag);
      }

      const timeSpan = document.createElement('span');
      timeSpan.className = 'history-entry-time';
      timeSpan.textContent = this._formatTime(entry.timestamp || entry.endedAt);

      // Collapse button
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'history-entry-collapse-btn';
      collapseBtn.title = 'Collapse entry';
      collapseBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M9 4L6 7L3 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = card.classList.toggle('collapsed');
        collapseBtn.title = isCollapsed ? 'Expand entry' : 'Collapse entry';
        collapseBtn.innerHTML = isCollapsed 
          ? `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
               <path d="M4 9L7 6L4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>`
          : `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
               <path d="M9 4L6 7L3 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>`;
      });

      header.appendChild(nameSpan);
      header.appendChild(timeSpan);
      header.appendChild(collapseBtn);

      const meta = document.createElement('div');
      meta.className = 'history-entry-meta';
      meta.appendChild(tags);

      const actions = document.createElement('div');
      actions.className = 'history-entry-actions';

      const btnEdit = this._createActionButton('Edit', async () => {
        this._openInlineEditor({
          card,
          messageElement: message,
          taskId: history.taskId,
          index: originalIndex,
          currentMessage: this._stripAnsi(entry.message || entry.finalMessage || ''),
        });
      });

      const btnDelete = this._createActionButton('Delete', async () => {
        this._openInlineDeleteConfirm({
          actionsContainer: actions,
          taskId: history.taskId,
          index: originalIndex,
        });
      });

      const btnCopy = this._createActionButton('Copy', async () => {
        const role = entry.role ? `[${entry.role}] ` : '';
        const cleanMessage = this._stripAnsi((entry.message || entry.finalMessage || '').trim());
        await this._copyText(`${role}${cleanMessage}`);
      });

      const btnCopyUntil = this._createActionButton('Copy till this step', async () => {
        const partial = history.conversations.slice(0, originalIndex + 1);
        const serialized = partial
          .map((item) => {
            const role = item.role ? `[${item.role}]` : '[entry]';
            const terminal = item.terminalName || item.terminalId || 'unknown-terminal';
            const cleanMessage = this._stripAnsi((item.message || item.finalMessage || '').trim());
            return `${role} ${terminal}: ${cleanMessage}`;
          })
          .join('\n\n');

        await this._copyText(serialized);
      });

      // Add "View Raw" button for assistant messages with tool results
      if (entry.eventType === 'post_tool_use' && entry.metadata?.toolResult?.textResultForLlm) {
        const btnViewRaw = this._createActionButton('View Raw', () => {
          this._toggleRawView(card, entry);
        });
        actions.appendChild(btnViewRaw);
      }

      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);
      actions.appendChild(btnCopy);
      actions.appendChild(btnCopyUntil);
      meta.appendChild(actions);

      // Create message container with formatted and raw views
      const messageContainer = document.createElement('div');
      messageContainer.className = 'history-entry-message-container';

      // Formatted view
      const formattedMessage = document.createElement('div');
      formattedMessage.className = 'history-entry-message formatted-view';
      formattedMessage.style.display = 'block';
      
      // Raw view
      const rawMessage = document.createElement('pre');
      rawMessage.className = 'history-entry-message raw-view';
      rawMessage.style.display = 'none';
      const rawMessageText = (entry.message || entry.finalMessage || '').trim() || '(empty)';
      rawMessage.textContent = this._stripAnsi(rawMessageText);

      // Format the message based on event type
      if (entry.eventType === 'post_tool_use' && entry.metadata?.toolResult?.textResultForLlm) {
        // Extract and format tool result
        const toolName = entry.metadata.toolName || 'unknown';
        const resultText = entry.metadata.toolResult.textResultForLlm;
        
        // For task tool, show as "Subagent: {agent_type}"
        let headerText = `Tool: ${toolName}`;
        if (toolName === 'task' && entry.metadata?.toolArgs?.agent_type) {
          headerText = `Subagent: ${entry.metadata.toolArgs.agent_type}`;
        }
        
        const toolHeader = document.createElement('div');
        toolHeader.className = 'tool-result-header';
        toolHeader.textContent = headerText;
        
        formattedMessage.appendChild(toolHeader);
        
        // For subagent invocations, show both prompt and response
        if (toolName === 'task' && entry.metadata?.toolArgs?.agent_type) {
          const promptSection = document.createElement('div');
          promptSection.className = 'subagent-prompt-section';
          
          const promptLabel = document.createElement('div');
          promptLabel.className = 'subagent-section-label';
          promptLabel.textContent = '📝 Prompt:';
          
          const promptContent = document.createElement('pre');
          promptContent.className = 'tool-result-content subagent-prompt';
          promptContent.textContent = this._stripAnsi(entry.metadata.toolArgs.prompt || '(no prompt)');
          
          promptSection.appendChild(promptLabel);
          promptSection.appendChild(promptContent);
          formattedMessage.appendChild(promptSection);
          
          const responseSection = document.createElement('div');
          responseSection.className = 'subagent-response-section';
          
          const responseLabel = document.createElement('div');
          responseLabel.className = 'subagent-section-label';
          responseLabel.textContent = '💬 Response:';
          
          const responseContent = document.createElement('pre');
          responseContent.className = 'tool-result-content subagent-response';
          responseContent.textContent = this._stripAnsi(resultText);
          
          responseSection.appendChild(responseLabel);
          responseSection.appendChild(responseContent);
          formattedMessage.appendChild(responseSection);
        } else {
          // For non-subagent tools, just show the result
          const resultContent = document.createElement('pre');
          resultContent.className = 'tool-result-content';
          resultContent.textContent = this._stripAnsi(resultText);
          formattedMessage.appendChild(resultContent);
        }
      } else {
        // Regular message display
        const msgPre = document.createElement('pre');
        msgPre.textContent = this._stripAnsi(rawMessageText);
        formattedMessage.appendChild(msgPre);
      }

      messageContainer.appendChild(formattedMessage);
      messageContainer.appendChild(rawMessage);

      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(messageContainer);
      
      if (!isLive) {
        this.list.appendChild(card);
      }
      
      return card;
  }

  // ── Action Handlers ───────────────────────────────────────────────────────

  _createActionButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-entry-action-btn';
    button.textContent = label;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      onClick();
    });

    return button;
  }

  _toggleRawView(card, entry) {
    const container = card.querySelector('.history-entry-message-container');
    const formattedView = container.querySelector('.formatted-view');
    const rawView = container.querySelector('.raw-view');
    const button = Array.from(card.querySelectorAll('.history-entry-action-btn'))
      .find(btn => btn.textContent === 'View Raw' || btn.textContent === 'View Formatted');
    
    if (formattedView.style.display === 'none') {
      // Switch to formatted view
      formattedView.style.display = 'block';
      rawView.style.display = 'none';
      button.textContent = 'View Raw';
    } else {
      // Switch to raw view
      formattedView.style.display = 'none';
      rawView.style.display = 'block';
      button.textContent = 'View Formatted';
    }
  }

  _openInlineEditor({ card, messageElement, taskId, index, currentMessage }) {
    this._closeInlineEditor();

    const editorContainer = document.createElement('div');
    editorContainer.className = 'history-inline-editor';

    const textArea = document.createElement('textarea');
    textArea.className = 'history-inline-textarea';
    textArea.value = currentMessage;

    const controls = document.createElement('div');
    controls.className = 'history-inline-controls';

    const btnSave = this._createActionButton('Save', async () => {
      const nextMessage = textArea.value.trim();
      if (!nextMessage) {
        window.alert('Message cannot be empty.');
        return;
      }

      const response = await fetch(`/history/${encodeURIComponent(taskId)}/${index}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: nextMessage }),
      });

      if (!response.ok) {
        window.alert(`Failed to edit entry (HTTP ${response.status}).`);
        return;
      }

      this._closeInlineEditor();
      await this.loadForTask(taskId);
    });

    const btnCancel = this._createActionButton('Cancel', () => {
      this._closeInlineEditor();
    });

    btnSave.classList.add('history-entry-action-btn--primary');

    controls.appendChild(btnSave);
    controls.appendChild(btnCancel);
    editorContainer.appendChild(textArea);
    editorContainer.appendChild(controls);

    messageElement.style.display = 'none';
    card.appendChild(editorContainer);

    this._activeInlineEditor = {
      card,
      editorContainer,
      messageElement,
    };

    textArea.focus();
    textArea.setSelectionRange(textArea.value.length, textArea.value.length);
  }

  _closeInlineEditor() {
    if (!this._activeInlineEditor) {
      return;
    }

    const { editorContainer, messageElement } = this._activeInlineEditor;
    editorContainer.remove();
    messageElement.style.display = '';
    this._activeInlineEditor = null;
  }

  _openInlineDeleteConfirm({ actionsContainer, taskId, index }) {
    if (actionsContainer.dataset.deletePending === 'true') {
      return;
    }

    actionsContainer.dataset.deletePending = 'true';

    const deleteButton = [...actionsContainer.querySelectorAll('.history-entry-action-btn')]
      .find((button) => button.textContent === 'Delete');

    if (!deleteButton) {
      actionsContainer.dataset.deletePending = 'false';
      return;
    }

    const originalLabel = deleteButton.textContent;
    deleteButton.textContent = 'Confirm';
    deleteButton.classList.add('history-entry-action-btn--danger');

    const cancelButton = this._createActionButton('Cancel', () => {
      deleteButton.textContent = originalLabel;
      deleteButton.classList.remove('history-entry-action-btn--danger');
      actionsContainer.dataset.deletePending = 'false';
      cancelButton.remove();
    });
    cancelButton.classList.add('history-entry-action-btn--subtle');
    actionsContainer.appendChild(cancelButton);

    const confirmHandler = async (event) => {
      event.preventDefault();
      await this._deleteEntry(taskId, index);
    };

    deleteButton.addEventListener('click', confirmHandler, { once: true });
  }

  async _deleteEntry(taskId, index) {
    const response = await fetch(`/history/${encodeURIComponent(taskId)}/${index}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      window.alert(`Failed to delete entry (HTTP ${response.status}).`);
      return;
    }

    await this.loadForTask(taskId);
  }

  async _copyText(text) {
    const value = (text || '').trim();
    if (!value) {
      window.alert('Nothing to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  _formatTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  }

}

try {
  window.historyPanel = new HistoryPanel();
} catch (err) {
  console.error('[HistoryPanel] Failed to create instance:', err);
}
