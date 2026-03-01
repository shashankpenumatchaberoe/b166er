#!/usr/bin/env pwsh
# Enable Copilot logging across all sessions

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ENABLE COPILOT LOGGING" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Remove environment variable from current session
$env:COPILOT_LOGGING_DISABLED = $null

# Remove environment variable from user profile
[System.Environment]::SetEnvironmentVariable("COPILOT_LOGGING_DISABLED", $null, "User")

Write-Host "✓ Logging enabled successfully!" -ForegroundColor Green
Write-Host "`nWhat this does:" -ForegroundColor Yellow
Write-Host "  • All Copilot hook logging scripts will run normally"
Write-Host "  • Session logs will be created in logs/copilot-sessions/"
Write-Host "  • Tool usage will be logged"
Write-Host "  • Agent responses will be captured"
Write-Host "`nTo disable logging:" -ForegroundColor Yellow
Write-Host "  Run: pwsh -File scripts/disable-logging.ps1"
Write-Host "`nIMPORTANT:" -ForegroundColor Red
Write-Host "  Restart VS Code for the change to take full effect in new Copilot sessions`n"
