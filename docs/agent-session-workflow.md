# Agent Session & Workflow Requirements

This document explains how task ID prompting and workflow validation work in the MAX AI UI system for both CLI and VSCode Copilot agents.

## Overview

As of this refactor, **all agent sessions require a task with an attached workflow**. This ensures:

- Consistent agent behavior through defined workflow chains
- Proper history tracking per task
- Clear agent handoff protocols
- Better organization of multi-agent collaborations

## Key Concepts

### Task → Workflow Mapping

Every task can have **one workflow** attached to it:

```json
{
  "id": "my-feature-1234567890",
  "name": "My Feature",
  "workflowFilename": "feature_development.md",
  "createdAt": "2026-03-01T12:00:00Z",
  "updatedAt": "2026-03-01T12:00:00Z"
}
```

The workflow defines:
- Which agents are available
- Agent handoff chain
- Responsibilities of each agent
- Exit criteria

### History per Task

All conversation entries are stored in JSON files named by task ID:

```
playground/backend/data/
  my-feature-1234567890.json  ← History for this task
  another-task-9876543210.json
```

Each history entry includes:
- User prompts
- Agent responses
- Tool executions
- Timestamps
- Metadata

---

## CLI Agent Workflow

### 1. Session Start

When you run a Copilot CLI command (e.g., `gh copilot suggest "help me"`):

1. **Hook fires**: `log-session-start.ps1` is triggered
2. **Session manager called**: Queries backend for terminal→task mapping
3. **Mapping check**:
   - If mapping exists and valid → session proceeds
   - If no mapping → **user is prompted**

### 2. Task ID Prompt

If no valid mapping exists, you'll see:

```
📋 Task ID Required
This Copilot session needs to be associated with a task that has a workflow.

Available tasks with workflows:
  • feature-dev-1234 - Feature Development [feature_dev]
  • bugfix-5678 - Bug Fix [bugfix_workflow]
  ... and 3 more

Enter task ID: _
```

### 3. Validation

The system validates your input in 3 steps:

1. **Task exists**: Checks `/tasks/{taskId}` endpoint
2. **Has workflow**: Verifies `task.workflowFilename` is not empty
3. **Workflow valid**: Confirms workflow file exists

### 4. Retry Logic

- You get **3 attempts** to provide a valid task ID
- Each failed attempt shows specific error:
  - `❌ Task 'xyz' not found`
  - `❌ Task 'xyz' has no workflow attached`
  - `❌ Workflow 'abc.md' not found`

### 5. Success or Exit

**On success:**
```
✓ Task: feature-dev-1234
✓ Workflow: feature_development

🚀 Session Started
```

**On failure (after 3 attempts):**
```
❌ Failed to obtain valid task ID after 3 attempts. Session cannot proceed.
```

The Copilot session exits immediately.

---

## VSCode Agent Workflow

### 1. Initial Check

When starting a Copilot chat in VSCode:

1. Extension calls `POST /session/{sessionId}/initialize`
2. Backend checks for existing session→task mapping
3. Response options:
   - **Ready**: Session already mapped to valid task+workflow
   - **Task Required**: User needs to select a task

### 2. Task Selection UI

If task selection is needed, VSCode extension should show:

```
Select a task with workflow:
┌──────────────────────────────────────────┐
│ ● feature-dev-1234                       │
│   Feature Development [feature_dev]      │
│                                          │
│ ● bugfix-5678                            │
│   Bug Fix [bugfix_workflow]              │
└──────────────────────────────────────────┘
```

Only tasks WITH workflows are shown.

### 3. Mapping

Once user selects a task:

1. Extension calls `POST /session/{sessionId}/map` with `taskId`
2. Backend validates task+workflow
3. Mapping stored for future chats in this session

### 4. Pending Task Mechanism

Alternative flow - set a "pending task" that auto-maps the next new session:

```typescript
// Set pending task
POST /pending-task
{ "taskId": "feature-dev-1234" }

// Next Copilot session automatically uses this task
// Then pending task is cleared
```

---

## How to Use

### Creating a Task with Workflow

**Via UI:**

1. Click **+** in task sidebar
2. Enter task name
3. Select workflow from dropdown
4. Create task

**Via API:**

```bash
curl -X POST http://localhost:3001/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Feature",
    "workflowFilename": "feature_development.md"
  }'
```

### Assigning Workflow to Existing Task

**Via UI:**

1. Find task in sidebar
2. Use workflow dropdown
3. Select workflow

**Via API:**

```bash
curl -X PATCH http://localhost:3001/tasks/my-task-123/workflow \
  -H "Content-Type: application/json" \
  -d '{"workflowFilename": "feature_development.md"}'
```

### Checking Task Status

```bash
# List all tasks with workflow status
curl http://localhost:3001/tasks

# Response includes:
{
  "id": "task-123",
  "name": "My Task",
  "workflowFilename": "my_workflow.md",
  "hasWorkflow": true,      # ← Added by API
  "workflowValid": true,    # ← Verified workflow exists
  ...
}
```

