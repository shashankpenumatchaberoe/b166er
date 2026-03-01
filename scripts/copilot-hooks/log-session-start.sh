#!/bin/bash
# Log session start event from GitHub Copilot CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${LOG_DIR:-logs/copilot-sessions}"

# Get task ID from session manager
TASK_ID=$("$SCRIPT_DIR/session-manager.sh")
TASK_ID=$(echo "$TASK_ID" | xargs)

# Get terminal ID from environment
TERMINAL_ID="${TERMINAL_ID:-}"

# If no task ID, trigger error
if [ -z "$TASK_ID" ]; then
    echo "" >&2
    echo "[X] No task ID obtained. Session cannot proceed." >&2
    echo "Please run session-manager to set up a task with a workflow." >&2
    echo "" >&2
    jq -c -n '{status: "error", reason: "no_task_mapping", message: "No task ID obtained. Session cannot proceed."}'
    exit 1
fi

# Display session start with task ID
echo "" >&2
echo "[SESSION START] Task: $TASK_ID" >&2
echo "" >&2

LOG_PATH="$SCRIPT_DIR/../../$LOG_DIR/$TASK_ID"
mkdir -p "$LOG_PATH"

# Read input from stdin
INPUT=$(cat)

# Parse JSON and log
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // empty')

if [ -z "$SESSION_ID" ]; then
    SESSION_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "session-$TIMESTAMP")
fi

LOG_FILE="$LOG_PATH/session-$TIMESTAMP-$SESSION_ID.log"

# Create log entry
LOG_ENTRY=$(jq -c -n \
    --arg event "session_start" \
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

# Write to log files
echo "$LOG_ENTRY" >> "$LOG_FILE"
echo "$LOG_ENTRY" >> "$LOG_PATH/all-sessions.log"

# POST to backend API to save in HistoryManager
BACKEND_URL="http://localhost:3001"
EVENT_PAYLOAD=$(jq -c -n \
    --arg terminalId "$TERMINAL_ID" \
    --arg taskId "$TASK_ID" \
    --arg eventType "session_start" \
    --argjson data "$INPUT" \
    '{terminalId: $terminalId, taskId: $taskId, eventType: $eventType, data: $data}')

curl -s -X POST "$BACKEND_URL/copilot/event" \
    -H "Content-Type: application/json" \
    -d "$EVENT_PAYLOAD" > /dev/null 2>&1 || true

# Output confirmation as JSON
jq -c -n \
    --arg status "success" \
    --arg logFile "$LOG_FILE" \
    --arg taskId "$TASK_ID" \
    '{status: $status, logFile: $logFile, taskId: $taskId}'
