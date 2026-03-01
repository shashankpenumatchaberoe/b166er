#!/bin/bash
# Log agent response events from GitHub Copilot CLI

LOG_DIR="logs/copilot-sessions"

# Read input from stdin
stdin_input=$(cat)
session_id=$(echo "$stdin_input" | jq -r '.sessionId // empty')

# Get task ID from session manager
task_id=""
workflow_filename=""

if [ -n "$session_id" ]; then
    session_info=$(bash "$SCRIPT_DIR/session-manager.sh" "$session_id" 2>/dev/null)
    
    if [ -n "$session_info" ]; then
        task_id=$(echo "$session_info" | jq -r '.taskId // empty')
        workflow_filename=$(echo "$session_info" | jq -r '.workflowFilename // empty')
    fi
fi

# Get terminal ID from environment
terminal_id="${TERMINAL_ID:-unknown}"

# If no task ID, exit with error
if [ -z "$task_id" ]; then
    echo '{"status":"error","reason":"no_task_mapping"}'
    exit 1
fi

log_path="$LOG_DIR/$task_id"
mkdir -p "$log_path"

# Extract agent response data
agent_name=$(echo "$stdin_input" | jq -r '.agentName // "GitHub Copilot"')
message=$(echo "$stdin_input" | jq -r '.message // ""')
cwd=$(echo "$stdin_input" | jq -r '.cwd // ""')

# Create log entry
log_entry=$(jq -n \
    --arg event "agent_response" \
    --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")" \
    --arg taskId "$task_id" \
    --arg terminalId "$terminal_id" \
    --arg sessionId "$session_id" \
    --arg agentName "$agent_name" \
    --arg message "$message" \
    --arg cwd "$cwd" \
    --argjson data "$stdin_input" \
    '{event: $event, timestamp: $timestamp, taskId: $taskId, terminalId: $terminalId, sessionId: $sessionId, agentName: $agentName, message: $message, cwd: $cwd, data: $data}')

# Log to file
echo "$log_entry" >> "$log_path/agent-responses.log"

# POST to backend API
backend_url="http://localhost:3001"
event_payload=$(jq -n \
    --arg terminalId "$terminal_id" \
    --arg taskId "$task_id" \
    --arg eventType "agent_response" \
    --arg workflowFilename "$workflow_filename" \
    --argjson data "$stdin_input" \
    '{terminalId: $terminalId, taskId: $taskId, eventType: $eventType, workflowFilename: $workflowFilename, data: $data}')

response=$(curl -s -X POST "$backend_url/copilot/event" \
    -H "Content-Type: application/json" \
    -d "$event_payload")

echo '{"status":"success","saved":true}'
