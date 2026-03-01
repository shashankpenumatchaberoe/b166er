# session-manager.ps1
# Gets the task ID for the current terminal by querying the backend API.
# Prompts user for task ID if not mapped, validates task+workflow requirement.

param(
    [Parameter(Mandatory=$false)]
    [string]$SessionId,
    [string]$BackendUrl = "http://localhost:3001",
    [int]$MaxRetries = 3,
    [switch]$NonInteractive
)

# Debug logging function
function Write-Debug-Log {
    param([string]$Message)
    $logFile = Join-Path $PSScriptRoot "..\..\logs\copilot-sessions\session-manager.log"
    $logDir = Split-Path $logFile
    if (!(Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    # "$(Get-Date -Format 'o') $Message" | Add-Content -Path $logFile
}

# Exit with error message to user
function Exit-WithError {
    param([string]$Message)
    Write-Debug-Log "`[session-manager`] ERROR: $Message"
    Write-Host "`n[X] $Message" -ForegroundColor Red
    Write-Output ""
    exit 1
}

# Validate task exists via backend API
function Validate-TaskId {
    param([string]$TaskId)
    
    try {
        $url = "$BackendUrl/tasks/$TaskId"
        $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
        return $response
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            return $null
        }
        throw
    }
}

# Get workflow for task
function Get-TaskWorkflow {
    param([object]$Task)
    
    if ($Task.workflowFilename) {
        try {
            $url = "$BackendUrl/workflows/$($Task.workflowFilename)"
            $workflow = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
            return $workflow
        } catch {
            Write-Debug-Log "`[session-manager`] Workflow validation failed: $($_.Exception.Message)"
            return $null
        }
    }
    return $null
}

# Get available tasks from backend
function Get-AvailableTasks {
    try {
        $url = "$BackendUrl/tasks"
        $tasks = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
        return $tasks | Where-Object { $_.workflowFilename }
    } catch {
        Write-Debug-Log "`[session-manager`] Failed to get tasks: $($_.Exception.Message)"
        return @()
    }
}

# Prompt user for task ID with retry logic
function Prompt-ForTaskId {
    param([int]$MaxAttempts = 3)
    
    Write-Host "`n[TASK ID REQUIRED]" -ForegroundColor Cyan
    Write-Host "This Copilot session needs to be associated with a task that has a workflow.`n" -ForegroundColor Gray
    
    # Show available tasks
    $tasks = Get-AvailableTasks
    if ($tasks.Count -gt 0) {
        Write-Host "Available tasks with workflows:" -ForegroundColor Yellow
        foreach ($task in $tasks | Select-Object -First 5) {
            Write-Host "  * $($task.id) - $($task.name) [$($task.workflowFilename)]" -ForegroundColor Gray
        }
        if ($tasks.Count -gt 5) {
            Write-Host "  ... and $($tasks.Count - 5) more" -ForegroundColor Gray
        }
        Write-Host ""
    }
    
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        if ($attempt -gt 1) {
            Write-Host "`nAttempt $attempt of $MaxAttempts" -ForegroundColor Yellow
        }
        
        # Read from console (not stdin) because stdin contains JSON from Copilot
        Write-Host "Enter task ID: " -NoNewline -ForegroundColor Cyan
        $taskId = $host.UI.ReadLine()
        
        if ([string]::IsNullOrWhiteSpace($taskId)) {
            Write-Host "[X] Task ID cannot be empty" -ForegroundColor Red
            continue
        }
        
        Write-Debug-Log "`[session-manager`] User entered task ID: $taskId"
        
        # Validate task exists
        $task = Validate-TaskId -TaskId $taskId
        if (-not $task) {
            Write-Host "[X] Task '$taskId' not found" -ForegroundColor Red
            continue
        }
        
        # Check if task has workflow
        if (-not $task.workflowFilename) {
            Write-Host "❌ Task '$taskId' has no workflow attached. Workflows are required." -ForegroundColor Red
            continue
        }
        
        # Validate workflow exists
        $workflow = Get-TaskWorkflow -Task $task
        if (-not $workflow) {
            Write-Host "[X] Workflow '$($task.workflowFilename)' not found for task '$taskId'" -ForegroundColor Red
            continue
        }
        
        Write-Debug-Log "`[session-manager`] Task validated: $taskId with workflow: $($task.workflowFilename)"
        return @{
            taskId = $task.id
            workflowFilename = $task.workflowFilename
        }
    }
    
    # Max retries exceeded
    return $null
}

# Register session mapping with backend
function Register-SessionMapping {
    param(
        [string]$SessionId,
        [string]$TaskId
    )
    
    try {
        $url = "$BackendUrl/session/$SessionId/task"
        $body = @{ taskId = $TaskId } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        Write-Debug-Log "`[session-manager`] Registered session $SessionId to task $TaskId"
        return $true
    } catch {
        Write-Debug-Log "`[session-manager`] Failed to register mapping: $($_.Exception.Message)"
        return $false
    }
}

# ========== MAIN EXECUTION ==========

# Get or generate terminal identifier
Write-Debug-Log "`[session-manager`] === SESSION START ==="
Write-Debug-Log "`[session-manager`] SessionId parameter: $SessionId"

