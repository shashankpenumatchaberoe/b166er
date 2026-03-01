#!/usr/bin/env pwsh
# Log error events from GitHub Copilot CLI

param(
    [string]$LogDir = "logs/copilot-sessions"
)

# Check if logging is disabled
if ($env:COPILOT_LOGGING_DISABLED -eq "1" -or $env:COPILOT_LOGGING_DISABLED -eq "true") {
    exit 0
}

# Get task ID from session manager
$sessionInfo = (& "$PSScriptRoot\session-manager.ps1") | Out-String
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

# If no task ID, skip logging
if (-not $taskId) {
    @{ status = "skipped"; reason = "no_task_mapping" } | ConvertTo-Json -Compress
    exit 0
}

$logPath = Join-Path $PSScriptRoot "..\..\$LogDir\$taskId"
if (-not (Test-Path $logPath)) {
    New-Item -ItemType Directory -Path $logPath -Force | Out-Null
}

# Read input from stdin
$input = [Console]::In.ReadToEnd()

try {
    $data = $input | ConvertFrom-Json
    
    # Log error event
    $logEntry = @{
        event = "error"
        timestamp = Get-Date -Format "o"
        taskId = $taskId
        terminalId = $terminalId
        sessionId = if ($data.sessionId) { $data.sessionId } else { "unknown" }
        error = $data.error
        errorMessage = $data.errorMessage
        cwd = $data.cwd
        data = $data
    }
    
    # Log to dedicated errors file
    $errorsLog = Join-Path $logPath "errors.log"
    $logEntry | ConvertTo-Json -Compress | Add-Content -Path $errorsLog
    
    # Also append to main log
    $mainLog = Join-Path $logPath "all-sessions.log"
    # $logEntry | ConvertTo-Json -Compress | Add-Content -Path $mainLog
    
    # POST to backend API to save in HistoryManager
    try {
        $backendUrl = "http://localhost:3001"
        $eventPayload = @{
            terminalId = $terminalId
            taskId = $taskId
            eventType = "error"
            workflowFilename = $workflowFilename
            data = $data
        } | ConvertTo-Json -Depth 10 -Compress
        
        Invoke-RestMethod -Uri "$backendUrl/copilot/event" -Method Post -Body $eventPayload -ContentType "application/json" -ErrorAction Stop | Out-Null
    } catch {
        # Silently continue if backend is unavailable
    }
    
    @{ status = "success"; taskId = $taskId } | ConvertTo-Json -Compress
    
} catch {
    Write-Error "Error logging error event: $_"
    @{ status = "error"; message = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
