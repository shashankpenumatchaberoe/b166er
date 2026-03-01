#!/bin/bash
# Log error events from GitHub Copilot CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${LOG_DIR:-logs/copilot-sessions}"

# Get task ID from session manager
TASK_ID=$("$SCRIPT_DIR/session-manager.sh")
TASK_ID=$(echo "$TASK_ID" | xargs)

# Get terminal ID from environment
TERMINAL_ID="${TERMINAL_ID:-}"

# If no task ID, skip logging
if [ -z "$TASK_ID" ]; then
    jq -c -n '{status: "skipped", reason: "no_task_mapping"}'
    exit 0
fi

LOG_PATH="$SCRIPT_DIR/../../$LOG_DIR/$TASK_ID"
mkdir -p "$LOG_PATH"

# Read input from stdin
INPUT=$(cat)

# Parse and log
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // "unknown"')
ERROR=$(echo "$INPUT" | jq -r '.error // ""')
ERROR_MESSAGE=$(echo "$INPUT" | jq -r '.errorMessage // ""')

LOG_ENTRY=$(jq -c -n \
    --arg event "error" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg taskId "$TASK_ID" \
    --arg terminalId "$TERMINAL_ID" \
    --arg sessionId "$SESSION_ID" \
    --arg error "$ERROR" \
    --arg errorMessage "$ERROR_MESSAGE" \
    --argjson data "$INPUT" \
    '{
        event: $event,
        timestamp: $timestamp,
        taskId: $taskId,
        terminalId: $terminalId,
        sessionId: $sessionId,
        error: $error,
        errorMessage: $errorMessage,
        cwd: $data.cwd,
        data: $data
    }')

# Log to dedicated errors file
echo "$LOG_ENTRY" >> "$LOG_PATH/errors.log"

# Also append to main log
echo "$LOG_ENTRY" >> "$LOG_PATH/all-sessions.log"

# POST to backend API to save in HistoryManager
BACKEND_URL="http://localhost:3001"
EVENT_PAYLOAD=$(jq -c -n \
    --arg terminalId "$TERMINAL_ID" \
    --arg taskId "$TASK_ID" \
    --arg eventType "error" \
    --argjson data "$INPUT" \
    '{terminalId: $terminalId, taskId: $taskId, eventType: $eventType, data: $data}')

curl -s -X POST "$BACKEND_URL/copilot/event" \
    -H "Content-Type: application/json" \
    -d "$EVENT_PAYLOAD" > /dev/null 2>&1 || true

# POST to backend API to save in HistoryManager
BACKEND_URL="http://localhost:3001"
EVENT_PAYLOAD=$(jq -c -n \
    --arg terminalId "$TERMINAL_ID" \
    --arg taskId "$TASK_ID" \
    --arg eventType "error" \
    --argjson data "$INPUT" \
    '{terminalId: $terminalId, taskId: $taskId, eventType: $eventType, data: $data}')

curl -s -X POST "$BACKEND_URL/copilot/event" \
    -H "Content-Type: application/json" \
    -d "$EVENT_PAYLOAD" > /dev/null 2>&1 || true

jq -c -n --arg status "success" --arg taskId "$TASK_ID" '{status: $status, taskId: $taskId}'
