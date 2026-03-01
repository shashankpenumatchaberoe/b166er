# B1-66ER User Manual

Complete guide for using the MAX AI UI multi-agent collaboration platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Core Concepts](#core-concepts)
3. [Using the Web UI](#using-the-web-ui)
4. [Working with Tasks](#working-with-tasks)
5. [Workflows](#workflows)
6. [Agent Terminals](#agent-terminals)
7. [GitHub Copilot Integration](#github-copilot-integration)
8. [API Reference](#api-reference)
9. [Advanced Usage](#advanced-usage)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### System Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Linux
- **Node.js**: Version 18.0 or higher
- **RAM**: Minimum 4GB, recommended 8GB+
- **Disk Space**: 500MB for application and dependencies
- **Browser**: Modern browser (Chrome 90+, Firefox 88+, Edge 90+, Safari 14+)

### Installation Steps

#### 1. Install Dependencies

```bash
# Navigate to backend
cd playground/backend

# Install Node.js packages
npm install
```

#### 2. Start the Backend Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

The backend starts on **http://localhost:3001**

#### 3. Access the Frontend

The frontend is served on **http://localhost:3001/**


---

## Core Concepts

### Tasks

**Tasks** are the fundamental units of work in B1-66ER. Each task:

- Has a unique ID (e.g., `feature-dev-1234567890`)
- Contains a name and description
- Is linked to a **workflow**
- Maintains a complete conversation history
- Tracks creation and update timestamps

### Workflows

**Workflows** define how agents collaborate:

- Specify which agents are available
- Define handoff chains between agents
- Set agent responsibilities and behaviors
- Establish exit criteria and conditions
- Written in Markdown format

### Agents

**Agents** are AI entities that:

- Execute specific roles (e.g., coder, comedian, heckler)
- Run in isolated terminal environments
- Follow workflow-defined protocols
- Can hand off work to other agents
- Generate responses based on their role

### History

**History** tracks everything that happens:

- User prompts
- Agent responses
- Tool executions
- Handoffs between agents
- Timestamps and metadata
- Stored as JSON per task

---

## Using the Web UI

### Interface Overview

```
┌─────────────────────────────────────────────────────────┐
│  B1-66ER Header                      [Workflows] [Agents]│
├──────────┬──────────────────────────────────────────────┤
│          │                                               │
│  Tasks   │         Main Content Area                     │
│  Sidebar │      (History, Terminals, etc.)               │
│          │                                               │
│  [+]     │                                               │
│          │                                               │
└──────────┴──────────────────────────────────────────────┘
```

### Navigation

#### Header

- **B1-66ER Logo** - Home/brand identity
- **Project Name** - Current project context
- **Workflows Button** - View available workflows
- **Agents Button** - See active agents
- **Prompt Composer** - Quick access (Ctrl+P)
- **Connection Status** - WebSocket connection state

#### Task Sidebar

- **Task List** - All available tasks
- **Add Button (+)** - Create new task
- **Collapse Button** - Hide/show sidebar
- **Task Selection** - Click to load task history

#### Main Content Area

Displays:
- Conversation history for selected task
- Agent terminals
- Workflow information
- Task details

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Open Prompt Composer |
| `Esc` | Close modals/dialogs |
| `Ctrl+/` | Toggle task sidebar |
| `Ctrl+N` | New task |

---

## Working with Tasks

### Creating a Task

#### Via Web UI

1. Click the **+** button in the task sidebar
2. Fill in the task form:
   - **Name**: Short, descriptive title
   - **Description**: Detailed explanation of the task
   - **Workflow**: Select from available workflows
3. Click **Create Task**

The new task appears in the sidebar with a timestamp.

#### Via API

```powershell
# PowerShell
$body = @{
    name = "Implement Login Feature"
    description = "Build authentication system with OAuth"
    workflowFilename = "feature_dev"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/tasks" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

```bash
# Bash/curl
curl -X POST http://localhost:3001/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Implement Login Feature",
    "description": "Build authentication system with OAuth",
    "workflowFilename": "feature_dev"
  }'
```

### Viewing Task History

1. Select a task from the sidebar
2. The main area loads the conversation history
3. History displays:
   - **User prompts** - What you asked
   - **Agent responses** - What agents replied
   - **Tool executions** - Actions taken
   - **Handoffs** - Agent transitions
   - **Timestamps** - When each event occurred

### Editing Tasks

Tasks are managed through the backend API. To update a task:

```powershell
# Update task properties
$body = @{
    name = "Updated Task Name"
    description = "New description"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/tasks/task-id-123" `
    -Method Patch `
    -Body $body `
    -ContentType "application/json"
```

### Deleting Tasks

```powershell
# Delete task and its history
Invoke-RestMethod -Uri "http://localhost:3001/tasks/task-id-123" `
    -Method Delete
```

**Warning**: This removes the task and all associated history permanently.

---

## Workflows

### Understanding Workflows

Workflows are Markdown files in `playground/workflows/` that define:

1. **Agent Roster** - Which agents participate
2. **Handoff Protocol** - How agents pass work
3. **Agent Responsibilities** - What each agent does
4. **Exit Criteria** - When the workflow completes

### Workflow Structure

```markdown
# Workflow Name

## How Handoffs Work

Explanation of handoff syntax and mechanics.

## Agent Handoff Chain

| From Agent | To Agent | Condition | Handoff Format |
|------------|----------|-----------|----------------|
| agent1     | agent2   | when X    | **Handoff:** @agent2 "message" |

## Agents

### @agent1
- Role description
- Responsibilities
- Exit criteria

### @agent2
- Role description
- Responsibilities
- Exit criteria
```

### Creating Custom Workflows

1. Create a new Markdown file in `playground/workflows/`
2. Name it descriptively (e.g., `code_review.md`)
3. Define your agents and handoff chain
4. Add agent-specific instructions
5. Specify exit conditions

**Example: Simple Code Review Workflow**

```markdown
# Code Review Workflow

## Agent Handoff Chain

| From Agent | To Agent | Condition | Handoff Format |
|------------|----------|-----------|----------------|
| coder      | reviewer | Code complete | **Handoff:** @reviewer "Please review my code" |
| reviewer   | coder    | Changes needed | **Handoff:** @coder "Make these changes" |
| reviewer   | END      | Approved | **Complete:** Code review approved |

## Agents

### @coder
**Role**: Write and modify code

**Responsibilities**:
- Implement features
- Fix bugs
- Address reviewer feedback

**Exit**: Hand off to @reviewer when ready

### @reviewer
**Role**: Review code quality

**Responsibilities**:
- Check code correctness
- Verify best practices
- Suggest improvements

**Exit**: 
- Hand back to @coder if changes needed
- Complete if code is approved
```

### Using Workflows

#### Attach to Task

When creating a task, specify the workflow:

```json
{
  "name": "Fix Bug #123",
  "workflowFilename": "code_review"
}
```

#### Handoff Syntax

Agents trigger handoffs by including this in their response:

```
**Handoff:** @next-agent "Brief message about current state"
```

This **immediately** invokes the specified agent.

### Built-in Workflows

#### Comedy Show (`comedy_show.md`)

Multi-agent joke creation and evaluation:
- **@comedian** - Creates jokes
- **@heckler** - Rates jokes (1-10)
- **@audience** - Reacts to good jokes

Flow: comedian → heckler → (if score ≥5) audience → comedian

---

## Agent Terminals

### Overview

Each agent runs in an isolated terminal environment managed by the backend using `node-pty`.

### Terminal Properties

- **ID**: Unique identifier (UUID)
- **Task ID**: Associated task
- **Name**: Human-readable terminal name
- **Agent**: Agent running in this terminal
- **Buffer**: Terminal output content
- **Alive**: Terminal process state

### Creating Terminals

Terminals are created automatically when agents are invoked, or manually via WebSocket:

```javascript
// Client-side JavaScript
socket.emit('terminal:create', {
  taskId: 'my-task-123',
  name: 'coder-terminal',
  agentName: 'coder'
});

socket.on('terminal:created', (data) => {
  console.log('Terminal created:', data.id);
});
```

### Sending Commands

```javascript
socket.emit('terminal:input', {
  id: 'terminal-uuid',
  input: 'echo Hello World\n'
});
```

### Receiving Output

```javascript
socket.on('terminal:data', (data) => {
  console.log(`Terminal ${data.id}:`, data.data);
  // data.data contains the output string
});
```

### Terminal Lifecycle

1. **Create** - Terminal spawned with agent context
2. **Active** - Agent executes, produces output
3. **Output** - Data streamed via WebSocket
4. **Exit** - Agent completes, terminal may close
5. **Cleanup** - Resources released

### Viewing Terminals

In the UI, terminals appear as:
- Embedded terminal windows (using xterm.js)
- Real-time output streaming
- Scrollback buffer for history

---

## GitHub Copilot Integration

### Overview

B1-66ER integrates with GitHub Copilot through lifecycle hooks that:
- Map Copilot sessions to tasks
- Inject workflow context
- Log all interactions
- Enforce workflow requirements

### Setup

#### Quick Setup (Recommended)

```powershell
# Run the setup script
.\scripts\setup-task.ps1
```

This will:
1. Check if backend is running
2. List available tasks with workflows
3. Let you select a task
4. Map your Copilot session to that task

#### Manual Setup

```powershell
# 1. Get your session ID
$sessionId = $env:GITHUB_COPILOT_SESSION_ID

# 2. List tasks
Invoke-RestMethod -Uri "http://localhost:3001/tasks"

# 3. Map session to task
$body = @{ taskId = "your-task-id" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3001/session/$sessionId/task" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

### How It Works

#### Hook Execution Flow

```
┌─────────────────────────────────────────────────┐
│  User starts Copilot session                    │
└───────────────────┬─────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  sessionStart hook fires                        │
│  → Checks for session-to-task mapping           │
└───────────────────┬─────────────────────────────┘
                    ↓
         ┌──────────┴──────────┐
         ↓                     ↓
    [Mapping Exists]      [No Mapping]
         ↓                     ↓
    Load workflow        Prompt user for task
    Inject context       Validate task + workflow
         ↓                     ↓
         └──────────┬──────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Session proceeds with workflow context         │
└─────────────────────────────────────────────────┘
```

### Hook Scripts

Located in `scripts/copilot-hooks/`:

| Hook | Triggers | Purpose |
|------|----------|---------|
| `log-session-start` | Session begins | Map session to task, load workflow |
| `log-user-prompt` | User sends message | Log user input |
| `log-agent-response` | Agent replies | Log agent output |
| `log-pre-tool` | Before tool execution | Log tool invocation |
| `log-post-tool` | After tool execution | Log tool results |
| `log-error` | Error occurs | Log error details |
| `log-session-end` | Session ends | Finalize logs |

### Session Requirements

**All Copilot sessions MUST have**:
1. A valid task ID
2. A task with an attached workflow
3. A workflow file that exists

Without these, the session will not proceed.

### Workflow Context Injection

When a session starts, the workflow content is injected into the conversation context, providing the agent with:
- Available agents in the workflow
- Handoff syntax and protocols
- Agent-specific instructions
- Exit criteria

### Logging

All session activity is logged to `logs/copilot-sessions/{taskId}/`:
- User prompts
- Agent responses
- Tool executions
- Errors
- Session metadata

---

## API Reference

### Base URL

```
http://localhost:3001
```

### Authentication

Currently, no authentication is required. In production, implement proper authentication.

---

### Tasks

#### List All Tasks

```http
GET /tasks
```

**Response:**
```json
[
  {
    "id": "task-123",
    "name": "Feature Development",
    "description": "Build new feature",
    "workflowFilename": "feature_dev",
    "createdAt": "2026-03-01T10:00:00Z",
    "updatedAt": "2026-03-01T10:00:00Z"
  }
]
```

#### Get Single Task

```http
GET /tasks/:taskId
```

**Response:**
```json
{
  "id": "task-123",
  "name": "Feature Development",
  "description": "Build new feature",
  "workflowFilename": "feature_dev",
  "createdAt": "2026-03-01T10:00:00Z",
  "updatedAt": "2026-03-01T10:00:00Z"
}
```

#### Create Task

```http
POST /tasks
Content-Type: application/json

{
  "name": "New Task",
  "description": "Task description",
  "workflowFilename": "workflow_name"
}
```

**Response:**
```json
{
  "id": "task-456",
  "name": "New Task",
  "description": "Task description",
  "workflowFilename": "workflow_name",
  "createdAt": "2026-03-01T12:00:00Z",
  "updatedAt": "2026-03-01T12:00:00Z"
}
```

#### Update Task

```http
PATCH /tasks/:taskId
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

#### Delete Task

```http
DELETE /tasks/:taskId
```

**Response:**
```json
{
  "message": "Task deleted",
  "id": "task-123"
}
```

---

### History

#### Get All History

```http
GET /history
```

**Response:**
```json
[
  {
    "taskId": "task-123",
    "createdAt": "2026-03-01T10:00:00Z",
    "updatedAt": "2026-03-01T10:30:00Z",
    "conversations": [...]
  }
]
```

#### Get Task History

```http
GET /history/:taskId
```

**Response:**
```json
{
  "taskId": "task-123",
  "createdAt": "2026-03-01T10:00:00Z",
  "updatedAt": "2026-03-01T10:30:00Z",
  "conversations": [
    {
      "taskId": "task-123",
      "terminalId": "uuid",
      "terminalName": "coder-terminal",
      "agentName": "coder",
      "eventType": "stop",
      "role": "assistant",
      "message": "Feature implemented successfully",
      "timestamp": "2026-03-01T10:25:00Z",
      "metadata": {}
    }
  ]
}
```

---

### Sessions

#### Map Session to Task

```http
POST /session/:sessionId/task
Content-Type: application/json

{
  "taskId": "task-123"
}
```

**Response:**
```json
{
  "sessionId": "session-456",
  "taskId": "task-123",
  "message": "Session mapped to task"
}
```

#### Get Session Task

```http
GET /session/:sessionId/task
```

**Response:**
```json
{
  "sessionId": "session-456",
  "taskId": "task-123"
}
```

---

### Terminals

#### List Terminals

```http
GET /terminals
```

**Response:**
```json
[
  {
    "id": "uuid",
    "taskId": "task-123",
    "name": "coder-terminal",
    "isAgent": true,
    "buffer": "Terminal output...",
    "alive": true
  }
]
```

#### Get Terminal Context

```http
GET /context/terminal/:terminalId
```

**Response:**
```json
{
  "taskId": "task-123",
  "terminalName": "coder-terminal",
  "agentName": "coder"
}
```

---

### Workflows

#### List Workflows

```http
GET /workflows
```

**Response:**
```json
[
  {
    "filename": "comedy_show",
    "name": "Comedy Show",
    "description": "Multi-agent joke creation"
  }
]
```

#### Get Workflow Content

```http
GET /workflows/:workflowName
```

**Response:**
```json
{
  "filename": "comedy_show",
  "content": "# Agent Workflow...(full markdown)"
}
```

---

### WebSocket Events

#### Connection

```javascript
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected');
});
```

#### Terminal Events

**Create Terminal:**
```javascript
socket.emit('terminal:create', {
  taskId: 'task-123',
  name: 'my-terminal',
  agentName: 'coder'
});
```

**Send Input:**
```javascript
socket.emit('terminal:input', {
  id: 'terminal-uuid',
  input: 'command\n'
});
```

**Receive Output:**
```javascript
socket.on('terminal:data', (data) => {
  console.log(data.data);
});
```

**Terminal Exit:**
```javascript
socket.on('terminal:exit', (data) => {
  console.log('Terminal exited:', data.code);
});
```

---

## Advanced Usage

### Custom Agent Development

#### Agent Structure

Agents should:
1. Read task context
2. Execute their role
3. Generate appropriate output
4. Use handoff syntax when needed

#### Example Agent Response

```
I've completed the code implementation for the login feature.

The following files were created:
- src/auth/login.ts
- src/auth/types.ts
- tests/auth.test.ts

All tests are passing (12/12).

**Handoff:** @reviewer "Code complete, ready for review"
```

### Extending the Backend

#### Adding New Endpoints

Edit `playground/backend/src/server.ts`:

```typescript
app.get('/custom-endpoint', (req, res) => {
  // Your logic here
  res.json({ message: 'Custom response' });
});
```

#### Adding WebSocket Events

```typescript
io.on('connection', (socket) => {
  socket.on('custom:event', (data) => {
    // Handle custom event
    socket.emit('custom:response', { result: 'data' });
  });
});
```

### Data Persistence

#### Task Data

Tasks are stored as JSON files in `playground/backend/data/`:

```
task-123.json
```

Structure:
```json
{
  "taskId": "task-123",
  "createdAt": "2026-03-01T10:00:00Z",
  "updatedAt": "2026-03-01T10:30:00Z",
  "conversations": [...]
}
```

#### Migration to Database

For production use, migrate from file storage to a database:

1. **PostgreSQL**
   - Create tables for tasks, history, sessions
   - Update backend to use pg driver
   - Implement connection pooling

2. **MongoDB**
   - Use collections for tasks and history
   - Leverage document structure
   - Implement indexes for queries

---

## Troubleshooting

### Backend Issues

#### Backend Won't Start

**Symptom**: `npm run dev` fails or hangs

**Solutions**:
```powershell
# Check Node.js version
node --version  # Should be 18+

# Clear dependencies and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install

# Check port availability
netstat -ano | findstr :3001

# Kill process using port 3001
taskkill /PID <pid> /F
```

#### Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use`

**Solutions**:
```powershell
# Find process using port
Get-NetTCPConnection -LocalPort 3001

# Kill the process
Stop-Process -Id <PID> -Force

# Or use different port
# Edit backend/src/server.ts
const PORT = 3002;
```

### Frontend Issues

#### Connection Status Shows "Disconnected"

**Symptom**: Red dot in header, "Disconnected" text

**Solutions**:
1. Verify backend is running: `http://localhost:3001`
2. Check browser console for errors
3. Verify WebSocket URL in frontend code
4. Check firewall/antivirus isn't blocking connections

#### Tasks Not Loading

**Symptom**: Empty task sidebar

**Solutions**:
1. Check backend console for errors
2. Verify `data/` directory exists
3. Test API manually:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:3001/tasks
   ```
4. Check browser network tab for failed requests

#### Terminal Not Displaying

**Symptom**: xterm.js terminal doesn't appear

**Solutions**:
1. Check browser console for xterm errors
2. Verify xterm.js CDN is accessible
3. Check CSS for display issues
4. Test in different browser

### Workflow Issues

#### Workflow Not Found

**Symptom**: Error when creating task or starting session

**Solutions**:
1. Verify workflow file exists:
   ```powershell
   Test-Path playground/workflows/workflow_name.md
   ```
2. Check filename matches exactly (case-sensitive)
3. Ensure file has `.md` extension
4. Validate workflow syntax

#### Handoff Not Working

**Symptom**: Agent doesn't transfer control

**Solutions**:
1. Verify handoff syntax: `**Handoff:** @agent "message"`
2. Check agent name matches workflow definition
3. Ensure handoff is on its own line
4. Check logs for handoff detection errors

### GitHub Copilot Integration Issues

#### Session Not Mapping to Task

**Symptom**: Prompted for task ID every time

**Solutions**:
1. Verify environment variable:
   ```powershell
   $env:GITHUB_COPILOT_SESSION_ID
   ```
2. Check session mapping:
   ```powershell
   Invoke-RestMethod "http://localhost:3001/session/$env:GITHUB_COPILOT_SESSION_ID/task"
   ```
3. Re-run setup script:
   ```powershell
   .\scripts\setup-task.ps1
   ```

#### Hooks Not Executing

**Symptom**: No logging/validation occurring

**Solutions**:
1. Verify hooks are configured in Copilot settings
2. Check hook script permissions:
   ```powershell
   Get-ExecutionPolicy
   # Should be RemoteSigned or Unrestricted
   ```
3. Test hook manually:
   ```powershell
   .\scripts\copilot-hooks\log-session-start.ps1
   ```

### Performance Issues

#### Slow Task Loading

**Solutions**:
- Reduce history file size (archive old entries)
- Implement pagination for large histories
- Use database instead of file storage
- Enable gzip compression on backend

#### High Memory Usage

**Solutions**:
- Limit terminal buffer sizes
- Close inactive terminals
- Implement terminal cleanup logic
- Monitor backend memory usage

---

## Best Practices

### Task Organization

1. **Use descriptive names**: "Implement OAuth Login" not "Task 1"
2. **Add detailed descriptions**: Include requirements, context, goals
3. **Choose appropriate workflows**: Match workflow to task type
4. **Archive completed tasks**: Keep active task list manageable

### Workflow Design

1. **Keep agents focused**: Each agent has clear, limited role
2. **Define explicit handoffs**: No ambiguity in transitions
3. **Set clear exit criteria**: Know when workflow completes
4. **Document agent responsibilities**: Include in workflow file

### Development Workflow

1. **Use version control**: Commit workflows and configurations
2. **Test workflows**: Validate handoff chains before deploying
3. **Monitor logs**: Check `logs/` directory regularly
4. **Backup data**: Regular backups of `data/` directory

---

## Frequently Asked Questions

### General

**Q: Can I use this without GitHub Copilot?**  
A: Yes! The web UI and API work independently. Copilot integration is optional.

**Q: Is this production-ready?**  
A: Currently designed for development/testing. For production, add authentication, database, error handling, and monitoring.

**Q: Can I have multiple workflows per task?**  
A: No, each task has one workflow. Create multiple tasks for different workflows.

### Technical

**Q: What happens if an agent crashes?**  
A: The terminal exit event is captured. Check logs for details. The workflow may need manual recovery.

**Q: Can agents run in parallel?**  
A: Yes, agents in separate terminals can run concurrently. Handoffs are sequential within a workflow.

**Q: How do I add a new agent?**  
A: Define the agent in a workflow, implement its behavior, and use the handoff protocol.

### Integration

**Q: Can I integrate with other AI models?**  
A: Yes, the system is model-agnostic. Implement adapters for different AI providers.

**Q: Does this work with Azure OpenAI?**  
A: The architecture supports any API-compatible AI service. Configure endpoints accordingly.

---

## Support and Resources

### Documentation
- [Project README](README.md)
- [Agent Session Workflow](docs/agent-session-workflow.md)
- [Task Setup Guide](docs/task-setup-guide.md)
- [API Documentation](playground/backend/API.md)

### Community
- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share workflows
- Wiki: Community-maintained guides and tips

### Development
- TypeScript documentation
- Socket.IO documentation
- xterm.js documentation
- node-pty documentation

---

**Last Updated**: March 2026 | **Version**: 1.0.0
