# Context-Aware Empty State

## Overview

The empty state in the terminal view dynamically updates based on task presence:
- **When no tasks exist**: Shows "Get started" with "Add a task to organize your terminals" and "Add Task" button
- **When task is active**: Shows "No terminals open" with "Create a terminal to run a shell or agent" and "New Terminal" button

The first task is automatically selected when tasks are loaded from storage.

## Implementation

### Files Modified

1. **playground/frontend/index.html**
   - Added IDs to empty state elements for dynamic updates: `empty-heading`, `empty-sub`

2. **playground/frontend/js/app.js**
   - Enhanced `updateEmptyStateCta()` to update heading, subtext, and button
   - Modified `openNewTerminal()` to check task state
   - Wired task change listeners
   - Added CTA update on terminal events and page load

3. **playground/frontend/js/task-manager.js** 
   - Added `hasActiveTask()` helper method
   - Modified `getActiveOrCreate()` to open task modal when no tasks exist
   - Added change listener notifications in `_doCreate()` and `deleteTask()`
   - Auto-selects first task in `_loadFromStorage()` when tasks exist

### Key Functions

#### `updateEmptyStateCta()`
```javascript
function updateEmptyStateCta() {
  const btn = document.getElementById('btn-open-terminal');
  const heading = document.getElementById('empty-heading');
  const sub = document.getElementById('empty-sub');
  if (!btn) return;

  const hasTask = window.taskManager.hasActiveTask();
  const svg = btn.querySelector('svg');
  
  if (hasTask) {
    // Has task - show terminal creation message
    if (heading) heading.textContent = 'No terminals open';
    if (sub) sub.textContent = 'Create a terminal to run a shell or agent';
    btn.textContent = '';
    if (svg) btn.appendChild(svg);
    btn.appendChild(document.createTextNode(' New Terminal'));
  } else {
    // No task - prompt to add task first
    if (heading) heading.textContent = 'Get started';
    if (sub) sub.textContent = 'Add a task to organize your terminals';
    btn.textContent = '';
    if (svg) btn.appendChild(svg);
    btn.appendChild(document.createTextNode(' Add Task'));
  }
}
```

Updates the empty-state heading, subtext, and button based on task presence.

#### Modified `openNewTerminal()`
```javascript
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
```

Routes to task modal or terminal modal based on task state.

### Update Triggers

The empty state updates when:

1. **Task changes** (via change listener)
   ```javascript
   window.taskManager._changeListeners.push(() => {
     updateEmptyStateCta();
   });
   ```

2. **Task created** (in `_doCreate()`)
3. **Task deleted** (in `deleteTask()`)
4. **Terminal created** (in `socket.on('terminal:created')`)
5. **Terminal removed** (in `socket.on('terminal:agent_exit')`)
6. **Page load** (in `restoreTerminals()`)

### Auto-Select First Task

When tasks are loaded from storage, the first task is automatically selected if no active task is set:

```javascript
_loadFromStorage() {
  // ...load tasks from localStorage...
  
  // Auto-select first task if any exist
  if (this._tasks.length > 0 && !this.activeTaskId) {
    this.activeTaskId = this._tasks[0].id;
  }
  this._updateActiveTaskDisplay();
}
```

### User Flow

#### No Task Scenario
1. User sees empty state with:
   - Heading: "Get started"
   - Subtext: "Add a task to organize your terminals"
   - Button: "Add Task"
2. Clicking button opens task modal
3. After creating task:
   - Task is automatically selected
   - Empty state updates to show terminal creation message
   - Button changes to "New Terminal"

#### Active Task Scenario
1. User sees empty state with:
   - Heading: "No terminals open"
   - Subtext: "Create a terminal to run a shell or agent"
   - Button: "New Terminal"
2. Clicking button opens terminal creation modal
3. Terminal created in the context of active task

## Benefits

- **Guided workflow**: Users are prompted to create tasks before terminals
- **Context-aware**: Empty state adapts to current application state with appropriate messaging
- **Reduces confusion**: Clear next action at every step
- **Consistent with task-first design**: Reinforces that terminals belong to tasks
- **Automatic task selection**: First task is automatically selected on page load
- **Real-time updates**: Empty state updates immediately when tasks are added/removed
- **User-friendly messaging**: Different headings and descriptions for different states

## Testing

To test the implementation:

1. **No task state**: Clear localStorage, reload page → should show "Get started" heading and "Add Task" button
2. **Auto-select**: Create a task, reload page → task should be automatically selected
3. **Create task**: Click "Add Task" → task modal opens → create task → empty state updates to "No terminals open" with "New Terminal" button
4. **Create terminal**: Click "New Terminal" → terminal modal opens
5. **Task switch**: Change active task → empty state remains "No terminals open" with "New Terminal" button
6. **Delete last task**: Delete the last task → empty state reverts to "Get started" with "Add Task" button
7. **View updates**: Add/remove tasks → empty state updates immediately without page reload

## Related Files

- `playground/frontend/index.html` - Empty state HTML structure
- `playground/frontend/js/task-manager.js` - Task state helpers
- `playground/frontend/js/task-modal.js` - Task creation modal
- `playground/frontend/js/modal.js` - Terminal creation modal
