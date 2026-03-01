---
name: task-management
description: Silently checks for task ID + workflow at the START of every conversation. Only asks user if missing or invalid. When valid, proceeds silently without bothering the user. This ensures all sessions have proper task tracking for workflows, logging, and agent coordination.
---

# Task Management Skill

## Overview

Every Copilot session in this workspace MUST be associated with a task ID. This enables:
- Workflow tracking and orchestration
- Session logging and audit trails
- Agent coordination and context sharing

## When to Use

**ALWAYS** at the start of EVERY conversation:
1. Check if task ID exists for current session AND has a workflow
2. ONLY if missing or invalid, ask user which task they're working on
3. Register the task ID via API if needed

## Step-by-Step Process

### Step 1: Check Current Task ID and Workflow

First, check if this session already has a valid task ID with workflow by calling the session manager:

```powershell
& scripts/copilot-hooks/session-manager.ps1 -NonInteractive
```

**If successful AND returns both taskId AND workflowFilename:**
- ✓ Task is already set up correctly
- **DO NOT ask user anything**
- **Silently proceed** with the conversation
- (Optional: Display task info in first tool execution banner)

**If 404 error OR missing taskId OR missing workflowFilename:**
- Proceed to Step 2 (ask user for task)

### Step 2: Get Available Tasks (if no task ID)

If no task ID exists, fetch available tasks:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/tasks" | Where-Object { $_.workflowFilename } | Format-Table id, name, workflowFilename -AutoSize
```

### Step 3: Ask User for Task ID

Present the available tasks and ask the user:

**Exact phrasing to use:**
"I need to know which task you're working on. Here are the available tasks:

[Display tasks from Step 2]

Which task ID would you like to use for this session? 

Alternatively, you can:
- Create a new task via the UI
- Run: `pwsh -File scripts/setup-task.ps1` for interactive setup"

### Step 4: Register Task ID

Once user provides a task ID (e.g., "mapping-test-1772335767041"), ask them to register it by running:

```powershell
pwsh -File scripts/setup-task.ps1
```

Or they can use the backend API directly if they know their session ID.

### Step 5: Confirm Registration

After successful registration, confirm to user:
- "✓ Session registered to task: [TASK_ID]"
- "✓ Workflow: [WORKFLOW_FILENAME]"
- "You can now proceed with your work."

## Error Handling

### Backend Not Running
If API calls fail with connection errors:
- "The backend API is not running. Please start it with: `npm run dev` from the playground/backend directory"

### Invalid Task ID
If user provides invalid task ID:
- "Task '[ID]' not found. Please choose from the available tasks above."

### Task Without Workflow
If task has no workflow:
- "Task '[ID]' doesn't have a workflow attached. Tasks require workflows. Please select a different task or attach a workflow to this task."

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/session/:sessionId/task` | GET | Check if session has task mapping |
| `/session/:sessionId/task` | POST | Register task for session |
| `/tasks` | GET | Get all available tasks |
| `/tasks/:taskId` | GET | Get specific task details |
| `/workflows/:filename` | GET | Get workflow details |

## Important Notes

1. **Silent When Valid**: If task+workflow already exist, proceed silently without notifying user
2. **Only Ask When Needed**: Only prompt user if task is missing OR has no workflow
3. **Session ID**: Generated automatically from process context (PID + working directory)
4. **Hooks**: The preToolUse hook will block tool execution if no task ID is set, so this skill prevents that blocking
5. **Persistence**: Task mappings persist across conversation restarts
6. **Workflow Required**: Only tasks with workflows can be used

## Example Conversation Flow

**Already Configured (Silent):**
```
User: "List all files"
Agent: [checks task silently, finds it's valid, proceeds directly]
Agent: [executes tools normally with task context]
```

**Missing Task Flow:**
```
Agent: [checks task, finds none] "I need to know which task you're working on. Here are the available tasks:
- mapping-test-1772335767041: Mapping Test [workflow: comedy_show]
- saxxx-1772335689049: saxxx [workflow: comedy_show]

Which task ID would you like to use?"
User: "mapping-test-1772335767041"
Agent: [registers task] "✓ Session registered to task: mapping-test-1772335767041. How can I help?"
```

**Task Without Workflow:**
```
Agent: [checks task, finds taskId but no workflow] "Your current task doesn't have a workflow attached. Please choose a task with a workflow:
- mapping-test-1772335767041: Mapping Test [workflow: comedy_show]
- saxxx-1772335689049: saxxx [workflow: comedy_show]

Which task ID would you like to use?"
User: "saxxx-1772335689049"
Agent: [registers new task] "✓ Session updated to task: saxxx-1772335689049. Now we can proceed."
```

## Testing

To test this skill is working:

**Test 1: Already Configured Session**
1. Start a conversation with a session that has a task+workflow
2. Agent should proceed silently without asking
3. Verify tools execute normally

**Test 2: New Session (No Task)**
1. Start a new Copilot conversation (new session ID)
2. Agent should immediately ask for task ID before any other work
3. Provide task ID, verify registration
4. Tools should execute after registration

**Test 3: Task Without Workflow**
1. Map session to a task without workflow manually
2. Start conversation
3. Agent should detect missing workflow and ask for new task

## Maintenance

- Available tasks are managed via the backend API and UI
- Task-workflow mappings are stored in `playground/backend/data/task-workflow-mapping.json`
- Session mappings are logged in `logs/copilot-sessions/`
