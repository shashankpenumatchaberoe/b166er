# Task Setup Guide for Copilot Sessions

## Overview

Every Copilot conversation requires a **Task ID** with an attached **Workflow**. This ensures all work is tracked and follows the correct workflow process.

## Quick Setup

### Option 1: Use the Helper Script (Recommended)

```powershell
# Run this in PowerShell while Copilot is active
.\scripts\setup-task.ps1
```

The script will:
1. Check if backend is running
2. Show available tasks with workflows
3. Let you select a task
4. Map your current Copilot session to that task

### Option 2: Manual API Setup

```powershell
# 1. List tasks
Invoke-RestMethod -Uri http://localhost:3001/tasks | Format-Table

# 2. Map session to task
$body = @{ taskId = "YOUR_TASK_ID" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/session/$env:GITHUB_COPILOT_SESSION_ID/task" `
  -Method Post `
  -Body $body `
  -ContentType "application/json"
```

### Option 3: Use the UI

1. Open `http://localhost:3000`
2. Navigate to Tasks
3. Create or select a task
4. Assign a workflow to it
5. The task will be used for your next Copilot conversation

## What Happens Without a Task

If you start a Copilot conversation without setting up a task, you'll see:

```
==============================================
ERROR: NO TASK ID FOUND
==============================================

This Copilot session requires a task ID to track work.
...
```

The conversation **will not proceed** until you set up a task.

## How It Works

### Hook Flow

1. **Session Start**: When Copilot starts, the `sessionStart` hook runs
2. **Check Task**: The hook checks if the session has a mapped task
3. **Validate Workflow**: Ensures the task has an attached workflow
4. **Load Context**: Injects the workflow content into the conversation
5. **Track Work**: All user prompts and tool usage are logged to that task

### Why This is Required

- **Traceability**: All AI work is tracked to specific tasks
- **Workflow Enforcement**: Ensures proper procedures are followed
- **Context Management**: Workflows provide specific instructions to the AI
- **History**: Complete conversation history is preserved per task

## Creating Tasks

### Via UI
```
http://localhost:3000 → Tasks → New Task
```

### Via API
```powershell
$body = @{
  name = "My Feature Development"
  description = "Build new feature X"
  workflowFilename = "feature_dev"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/tasks `
  -Method Post `
  -Body $body `
  -ContentType "application/json"
```

## Troubleshooting

### "Backend not running"
```powershell
cd playground/backend
npm start
```

### "Task has no workflow"
Assign a workflow via the UI or API:
```powershell
$body = @{ workflowFilename = "comedy_show" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/tasks/YOUR_TASK_ID" `
  -Method Put `
  -Body $body `
  -ContentType "application/json"
```

### "No active Copilot session"
The script needs `$env:GITHUB_COPILOT_SESSION_ID` to be set. Run the script while you have an active Copilot chat window open.

## Advanced: Session Management

### Check Current Session Task
```powershell
$sessionId = $env:GITHUB_COPILOT_SESSION_ID
Invoke-RestMethod -Uri "http://localhost:3001/session/$sessionId/task"
```

### Clear Session Mapping
```powershell
$sessionId = $env:GITHUB_COPILOT_SESSION_ID
Invoke-RestMethod -Uri "http://localhost:3001/session/$sessionId/task" -Method Delete
```

### Set Pending Task (for next session)
```powershell
$body = @{ taskId = "YOUR_TASK_ID" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/pending-task" `
  -Method Post `
  -Body $body `
  -ContentType "application/json"
```
