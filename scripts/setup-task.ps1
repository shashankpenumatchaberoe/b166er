#!/usr/bin/env pwsh
# Setup Task - Helper script to assign a task to your current Copilot session

param(
    [Parameter(Mandatory=$false)]
    [string]$TaskId,
    [string]$BackendUrl = "http://localhost:3001"
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "COPILOT TASK SETUP" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if backend is running
try {
    $null = Invoke-RestMethod -Uri "$BackendUrl/tasks" -ErrorAction Stop -TimeoutSec 2
} catch {
    Write-Host "[X] Backend not running at $BackendUrl" -ForegroundColor Red
    Write-Host "Please start the backend server first:`n" -ForegroundColor Yellow
    Write-Host "  cd playground/backend" -ForegroundColor Gray
    Write-Host "  npm start`n" -ForegroundColor Gray
    exit 1
}

# List available tasks
Write-Host "Available tasks with workflows:`n" -ForegroundColor Green
try {
    $tasks = Invoke-RestMethod -Uri "$BackendUrl/tasks" -ErrorAction Stop
    $tasksWithWorkflow = $tasks | Where-Object { $_.workflowFilename }
    
    if ($tasksWithWorkflow.Count -eq 0) {
        Write-Host "[!] No tasks with workflows found." -ForegroundColor Yellow
        Write-Host "Create a task with a workflow first via the UI or API.`n" -ForegroundColor Gray
        exit 1
    }
    
    $tasksWithWorkflow | Format-Table -Property id, name, workflowFilename -AutoSize
    Write-Host ""
} catch {
    Write-Host "[X] Failed to fetch tasks: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Prompt for task ID if not provided
if (-not $TaskId) {
    $TaskId = Read-Host "Enter task ID"
}

if ([string]::IsNullOrWhiteSpace($TaskId)) {
    Write-Host "[X] Task ID cannot be empty" -ForegroundColor Red
    exit 1
}

# Validate task exists and has workflow
try {
    $task = Invoke-RestMethod -Uri "$BackendUrl/tasks/$TaskId" -ErrorAction Stop
    
    if (-not $task.workflowFilename) {
        Write-Host "[X] Task '$TaskId' has no workflow attached" -ForegroundColor Red
        Write-Host "Please assign a workflow to this task first.`n" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "[OK] Task validated: $($task.name)" -ForegroundColor Green
    Write-Host "      Workflow: $($task.workflowFilename)`n" -ForegroundColor Gray
    
} catch {
    Write-Host "[X] Task '$TaskId' not found" -ForegroundColor Red
    exit 1
}

# Get current Copilot session ID from backend
$sessionId = $null

try {
    $latestSession = Invoke-RestMethod -Uri "$BackendUrl/session/latest" -ErrorAction Stop
    if ($latestSession -and $latestSession.sessionId) {
        $sessionId = $latestSession.sessionId
        Write-Host "[OK] Using session ID from active Copilot session" -ForegroundColor Green
    }
} catch {
    # No active session found
}

if (-not $sessionId) {
    Write-Host "[!] No active Copilot session detected" -ForegroundColor Yellow
    Write-Host "This script should be run while a Copilot conversation is active.`n" -ForegroundColor Gray
    Write-Host "However, you can manually set a pending task that will be used for the next session:`n" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri "$BackendUrl/pending-task" `
            -Method Post `
            -Body (@{ taskId = $TaskId } | ConvertTo-Json) `
            -ContentType "application/json" `
            -ErrorAction Stop
        
        Write-Host "[OK] Task '$TaskId' set as pending" -ForegroundColor Green
        Write-Host "Start a new Copilot conversation to use this task.`n" -ForegroundColor Green
    } catch {
        Write-Host "[X] Failed to set pending task: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    # Map session to task
    Write-Host "Mapping session to task..." -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri "$BackendUrl/session/$sessionId/task" `
            -Method Post `
            -Body (@{ taskId = $TaskId } | ConvertTo-Json) `
            -ContentType "application/json" `
            -ErrorAction Stop
        
        Write-Host "`n[OK] SUCCESS!" -ForegroundColor Green
        Write-Host "Session $sessionId mapped to task '$TaskId'" -ForegroundColor Green
        Write-Host "`nYou can now continue your Copilot conversation.`n" -ForegroundColor Cyan
        
    } catch {
        Write-Host "[X] Failed to map session: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "========================================`n" -ForegroundColor Cyan
