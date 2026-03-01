#!/usr/bin/env bash
# session-manager.sh
# Gets the task ID for the current terminal by querying the backend API.
# Pure backend approach - no fallback logic.

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

# Get terminal ID from environment variable
TERMINAL_ID="${TERMINAL_ID:-}"

if [ -z "$TERMINAL_ID" ]; then
    echo "[session-manager] No TERMINAL_ID env var" >&2
    echo ""
    exit 0
fi

echo "[session-manager] Querying backend for terminal $TERMINAL_ID" >&2

# Query backend API
taskId=$(curl -s "$BACKEND_URL/copilot/terminal/$TERMINAL_ID/task" 2>&1 | jq -r '.taskId // empty' 2>&1)

if [ -n "$taskId" ]; then
    echo "[session-manager] Found task: $taskId" >&2
    echo "$taskId"
else
    echo "[session-manager] No taskId in response" >&2
    echo ""
fi

exit 0
