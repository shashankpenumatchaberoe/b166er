#!/usr/bin/env pwsh
# Disable Copilot logging across all sessions

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DISABLE COPILOT LOGGING" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Set environment variable for current session
$env:COPILOT_LOGGING_DISABLED = "1"

# Set environment variable persistently for user
[System.Environment]::SetEnvironmentVariable("COPILOT_LOGGING_DISABLED", "1", "User")

Write-Host "✓ Logging disabled successfully!" -ForegroundColor Green
Write-Host "`nWhat this does:" -ForegroundColor Yellow
Write-Host "  • All Copilot hook logging scripts will exit immediately"
Write-Host "  • No session logs will be created"
Write-Host "  • No tool usage logs will be written"
Write-Host "  • No agent responses will be logged"
Write-Host "`nTo re-enable logging:" -ForegroundColor Yellow
Write-Host "  Run: pwsh -File scripts/enable-logging.ps1"
Write-Host "`nIMPORTANT:" -ForegroundColor Red
Write-Host "  Restart VS Code for the change to take full effect in new Copilot sessions`n"
