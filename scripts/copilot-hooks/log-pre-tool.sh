#!/bin/bash
# Log pre-tool use events from GitHub Copilot CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${LOG_DIR:-logs/copilot-sessions}"

# Get task ID from session manager
TASK_ID=$("$SCRIPT_DIR/session-manager.sh")
TASK_ID=$(echo "$TASK_ID" | xargs)

# Get terminal ID from environment
TERMINAL_ID="${TERMINAL_ID:-}"

# If no task ID, trigger prompt flow
if [ -z "$TASK_ID" ]; then
    echo "" >&2
    echo "[!] No task ID found for tool execution" >&2
    echo "A task ID is required to continue. The session manager will prompt you for one." >&2
    echo "" >&2
    jq -c -n '{status: "error", reason: "no_task_mapping", message: "Task ID required. Please run session-manager to set up a task."}'
    exit 1
fi

# Display current task ID to user before tool execution
echo "" >&2
echo "[TOOL] Task: $TASK_ID" >&2
echo "" >&2

LOG_PATH="$SCRIPT_DIR/../../$LOG_DIR/$TASK_ID"
mkdir -p "$LOG_PATH"

# Read input from stdin
INPUT=$(cat)

# Parse and log
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // "unknown"')
TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName // ""')
TOOL_ARGS=$(echo "$INPUT" | jq -r '.toolArgs // "{}"')

LOG_ENTRY=$(jq -c -n \
    --arg event "pre_tool_use" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg taskId "$TASK_ID" \
    --arg terminalId "$TERMINAL_ID" \
    --arg sessionId "$SESSION_ID" \
    --arg toolName "$TOOL_NAME" \
    --arg toolArgs "$TOOL_ARGS" \
    --argjson data "$INPUT" \
    '{
        event: $event,
        timestamp: $timestamp,
        taskId: $taskId,
        terminalId: $terminalId,
        sessionId: $sessionId,
        toolName: $toolName,
        toolArgs: $toolArgs,
        cwd: $data.cwd,
        data: $data
    }')

echo "$LOG_ENTRY" >> "$LOG_PATH/tool-usage.log"

# POST to backend API to save in HistoryManager
BACKEND_URL="http://localhost:3001"
EVENT_PAYLOAD=$(jq -c -n \
    --arg terminalId "$TERMINAL_ID" \
    --arg taskId "$TASK_ID" \
    --arg eventType "pre_tool_use" \
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
    --arg eventType "pre_tool_use" \
    --argjson data "$INPUT" \
    '{terminalId: $terminalId, taskId: $taskId, eventType: $eventType, data: $data}')

curl -s -X POST "$BACKEND_URL/copilot/event" \
    -H "Content-Type: application/json" \
    -d "$EVENT_PAYLOAD" > /dev/null 2>&1 || true

jq -c -n --arg status "success" --arg taskId "$TASK_ID" '{status: $status, taskId: $taskId}'
