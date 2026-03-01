#!/usr/bin/env pwsh
# Log pre-tool use events from GitHub Copilot CLI

param(
    [string]$LogDir = "logs/copilot-sessions"
)

# Check if logging is disabled
if ($env:COPILOT_LOGGING_DISABLED -eq "1" -or $env:COPILOT_LOGGING_DISABLED -eq "true") {
    exit 0
}

# Get task ID from session manager (non-interactive mode)
$sessionInfo = (& "$PSScriptRoot\session-manager.ps1" -NonInteractive) | Out-String
$sessionInfo = $sessionInfo.Trim()

# Parse JSON response
if ($sessionInfo) {
    try {
        $sessionData = $sessionInfo | ConvertFrom-Json
        $taskId = $sessionData.taskId
        $workflowFilename = $sessionData.workflowFilename
    } catch {
        $taskId = $null
    }
}

# Get terminal ID from environment
$terminalId = $env:TERMINAL_ID

# If no task ID, DENY tool execution (proper Copilot hook response)
if (-not $taskId) {
    # Get available tasks to show the user
    $availableTasksMsg = ""
    try {
        $tasks = Invoke-RestMethod -Uri "http://localhost:3001/tasks" -TimeoutSec 3 -ErrorAction Stop | Where-Object { $_.workflowFilename }
        if ($tasks) {
            $availableTasksMsg = "`n`nAvailable tasks:`n"
            $tasks | Select-Object -First 5 | ForEach-Object {
                $availableTasksMsg += "- $($_.id): $($_.name) [workflow: $($_.workflowFilename)]`n"
            }
        }
    } catch {
        # If API call fails, just skip showing tasks
    }

    $denyReason = @"
I need a task ID to execute tools. This session requires task tracking for workflow management.

Please ask the user: "Which task are you working on?" or tell them to set up a task.
$availableTasksMsg
TO SET UP TASK:
In a separate terminal, run ONE of these commands:

Option 1 - Interactive setup:
  pwsh -File scripts/setup-task.ps1

Option 2 - See all tasks:
  Invoke-RestMethod -Uri http://localhost:3001/tasks | Format-Table id, name, workflowFilename

After setting up the task, the user can continue the conversation and I'll be able to execute tools.
"@

    # Return proper deny response for Copilot hooks
    @{ 
        permissionDecision = "deny"
        permissionDecisionReason = $denyReason
    } | ConvertTo-Json -Compress
    
    exit 0  # Exit 0 when returning a valid deny response
}

# Display current task ID to user before tool execution
Write-Host "`n[TOOL] Task: $taskId" -ForegroundColor Cyan
if ($workflowFilename) {
    Write-Host "[WORKFLOW] $workflowFilename" -ForegroundColor Gray
}
Write-Host ""

$logPath = Join-Path $PSScriptRoot "..\..\$LogDir\$taskId"
if (-not (Test-Path $logPath)) {
    New-Item -ItemType Directory -Path $logPath -Force | Out-Null
}

# Read input from stdin
$input = [Console]::In.ReadToEnd()

try {
    $data = $input | ConvertFrom-Json
    
    # Log pre-tool event
    $logEntry = @{
        event = "pre_tool_use"
        timestamp = Get-Date -Format "o"
        taskId = $taskId
        terminalId = $terminalId
        sessionId = if ($data.sessionId) { $data.sessionId } else { "unknown" }
        toolName = $data.toolName
        toolArgs = $data.toolArgs
        cwd = $data.cwd
        data = $data
    }
    
    # Log to dedicated tools file
    $toolsLog = Join-Path $logPath "tool-usage.log"
    # $logEntry | ConvertTo-Json -Compress | Add-Content -Path $toolsLog
    
    # POST to backend API to save in HistoryManager
    try {
        $backendUrl = "http://localhost:3001"
        $eventPayload = @{
            terminalId = $terminalId
            taskId = $taskId
            eventType = "pre_tool_use"
            workflowFilename = $workflowFilename
            data = $data
        } | ConvertTo-Json -Depth 10 -Compress
        
        Invoke-RestMethod -Uri "$backendUrl/copilot/event" -Method Post -Body $eventPayload -ContentType "application/json" -ErrorAction Stop | Out-Null
    } catch {
        # Silently continue if backend is unavailable
    }
    
    @{ status = "success"; taskId = $taskId } | ConvertTo-Json -Compress
    
} catch {
    Write-Error "Error logging pre-tool use: $_"
    @{ status = "error"; message = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
