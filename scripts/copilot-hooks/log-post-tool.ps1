#!/usr/bin/env pwsh
# Log post-tool use events from GitHub Copilot CLI

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
    
    # Log post-tool event
    $logEntry = @{
        event = "post_tool_use"
        timestamp = Get-Date -Format "o"
        taskId = $taskId
        terminalId = $terminalId
        sessionId = if ($data.sessionId) { $data.sessionId } else { "unknown" }
        toolName = $data.toolName
        toolArgs = $data.toolArgs
        toolResult = $data.toolResult
        cwd = $data.cwd
        data = $data
    }
    
    # Log to dedicated tools file
    $toolsLog = Join-Path $logPath "tool-usage.log"
    # $logEntry | ConvertTo-Json -Compress | Add-Content -Path $toolsLog
    
    # Also log LLM responses to separate file
    $responsesLog = Join-Path $logPath "llm-responses.log"
    # $logEntry | ConvertTo-Json -Compress | Add-Content -Path $responsesLog
    
    # POST to backend API to save in HistoryManager
    try {
        $backendUrl = "http://localhost:3001"
        $eventPayload = @{
            terminalId = $terminalId
            taskId = $taskId
            eventType = "post_tool_use"
            workflowFilename = $workflowFilename
            data = $data
        } | ConvertTo-Json -Depth 10 -Compress
        
        Write-Host "[DEBUG] Sending post_tool_use to backend..." -ForegroundColor Cyan
        Write-Host "[DEBUG] Task: $taskId, Terminal: $terminalId" -ForegroundColor Gray
        
        $response = Invoke-RestMethod -Uri "$backendUrl/copilot/event" -Method Post -Body $eventPayload -ContentType "application/json" -ErrorAction Stop
        
        Write-Host "[DEBUG] Bot response saved to history" -ForegroundColor Green
    } catch {
        Write-Host "[DEBUG] Failed to send post_tool_use to history: $_" -ForegroundColor Red
        # Silently continue if backend is unavailable
    }
    
    @{ status = "success"; taskId = $taskId } | ConvertTo-Json -Compress
    
} catch {
    Write-Error "Error logging post-tool use: $_"
    @{ status = "error"; message = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
