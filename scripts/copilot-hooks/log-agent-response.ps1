#!/usr/bin/env pwsh
# Log agent response events from GitHub Copilot CLI

param(
    [string]$LogDir = "logs/copilot-sessions"
)

# Check if logging is disabled
if ($env:COPILOT_LOGGING_DISABLED -eq "1" -or $env:COPILOT_LOGGING_DISABLED -eq "true") {
    exit 0
}

# Read input from stdin FIRST to get Copilot's sessionId
$stdinInput = [Console]::In.ReadToEnd()
$data = $null
$sessionId = $null

try {
    $data = $stdinInput | ConvertFrom-Json
    $sessionId = $data.sessionId
} catch {
    # If parsing fails, exit early
    @{ status = "error"; message = "Failed to parse stdin" } | ConvertTo-Json -Compress
    exit 1
}

# Get task ID from session manager using Copilot's sessionId
$taskId = ""
$workflowFilename = ""

if ($sessionId) {
    $sessionInfo = (& "$PSScriptRoot\session-manager.ps1" -SessionId $sessionId -NonInteractive) | Out-String
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
}

# Get terminal ID from environment
$terminalId = $env:TERMINAL_ID

# If no task ID, exit with error
if (-not $taskId) {
    Write-Host "`n[!] No task ID found" -ForegroundColor Yellow
    @{ status = "error"; reason = "no_task_mapping" } | ConvertTo-Json -Compress
    exit 1
}

$logPath = Join-Path $PSScriptRoot "..\..\$LogDir\$taskId"
if (-not (Test-Path $logPath)) {
    New-Item -ItemType Directory -Path $logPath -Force | Out-Null
}

# Data was already read from stdin at the top of the script
try {
    if (-not $data) {
        @{ status = "error"; message = "No data from stdin" } | ConvertTo-Json -Compress
        exit 1
    }
    
    # Log agent response event
    $logEntry = @{
        event = "agent_response"
        timestamp = Get-Date -Format "o"
        taskId = $taskId
        terminalId = $terminalId
        sessionId = if ($data.sessionId) { $data.sessionId } else { "unknown" }
        agentName = if ($data.agentName) { $data.agentName } else { "GitHub Copilot" }
        message = $data.message
        cwd = $data.cwd
        data = $data
    }
    
    # Log to responses file
    $responsesLog = Join-Path $logPath "agent-responses.log"
    $logEntry | ConvertTo-Json -Compress | Add-Content -Path $responsesLog
    
    # POST to backend API to save in HistoryManager
    try {
        $backendUrl = "http://localhost:3001"
        $eventPayload = @{
            terminalId = $terminalId
            taskId = $taskId
            eventType = "agent_response"
            workflowFilename = $workflowFilename
            data = $data
        } | ConvertTo-Json -Depth 10 -Compress
        
        $response = Invoke-RestMethod -Uri "$backendUrl/copilot/event" -Method Post -Body $eventPayload -ContentType "application/json" -ErrorAction Stop
        
        @{ status = "success"; saved = $true } | ConvertTo-Json -Compress
    } catch {
        Write-Host "[!] Failed to send agent_response to backend: $_" -ForegroundColor Red
        @{ status = "error"; message = "Backend POST failed: $_" } | ConvertTo-Json -Compress
        exit 1
    }
} catch {
    Write-Host "[!] Error: $_" -ForegroundColor Red
    @{ status = "error"; message = "$_" } | ConvertTo-Json -Compress
    exit 1
}
