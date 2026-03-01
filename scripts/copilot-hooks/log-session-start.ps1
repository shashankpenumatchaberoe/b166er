#!/usr/bin/env pwsh
# Log session start event from GitHub Copilot CLI

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
    $logFile = Join-Path $PSScriptRoot "..\..\logs\copilot-sessions\session-start-debug.log"
    $logDir = Split-Path $logFile
    if (!(Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
   # "$(Get-Date -Format 'o') $Message" | Add-Content -Path $logFile
}

Write-Debug-Log "[session-start] Starting hook execution"

# Read input from stdin FIRST to get Copilot's sessionId
$stdinInput = [Console]::In.ReadToEnd()
$data = $null
$sessionId = $null

try {
    $data = $stdinInput | ConvertFrom-Json
    $sessionId = $data.sessionId
    Write-Debug-Log "[session-start] Received sessionId from Copilot: $sessionId"
    Write-Debug-Log "[session-start] Received data fields: $($data.PSObject.Properties.Name -join ', ')"
} catch {
    Write-Debug-Log "[session-start] ERROR parsing stdin: $_"
}

# Try to initialize session automatically (maps to pendingTaskId if available)
$backendUrl = "http://localhost:3001"
$autoMapped = $false
if ($sessionId) {
    try {
        Write-Debug-Log "[session-start] Calling session initialization endpoint"
        $initResult = Invoke-RestMethod -Uri "$backendUrl/session/$sessionId/initialize" -Method Post -ContentType "application/json" -Body "{}" -ErrorAction Stop
        Write-Debug-Log "[session-start] Init result: $($initResult | ConvertTo-Json -Compress)"
        
        if ($initResult.status -eq 'ready') {
            $autoMapped = $true
            Write-Debug-Log "[session-start] ✓ Session auto-mapped to task: $($initResult.taskId)"
        } else {
            Write-Debug-Log "[session-start] Session initialization returned status: $($initResult.status)"
        }
    } catch {
        Write-Debug-Log "[session-start] Session initialization failed: $($_.Exception.Message)"
    }
}

# Get task ID and workflow from session manager (non-interactive mode)
Write-Debug-Log "[session-start] Calling session-manager (non-interactive)"
$sessionInfo = (& "$PSScriptRoot\session-manager.ps1" -SessionId $sessionId -NonInteractive) | Out-String
$sessionInfo = $sessionInfo.Trim()

Write-Debug-Log "[session-start] Session info received: $sessionInfo"

# Parse session info (could be JSON or plain text for backwards compatibility)
$taskId = ""
$workflowFilename = ""

if ($sessionInfo) {
    try {
        $parsed = $sessionInfo | ConvertFrom-Json
        $taskId = $parsed.taskId
        $workflowFilename = $parsed.workflowFilename
        Write-Debug-Log "[session-start] Parsed - TaskId: $taskId, Workflow: $workflowFilename"
    } catch {
        # Fallback to plain text (backwards compatibility)
        $taskId = $sessionInfo
        Write-Debug-Log "[session-start] Parse failed, using plain text: $taskId"
    }
}

# CRITICAL: Validate task and workflow are present (new requirement)
if (-not $taskId) {
    Write-Debug-Log "[session-start] ERROR: No task ID obtained. Session cannot proceed."
    
    # Get available tasks to show the user
    $availableTasks = @()
    try {
        $tasksResponse = Invoke-RestMethod -Uri "http://localhost:3001/tasks" -TimeoutSec 3 -ErrorAction Stop
        $availableTasks = $tasksResponse | Where-Object { $_.workflowFilename } | Select-Object -First 5
    } catch {
        Write-Debug-Log "[session-start] Could not fetch tasks: $($_.Exception.Message)"
    }
    
    # Show warning - sessionStart can't block execution, but preToolUse will
    Write-Host "`n==============================================================" -ForegroundColor Yellow
    Write-Host "COPILOT SESSION - TASK ID REQUIRED" -ForegroundColor Yellow
    Write-Host "==============================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This session needs a task ID before tools can execute." -ForegroundColor Gray
    Write-Host "Copilot will ask you which task you're working on." -ForegroundColor Cyan
    Write-Host ""
    
    if ($availableTasks.Count -gt 0) {
        Write-Host "Available tasks:" -ForegroundColor White
        foreach ($task in $availableTasks) {
            Write-Host "  - $($task.id): $($task.name)" -ForegroundColor Gray
            Write-Host "    workflow: $($task.workflowFilename)" -ForegroundColor DarkGray
        }
        Write-Host ""
    }
    
    Write-Host "SETUP OPTIONS:" -ForegroundColor Cyan
    Write-Host "  1. Interactive: pwsh -File scripts/setup-task.ps1" -ForegroundColor White
    Write-Host "  2. See tasks:   Invoke-RestMethod -Uri http://localhost:3001/tasks | Format-Table id, name, workflowFilename" -ForegroundColor White
    Write-Host ""
    Write-Host "==============================================================" -ForegroundColor Yellow
    Write-Host ""
    
    # Note: sessionStart output is ignored by Copilot, but Write-Host shows in terminal
    # Tool execution will be blocked by preToolUse hook with conversational message
    exit 0  # Don't exit 1 - it doesn't block Copilot anyway
}

if (-not $workflowFilename) {
    Write-Debug-Log "[session-start] ERROR: Task '$taskId' has no workflow. Workflows are required."
    Write-Host "`n[X] Task '$taskId' has no workflow attached." -ForegroundColor Red
    Write-Host "Tasks require workflows to proceed with Copilot sessions.`n" -ForegroundColor Yellow
    Write-Host "Please assign a workflow to this task in the UI.`n" -ForegroundColor Gray
    exit 0  # Don't exit 1 - preToolUse will handle blocking
}

# Display session context to user
Write-Host "`n==============================================================" -ForegroundColor Cyan
Write-Host "COPILOT SESSION STARTED" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "Task:     $taskId" -ForegroundColor Green
Write-Host "Workflow: $workflowFilename" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure log directory exists
$logPath = Join-Path $PSScriptRoot "..\..\$LogDir\$taskId"
if (-not (Test-Path $logPath)) {
    New-Item -ItemType Directory -Path $logPath -Force | Out-Null
}

# We already read stdin and parsed data at the top of the script
# Just use the previously parsed $data and $sessionId
try {
    # Re-parse if needed (stdin was already read)
    if (-not $data) {
        $data = $stdinInput | ConvertFrom-Json
    }
    
    # Generate sessionId if not present
    if (-not $sessionId) {
        $sessionId = [guid]::NewGuid().ToString()
        Write-Debug-Log "[session-start] Generated fallback sessionId: $sessionId"
    }
    
    # Create session log file with timestamp
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $logFile = Join-Path $logPath "session-$timestamp-$sessionId.log"
    
    # Log session start
    $logEntry = @{
        event = "session_start"
        timestamp = Get-Date -Format "o"
        taskId = $taskId
        sessionId = $sessionId
        terminalId = if ($env:TERMINAL_ID) { $env:TERMINAL_ID } else { $null }  # Backward compatibility for playground
        workflowFilename = $workflowFilename
        cwd = $data.cwd
        data = $data
    }
    
    Write-Debug-Log "[session-start] Logging session start: taskId=$taskId, sessionId=$sessionId, terminalId=$($env:TERMINAL_ID)"
    
    $logEntry | ConvertTo-Json -Compress | Add-Content -Path $logFile
    
    # Also append to main session log
    $mainLog = Join-Path $logPath "all-sessions.log"
    # $logEntry | ConvertTo-Json -Compress | Add-Content -Path $mainLog
    
    # POST to backend API to save in HistoryManager
    try {
        $backendUrl = "http://localhost:3001"
        $eventPayload = @{
            terminalId = $terminalId
            taskId = $taskId
            eventType = "session_start"
            workflowFilename = $workflowFilename
            data = $data
        } | ConvertTo-Json -Depth 10 -Compress
        
        Invoke-RestMethod -Uri "$backendUrl/copilot/event" -Method Post -Body $eventPayload -ContentType "application/json" -ErrorAction Stop | Out-Null
    } catch {
        # Silently continue if backend is unavailable
    }
    
    # Load workflow content if workflow is assigned
    $workflowContent = $null
    
    if ($workflowFilename) {
        Write-Debug-Log "[session-start] Workflow assigned: $workflowFilename"
        try {
            # Ensure .md extension
            if (-not $workflowFilename.EndsWith('.md')) {
                $workflowFilename = "$workflowFilename.md"
            }
            # Load the specific workflow file from .playground/workflows/
            $workflowPath = Join-Path $PSScriptRoot "..\../.playground\workflows\$workflowFilename"
            $resolvedPath = Resolve-Path $workflowPath -ErrorAction SilentlyContinue
            Write-Debug-Log "[session-start] Looking for workflow at: $workflowPath"
            Write-Debug-Log "[session-start] Resolved path: $resolvedPath"
            Write-Debug-Log "[session-start] File exists: $(Test-Path $workflowPath)"
            
            if (Test-Path $workflowPath) {
                $workflowContent = Get-Content -Path $workflowPath -Raw
                $contentLength = if ($workflowContent) { $workflowContent.Length } else { 0 }
                Write-Debug-Log "[session-start] Workflow loaded successfully, length: $contentLength bytes"
            } else {
                Write-Debug-Log "[session-start] ERROR: Workflow file not found at $workflowPath"
            }
        } catch {
            Write-Debug-Log "[session-start] ERROR loading workflow: $($_.Exception.Message)"
            # Silently continue if workflow file cannot be loaded
        }
    } else {
        Write-Debug-Log "[session-start] No workflow assigned to this task"
    }
    
    # Build response
    $response = @{
        status = "success"
        logFile = $logFile
        taskId = $taskId
    }
    
    # Include workflow context if available
    if ($workflowContent) {
        $response.context = "# Current Workflow: $workflowFilename`n`n$workflowContent"
        $response.workflowFilename = $workflowFilename
    }
    
    # Output confirmation with workflow context (must be valid JSON)
    $response | ConvertTo-Json -Compress
    
} catch {
    # Log error to stderr
    Write-Error "Error logging session start: $_"
    
    # Return error as JSON
    @{ status = "error"; message = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