if (-not $SessionId) {
    # Try to get the latest session ID from the backend (tracks active sessions)
    try {
        $latestSession = Invoke-RestMethod -Uri "$BackendUrl/session/latest" -Method Get -ErrorAction Stop
        if ($latestSession -and $latestSession.sessionId) {
            $SessionId = $latestSession.sessionId
            Write-Debug-Log "`[session-manager`] Using latest session ID from backend: $SessionId"
        }
    } catch {
        Write-Debug-Log "`[session-manager`] Failed to get latest session from backend: $($_.Exception.Message)"
    }
    
    # If still no session ID, generate one (backwards compatibility)
    if (-not $SessionId) {
        $cwd = Get-Location | Select-Object -ExpandProperty Path
        $cwdHash = ($cwd + $PID).GetHashCode().ToString("X8")
        $SessionId = "copilot-$cwdHash"
        Write-Debug-Log "`[session-manager`] Generated session ID: $SessionId (from PID=$PID, CWD=$cwd)"
    }
} else {
    Write-Debug-Log "`[session-manager`] Using provided session ID: $SessionId"
}

Write-Debug-Log "`[session-manager`] Processing session $SessionId"

try {
    # Step 1: Check if session already has task mapping
    $url = "$BackendUrl/session/$SessionId/task"
    Write-Debug-Log "`[session-manager`] STEP 1: Checking session mapping at: $url"
    $existingMapping = $null
    
    try {
        $existingMapping = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
        Write-Debug-Log "`[session-manager`] API response: $($existingMapping | ConvertTo-Json -Compress)"
    } catch {
        # 404 is expected for new sessions
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Debug-Log "`[session-manager`] API call failed with status: $statusCode"
        if ($statusCode -ne 404) {
            Write-Debug-Log "`[session-manager`] Unexpected error: $($_.Exception.Message)"
            throw
        }
        Write-Debug-Log "`[session-manager`] No existing mapping - 404 is expected for new sessions"
    }
    
    # Step 2: If mapped, validate it still has workflow
    Write-Debug-Log "`[session-manager`] STEP 2: Validating existing mapping"
    if ($existingMapping -and $existingMapping.taskId) {
        Write-Debug-Log "`[session-manager`] Found existing mapping: $($existingMapping.taskId)"
        
        $task = Validate-TaskId -TaskId $existingMapping.taskId
        Write-Debug-Log "`[session-manager`] Task validation result: $(if($task) { 'VALID' } else { 'INVALID' })"
        
        if ($task -and $task.workflowFilename) {
            Write-Debug-Log "`[session-manager`] Task has workflow: $($task.workflowFilename)"
            $workflow = Get-TaskWorkflow -Task $task
            Write-Debug-Log "`[session-manager`] Workflow validation result: $(if($workflow) { 'VALID' } else { 'INVALID' })"
            
            if ($workflow) {
                # Valid existing mapping
                Write-Debug-Log "`[session-manager`] ✓ Existing mapping is valid, returning task context"
                $output = @{
                    taskId = $task.id
                    workflowFilename = $task.workflowFilename
                }
                Write-Output ($output | ConvertTo-Json -Compress)
                exit 0
            }
        } else {
            Write-Debug-Log "`[session-manager`] Task missing workflow: workflowFilename=$($task.workflowFilename)"
        }
        
        # Existing mapping invalid, need to re-prompt
        Write-Debug-Log "`[session-manager`] Existing mapping invalid, will prompt user"
        Write-Host "`n[!] Previously mapped task no longer valid" -ForegroundColor Yellow
    } else {
        Write-Debug-Log "`[session-manager`] No existing mapping found (existingMapping=$($existingMapping -ne $null), taskId=$($existingMapping.taskId))"
    }
    
    # Step 3: No valid mapping - check if we can prompt
    if ($NonInteractive) {
        Write-Debug-Log "`[session-manager`] STEP 3: Running in non-interactive mode, cannot prompt user"
        Write-Debug-Log "`[session-manager`] ✗ No task mapping found and cannot prompt in hook context"
        Write-Output ""
        exit 1
    }
    
    Write-Debug-Log "`[session-manager`] STEP 3: Prompting user for task ID (max attempts: $MaxRetries)"
    $taskContext = Prompt-ForTaskId -MaxAttempts $MaxRetries
    
    if (-not $taskContext) {
        Write-Debug-Log "`[session-manager`] ✗ Failed to obtain valid task ID"
        Exit-WithError "Failed to obtain valid task ID after $MaxRetries attempts. Session cannot proceed."
    }
    
    Write-Debug-Log "`[session-manager`] ✓ User provided task: $($taskContext.taskId)"
    
    # Step 4: Register the mapping
    Write-Debug-Log "`[session-manager`] STEP 4: Registering session mapping"
    $registered = Register-SessionMapping -SessionId $SessionId -TaskId $taskContext.taskId
    Write-Debug-Log "`[session-manager`] Registration result: $(if($registered) { 'SUCCESS' } else { 'FAILED' })"
    
    if (-not $registered) {
        Exit-WithError "Failed to register terminal mapping. Please try again."
    }
    
    # Step 5: Return task context
    Write-Host "✓ Task: $($taskContext.taskId)" -ForegroundColor Green
    Write-Host "✓ Workflow: $($taskContext.workflowFilename)" -ForegroundColor Green
    Write-Host ""
    
    Write-Output ($taskContext | ConvertTo-Json -Compress)
    exit 0
    
} catch {
    Exit-WithError "Backend communication error: $($_.Exception.Message)"
}
