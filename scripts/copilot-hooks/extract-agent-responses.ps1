#!/usr/bin/env pwsh
# Extract agent responses from transcript and save to history

param(
    [string]$TranscriptPath,
    [string]$TaskId,
    [string]$TerminalId,
    [string]$WorkflowFilename,
    [string]$BackendUrl = "http://localhost:3001"
)

Write-Host "[DEBUG] Extracting agent responses from transcript..." -ForegroundColor Cyan
Write-Host "[DEBUG] Transcript: $TranscriptPath" -ForegroundColor Gray

if (-not (Test-Path $TranscriptPath)) {
    Write-Host "[DEBUG] Transcript not found: $TranscriptPath" -ForegroundColor Yellow
    exit 0
}

try {
    $transcript = Get-Content -Path $TranscriptPath -Raw | ConvertFrom-Json
    
    Write-Host "[DEBUG] Transcript loaded, analyzing messages..." -ForegroundColor Gray
    
    # Extract the last assistant message (most recent agent response)
    $assistantMessages = $transcript.messages | Where-Object { $_.role -eq "assistant" }
    
    Write-Host "[DEBUG] Found $($assistantMessages.Count) assistant messages" -ForegroundColor Gray
    
    if (-not $assistantMessages) {
        Write-Host "[DEBUG] No assistant messages found in transcript" -ForegroundColor Yellow
        exit 0
    }
    
    $lastAssistantMsg = $assistantMessages | Select-Object -Last 1
    $messagePreview = $lastAssistantMsg.content.Substring(0, [Math]::Min(100, $lastAssistantMsg.content.Length))
    
    Write-Host "[DEBUG] Last assistant message preview: $messagePreview..." -ForegroundColor Gray
    
    # Save to backend history
    $eventPayload = @{
        terminalId = $TerminalId
        taskId = $TaskId
        eventType = "agent_response"
        workflowFilename = $WorkflowFilename
        data = @{
            message = $lastAssistantMsg.content
            timestamp = (Get-Date -Format "o")
            agentName = "GitHub Copilot"
        }
    } | ConvertTo-Json -Depth 10 -Compress
    
    Write-Host "[DEBUG] Sending agent response to backend..." -ForegroundColor Cyan
    
    $response = Invoke-RestMethod -Uri "$BackendUrl/copilot/event" -Method Post -Body $eventPayload -ContentType "application/json" -ErrorAction Stop
    
    Write-Host "[DEBUG] Agent response saved to history" -ForegroundColor Green
    
} catch {
    Write-Host "[DEBUG] Error extracting agent responses: $_" -ForegroundColor Red
}