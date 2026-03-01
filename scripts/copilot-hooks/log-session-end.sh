#!/bin/bash
# Log session end event from GitHub Copilot CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${LOG_DIR:-logs/copilot-sessions}"

# Get task ID from session manager
TASK_ID=$("$SCRIPT_DIR/session-manager.sh")
TASK_ID=$(echo "$TASK_ID" | xargs)

# Get terminal ID from environment
TERMINAL_ID="${TERMINAL_ID:-}"

# If no task ID, exit with error
if [ -z "$TASK_ID" ]; then
    echo "" >&2
    echo "[!] No task ID found for session end" >&2
    echo "" >&2
    jq -c -n '{status: "error", reason: "no_task_mapping"}'
    exit 1
fi

# Display session end with task ID
echo "" >&2
echo "[SESSION END] Task: $TASK_ID" >&2
echo "" >&2

LOG_PATH="$SCRIPT_DIR/../../$LOG_DIR/$TASK_ID"

# Read input from stdin
INPUT=$(cat)

# Parse and log
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // "unknown"')

LOG_ENTRY=$(jq -c -n \
    --arg event "session_end" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg taskId "$TASK_ID" \
    --arg terminalId "$TERMINAL_ID" \
    --arg sessionId "$SESSION_ID" \
    --argjson data "$INPUT" \
    '{
        event: $event,
        timestamp: $timestamp,
        taskId: $taskId,
        terminalId: $terminalId,
        sessionId: $sessionId,
        cwd: $data.cwd,
        data: $data
    }')

echo "$LOG_ENTRY" >> "$LOG_PATH/all-sessions.log"

# POST to backend API to save in HistoryManager
BACKEND_URL="http://localhost:3001"
EVENT_PAYLOAD=$(jq -c -n \
    --arg terminalId "$TERMINAL_ID" \
    --arg taskId "$TASK_ID" \
    --arg eventType "session_end" \
    --argjson data "$INPUT" \
    '{terminalId: $terminalId, taskId: $taskId, eventType: $eventType, data: $data}')

curl -s -X POST "$BACKEND_URL/copilot/event" \
    -H "Content-Type: application/json" \
    -d "$EVENT_PAYLOAD" > /dev/null 2>&1 || true

jq -c -n --arg status "success" --arg taskId "$TASK_ID" '{status: $status, taskId: $taskId}'
