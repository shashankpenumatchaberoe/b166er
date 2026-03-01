#!/usr/bin/env pwsh
# Log user prompt submissions from GitHub Copilot CLI

param(
    [string]$LogDir = "logs/copilot-sessions"
)

# Check if logging is disabled
if ($env:COPILOT_LOGGING_DISABLED -eq "1" -or $env:COPILOT_LOGGING_DISABLED -eq "true") {
    exit 0
}

# Debug logging function
function Write-Debug-Log {
    param([string]$Message)
    $logFile = Join-Path $PSScriptRoot "..\..\logs\copilot-sessions\user-prompt-debug.log"
    $logDir = Split-Path $logFile
    if (!(Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
   # "$(Get-Date -Format 'o') $Message" | Add-Content -Path $logFile
}

Write-Debug-Log "[user-prompt] Starting hook execution"

# Read input from stdin FIRST to get Copilot's sessionId
$stdinInput = [Console]::In.ReadToEnd()
$data = $null
$sessionId = $null

try {
    $data = $stdinInput | ConvertFrom-Json
    $sessionId = $data.sessionId
    Write-Debug-Log "[user-prompt] Received sessionId from Copilot: $sessionId"
    Write-Debug-Log "[user-prompt] Received data fields: $($data.PSObject.Properties.Name -join ', ')"
} catch {
    Write-Debug-Log "[user-prompt] ERROR parsing stdin: $_"
}

# Get task ID and workflow from session manager using Copilot's sessionId
$taskId = ""
$workflowFilename = ""

if ($sessionId) {
    $sessionInfo = (& "$PSScriptRoot\session-manager.ps1" -SessionId $sessionId -NonInteractive) | Out-String
    $sessionInfo = $sessionInfo.Trim()
    
    Write-Debug-Log "[user-prompt] Session info received: $sessionInfo"
    
    if ($sessionInfo) {
        try {
            $parsed = $sessionInfo | ConvertFrom-Json
            $taskId = $parsed.taskId
            $workflowFilename = $parsed.workflowFilename
            Write-Debug-Log "[user-prompt] Parsed - TaskId: $taskId, Workflow: $workflowFilename"
        } catch {
            # Fallback to plain text (backwards compatibility)
            $taskId = $sessionInfo
            Write-Debug-Log "[user-prompt] Parse failed, using plain text: $taskId"
        }
    }
}

# Get terminal ID from environment
$terminalId = $env:TERMINAL_ID

# If no task ID, fail
if (-not $taskId) {
    Write-Debug-Log "[user-prompt] No task ID found for session $sessionId"
    @{ status = "error"; message = "No task mapping" } | ConvertTo-Json -Compress
    exit 1
}

# Display current task ID to user
Write-Host "`n[TASK] $taskId" -ForegroundColor Cyan
if ($workflowFilename) {
    Write-Host "[WORKFLOW] $workflowFilename" -ForegroundColor Gray
}
Write-Host ""

$logPath = Join-Path $PSScriptRoot "..\..\$LogDir\$taskId"
if (-not (Test-Path $logPath)) {
    New-Item -ItemType Directory -Path $logPath -Force | Out-Null
}

# Data was already read from stdin at the top of the script
try {
    if (-not $data) {
        Write-Debug-Log "[user-prompt] ERROR: No data available from stdin"
        @{ status = "error"; message = "No data from stdin" } | ConvertTo-Json -Compress
        exit 1
    }
    
    # Debug: Log what fields we have
    if ($data.transcript_path) {
        Write-Debug-Log "[user-prompt] Transcript path: $($data.transcript_path)"
    }
    
    # Log user prompt
    $logEntry = @{
        event = "user_prompt"
        timestamp = Get-Date -Format "o"
        taskId = $taskId
        terminalId = $terminalId
        sessionId = if ($data.sessionId) { $data.sessionId } else { "unknown" }
        workflowFilename = $workflowFilename
        prompt = $data.prompt
        cwd = $data.cwd
        data = $data
    }
    
    # Log to dedicated prompts file
    $promptsLog = Join-Path $logPath "user-prompts.log"
    $logEntry | ConvertTo-Json -Compress | Add-Content -Path $promptsLog
    
    # Also append to main log
    $mainLog = Join-Path $logPath "all-sessions.log"
    # $logEntry | ConvertTo-Json -Compress | Add-Content -Path $mainLog
    
    # POST to backend API to save in HistoryManager
    try {
        $backendUrl = "http://localhost:3001"
        $eventPayload = @{
            terminalId = $terminalId
            taskId = $taskId
            eventType = "user_prompt"
            workflowFilename = $workflowFilename
            data = $data
        } | ConvertTo-Json -Depth 10 -Compress
        
        Write-Debug-Log "[user-prompt] Sending to backend: $backendUrl/copilot/event"
        Write-Debug-Log "[user-prompt] Payload: $eventPayload"
        
        $response = Invoke-RestMethod -Uri "$backendUrl/copilot/event" -Method Post -Body $eventPayload -ContentType "application/json" -ErrorAction Stop
        
        Write-Debug-Log "[user-prompt] Backend response: $($response | ConvertTo-Json -Compress)"
        Write-Host "[DEBUG] User prompt sent to history" -ForegroundColor Green
        
        # Extract agent responses from transcript if available
        if ($data.transcript_path -and (Test-Path $data.transcript_path)) {
            Write-Debug-Log "[user-prompt] Extracting agent responses from transcript"
            & "$PSScriptRoot\extract-agent-responses.ps1" -TranscriptPath $data.transcript_path -TaskId $taskId -TerminalId $terminalId -WorkflowFilename $workflowFilename -BackendUrl $backendUrl
        } else {
            Write-Debug-Log "[user-prompt] No transcript path available for agent response extraction"
        }
    } catch {
        Write-Debug-Log "[user-prompt] ERROR sending to backend: $_"
        Write-Host "[DEBUG] Failed to send user prompt to history: $_" -ForegroundColor Red
        # Silently continue if backend is unavailable - file logs are still saved
    }
    
    # Load workflow content if workflow is assigned
    $workflowContent = $null
    
    if ($workflowFilename) {
        Write-Debug-Log "[user-prompt] Workflow assigned: $workflowFilename"
        try {
            # Ensure .md extension
            if (-not $workflowFilename.EndsWith('.md')) {
                $workflowFilename = "$workflowFilename.md"
            }
            # Load the specific workflow file from .playground/workflows/
            $workflowPath = Join-Path $PSScriptRoot "..\../.playground\workflows\$workflowFilename"
            $resolvedPath = Resolve-Path $workflowPath -ErrorAction SilentlyContinue
            Write-Debug-Log "[user-prompt] Looking for workflow at: $workflowPath"
            Write-Debug-Log "[user-prompt] Resolved path: $resolvedPath"
            Write-Debug-Log "[user-prompt] File exists: $(Test-Path $workflowPath)"
            
            if (Test-Path $workflowPath) {
                $workflowContent = Get-Content -Path $workflowPath -Raw
                $contentLength = if ($workflowContent) { $workflowContent.Length } else { 0 }
                Write-Debug-Log "[user-prompt] Workflow loaded successfully, length: $contentLength bytes"
            } else {
                Write-Debug-Log "[user-prompt] ERROR: Workflow file not found at $workflowPath"
            }
        } catch {
            Write-Debug-Log "[user-prompt] ERROR loading workflow: $($_.Exception.Message)"
            # Silently continue if workflow file cannot be loaded
        }
    } else {
        Write-Debug-Log "[user-prompt] No workflow assigned to this task"
    }
    
    # Build response
    $response = @{
        status = "success"
        taskId = $taskId
    }
    
    # Include workflow context if available
    if ($workflowContent) {
        $response.context = "# Current Workflow: $workflowFilename`n`n$workflowContent"
        $response.workflowFilename = $workflowFilename
    }
    
    $response | ConvertTo-Json -Compress
    
} catch {
    Write-Error "Error logging user prompt: $_"
    @{ status = "error"; message = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
