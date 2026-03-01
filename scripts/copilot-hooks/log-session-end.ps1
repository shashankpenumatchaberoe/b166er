#!/usr/bin/env pwsh
# Log session end event from GitHub Copilot CLI

param(
    [string]$LogDir = "logs/copilot-sessions"
)

# Check if logging is disabled
if ($env:COPILOT_LOGGING_DISABLED -eq "1" -or $env:COPILOT_LOGGING_DISABLED -eq "true") {
    exit 0
}

# Get task ID and workflow from session manager (non-interactive mode)
$sessionInfo = (& "$PSScriptRoot\session-manager.ps1" -NonInteractive) | Out-String
$sessionInfo = $sessionInfo.Trim()

# Parse session info (could be JSON or plain text for backwards compatibility)
$taskId = ""
$workflowFilename = ""

if ($sessionInfo) {
    try {
        $parsed = $sessionInfo | ConvertFrom-Json
        $taskId = $parsed.taskId
        $workflowFilename = $parsed.workflowFilename
    } catch {
        # Fallback to plain text (backwards compatibility)
        $taskId = $sessionInfo
    }
}

# Get terminal ID from environment
$terminalId = $env:TERMINAL_ID

# If no task ID, exit with error
if (-not $taskId) {
    Write-Host "`n[!] No task ID found for session end" -ForegroundColor Yellow
    Write-Host ""  
    @{ status = "error"; reason = "no_task_mapping" } | ConvertTo-Json -Compress
    exit 1
}

# Display session end with task ID
Write-Host "`n[SESSION END] Task: $taskId" -ForegroundColor Cyan
if ($workflowFilename) {
    Write-Host "[WORKFLOW] $workflowFilename" -ForegroundColor Gray
}
Write-Host ""

$logPath = Join-Path $PSScriptRoot "..\..\$LogDir\$taskId"

# Read input from stdin
$input = [Console]::In.ReadToEnd()

try {
    $data = $input | ConvertFrom-Json
    
    # Log session end
    $logEntry = @{
        event = "session_end"
        timestamp = Get-Date -Format "o"
        taskId = $taskId
        terminalId = $terminalId
        sessionId = if ($data.sessionId) { $data.sessionId } else { "unknown" }
        workflowFilename = $workflowFilename
        cwd = $data.cwd
        data = $data
    }
    
    # Append to main session log
    $mainLog = Join-Path $logPath "all-sessions.log"
   # $logEntry | ConvertTo-Json -Compress | Add-Content -Path $mainLog
    
    # POST to backend API to save in HistoryManager
    try {
        $backendUrl = "http://localhost:3001"
        $eventPayload = @{
            terminalId = $terminalId
            taskId = $taskId
            eventType = "session_end"
            workflowFilename = $workflowFilename
            data = $data
        } | ConvertTo-Json -Depth 10 -Compress
        
        Invoke-RestMethod -Uri "$backendUrl/copilot/event" -Method Post -Body $eventPayload -ContentType "application/json" -ErrorAction Stop | Out-Null
    } catch {
        # Silently continue if backend is unavailable
    }
    
    @{ status = "success"; taskId = $taskId; workflowFilename = $workflowFilename } | ConvertTo-Json -Compress
    
} catch {
    Write-Error "Error logging session end: $_"
    @{ status = "error"; message = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