---

## Troubleshooting

### "Task not found"

**Cause**: Task ID doesn't exist

**Fix**: 
- Check available tasks: `curl http://localhost:3001/tasks`
- Create task in UI or via API

### "Task has no workflow attached"

**Cause**: Task exists but `workflowFilename` is null

**Fix**:
- Assign workflow in UI dropdown
- Or use API: `PATCH /tasks/{id}/workflow`

### "Workflow not found"

**Cause**: Task references workflow file that doesn't exist

**Fix**:
- List workflows: `curl http://localhost:3001/workflows`
- Create workflow in UI
- Or update task to use existing workflow

### Session keeps prompting for task

**Cause**: Terminal mapping not persisted

**Fix**:
- Check `.copilot-terminals.json` file exists
- Ensure backend has write permissions
- Verify backend is running: `curl http://localhost:3001/tasks`

### UI shows ⚠️ warning on task

**Meaning**: Task has no workflow

**Impact**: Cannot create agents for this task

**Fix**: Assign a workflow via dropdown

---

## Architecture

### Terminal → Task Mapping

**CLI Terminals**: Stored in `.copilot-terminals.json`

```json
{
  "version": "1.0",
  "mappings": {
    "terminal-uuid-123": {
      "taskId": "feature-dev-1234",
      "terminalName": "copilot-cli",
      "createdAt": "2026-03-01T12:00:00Z",
      "lastUsed": "2026-03-01T12:05:00Z"
    }
  }
}
```

**VSCode Sessions**: Stored in `data/.session-tasks.json`

```json
{
  "sessions": {
    "vscode-session-uuid": "feature-dev-1234"
  },
  "pendingTaskId": null
}
```

### API Endpoints

#### Session Management (VSCode)

```
POST   /session/:sessionId/initialize
       → Check/prompt for task

POST   /session/:sessionId/map
       → Map session to task

GET    /session/:sessionId/task
       → Get current mapping

POST   /pending-task
       → Set auto-map for next session
```

#### Terminal Management (CLI)

```
GET    /copilot/terminal/:terminalId/task
       → Get task for terminal

POST   /copilot/terminal/:terminalId/task
       → Register terminal→task mapping (with validation)

DELETE /copilot/terminal/:terminalId/task
       → Remove mapping
```

#### Task Management

```
GET    /tasks
       → List tasks (with hasWorkflow, workflowValid)

GET    /tasks/:id
       → Get task details

PATCH  /tasks/:id/workflow
       → Update workflow assignment
```

### Validation Middleware

The `requireTaskWorkflow` middleware enforces workflow requirements on critical endpoints:

- `/copilot/event` - All Copilot events must have valid task+workflow
- `/copilot/terminal/:id/task` (POST) - Terminal registration validates task+workflow

Returns **422 Unprocessable Entity** if validation fails.

---

## Best Practices

### For Users

1. **Create workflow first**, then assign to tasks
2. **Always assign workflows** - required for agent usage
3. **Use descriptive task names** for easy CLI selection
4. **Review workflow chain** before starting multi-agent work

### For Developers

1. **Handle 422 errors gracefully** - show clear messages to users
2. **Cache task list** in CLI tools - reduces API calls during prompting
3. **Validate early** - check task+workflow before spawning agents
4. **Use pending task** for better UX in automation scripts

---

## Migration Notes

### Existing Tasks Without Workflows

After this refactor, existing tasks without workflows will show warnings in the UI:

- ⚠️ icon next to task name
- Warning message below workflow dropdown
- Cannot create new agents until workflow assigned

**Action Required**: Assign workflows to all active tasks.

### Existing Terminal Mappings

Old mappings in `.copilot-terminals.json` will be validated on first use:

- Valid task+workflow → continues working
- Invalid → user prompted to re-select task

### History Files

No migration needed - history files remain unchanged. They will continue to work with the new validation.

---

## Security Considerations

- Task IDs are **sanitized** before being used as filenames
- Workflow filenames are **validated** against directory traversal
- Terminal mappings **auto-expire** after 7 days of inactivity
- Session mappings are **scoped per VSCode instance**

---

## Future Enhancements

Planned improvements:

- [ ] Task templates with pre-assigned workflows
- [ ] Workflow validation at runtime (enforce handoff rules)
- [ ] Agent suggestion based on workflow step
- [ ] Workflow progress tracking/visualization
- [ ] Multi-workflow support per task (workflow chains)
- [ ] Workflow version control

---

## Support

For issues or questions:

1. Check logs: `logs/copilot-sessions/session-manager.log`
2. Verify backend: `curl http://localhost:3001/tasks`
3. Check data files: `.copilot-terminals.json`, `data/.session-tasks.json`
4. Review workflow files: `.playground/workflows/*.md`

---

**Last Updated**: March 1, 2026  
**Refactor Version**: 2.0
