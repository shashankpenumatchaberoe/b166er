# Playground Backend API

## Endpoints

### Terminal Management

#### `GET /terminals`
Get all active terminals.

**Response:**
```json
[
  {
    "id": "uuid",
    "taskId": "task-name",
    "name": "terminal-name",
    "isAgent": true,
    "buffer": "terminal output...",
    "alive": true
  }
]
```

### History Management

#### `GET /history`
Get all task histories.

**Response:**
```json
[
  {
    "taskId": "task-1",
    "createdAt": "2026-02-25T10:00:00Z",
    "updatedAt": "2026-02-25T10:35:00Z",
    "conversations": [
      {
        "taskId": "task-1",
        "terminalId": "uuid",
        "terminalName": "coder-terminal",
        "agentName": "coder",
        "eventType": "stop",
        "role": "assistant",
        "message": "Implemented feature X...",
        "timestamp": "2026-02-25T10:34:58Z",
        "metadata": {}
      }
    ]
  }
]
```

#### `GET /history/:taskId`
Get history for a specific task.

**Response:**
```json
{
  "taskId": "task-1",
  "createdAt": "2026-02-25T10:00:00Z",
  "updatedAt": "2026-02-25T10:35:00Z",
  "conversations": [
    {
      "taskId": "task-1",
      "terminalId": "uuid",
      "terminalName": "coder-terminal",
      "agentName": "coder",
      "eventType": "stop",
      "role": "assistant",
      "message": "...",
      "timestamp": "2026-02-25T10:30:00Z",
      "metadata": {}
    }
  ]
}
```

### Context Resolution

#### `GET /context/terminal/:terminalId`
Get context associated with a playground terminal.

**Response:**
```json
{
  "taskId": "task-name",
  "terminalName": "coder-terminal",
  "agentName": "coder"
}
```

## WebSocket Events

### Client → Server

#### `terminal:create`
```json
{
  "taskId": "task-name",
  "name": "terminal-1",
  "isAgent": true,
  "cols": 80,
  "rows": 24
}
```

#### `terminal:input`
```json
{
  "id": "terminal-uuid",
  "data": "command to execute"
}
```

#### `terminal:resize`
```json
{
  "id": "terminal-uuid",
  "cols": 120,
  "rows": 30
}
```

#### `terminal:close`
```json
{
  "id": "terminal-uuid"
}
```

### Server → Client

#### `terminal:created`
```json
{
  "id": "uuid",
  "taskId": "task-name",
  "name": "terminal-1",
  "isAgent": true,
  "buffer": "",
  "alive": true
}
```

#### `terminal:output`
```json
{
  "id": "terminal-uuid",
  "data": "output from terminal"
}
```

#### `terminal:agent_exit`
```json
{
  "id": "terminal-uuid",
  "taskId": "task-name"
}
```

#### `terminal:error`
```json
{
  "message": "Error description"
}
```
