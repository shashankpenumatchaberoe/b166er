# B1-66ER

A multi-agent AI collaboration platform that orchestrates AI agents through structured workflows, enabling coordinated task execution with full conversation tracking and history management.

## 🎯 Overview

B1-66ER is a task-oriented AI agent management system that:

- **Orchestrates Multi-Agent Workflows** - Define agent handoff chains and collaboration patterns
- **Tracks Task History** - Complete conversation and tool execution logs per task
- **Manages Agent Terminals** - Isolated execution environments for each agent
- **Integrates with GitHub Copilot** - Seamless CLI and VSCode integration
- **Real-time UI** - Web-based interface for task management and monitoring
- **Workflow-Driven** - Ensures consistent agent behavior through structured protocols

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **PowerShell** 5.1+ (Windows) or Bash (Linux/Mac)
- **GitHub Copilot** (For CLI integration)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd max-ai-ui
   ```

2. **Install backend dependencies**
   ```bash
   cd playground/backend
   npm install
   ```

3. **Start the backend server**
   ```bash
   npm run dev
   ```
   Backend runs on `http://localhost:3001`

4. **Open the frontend**
   ```bash
   # Open in your browser
   start playground/frontend/index.html
   ```
   Or serve via a local HTTP server:
   ```bash
   npx http-server playground/frontend -p 3000
   ```
   Frontend runs on `http://localhost:3001`

### First Steps

1. **Create a Task**
   - Open the UI at `http://localhost:3001`
   - Click the **+** button in the sidebar
   - Enter task name and description
   - Select a workflow (e.g., `comedy_show`)

2. **Start Working**
   - Select your task from the sidebar
   - The conversation history will load
   - Start interacting with agents

3. **Set Up Copilot Integration** (Optional)
   ```powershell
   .\scripts\setup-task.ps1
   ```
   This maps your Copilot session to a task.

## 📁 Project Structure

```
max-ai-ui/
├── playground/
│   ├── frontend/          # Web UI (HTML/CSS/JS)
│   │   ├── index.html     # Main application
│   │   ├── css/           # Styles
│   │   └── js/            # Client-side logic
│   ├── backend/           # Node.js/Express server
│   │   ├── src/           # TypeScript source
│   │   └── data/          # Task history JSON files
│   └── workflows/         # Agent workflow definitions
├── scripts/               # Setup and utility scripts
│   ├── setup-task.ps1     # Task setup helper
│   └── copilot-hooks/     # GitHub Copilot integration
├── docs/                  # Documentation
│   ├── agent-session-workflow.md
│   └── task-setup-guide.md
└── logs/                  # Session logs
    └── copilot-sessions/
```

## 🔧 Technology Stack

### Frontend
- **HTML5/CSS3/JavaScript** - Pure vanilla JS, no frameworks
- **xterm.js** - Terminal emulation
- **Socket.IO Client** - Real-time WebSocket communication

### Backend
- **Node.js** with TypeScript
- **Express.js** - REST API server
- **Socket.IO** - WebSocket server
- **node-pty** - Terminal process management
- **File-based storage** - JSON files for task/history data

### Integration
- **GitHub Copilot** - CLI hooks and VSCode integration
- **PowerShell/Bash** - System automation scripts

## ✨ Key Features

### 1. Task Management
- Create and organize tasks with descriptions
- Attach workflows to define agent behavior
- Track task creation and update timestamps
- View complete task history

### 2. Workflow System
- Define custom agent handoff chains
- Specify agent roles and responsibilities
- Set conditional logic for agent transitions
- Support for multiple workflow patterns

### 3. Agent Terminals
- Isolated execution environments
- Real-time terminal output streaming
- Agent-specific terminal management
- Terminal state persistence

### 4. History Tracking
- Per-task conversation logs
- User prompts and agent responses
- Tool execution records
- Timestamped entries with metadata

### 5. GitHub Copilot Integration
- Automatic session-to-task mapping
- Workflow context injection
- Hook-based logging system
- CLI and VSCode support

## 🎭 Example Workflow: Comedy Show

The included `comedy_show` workflow demonstrates multi-agent collaboration:

```
@comedian (tells a joke)
    ↓
@heckler (rates the joke)
    ↓ (score < 5)              ↓ (score >= 5)
@comedian (tries again)     @audience (applauds)
                               ↓
                         @comedian (next joke)
```

Agents use handoff syntax: `**Handoff:** @agent-name "message"`

## 📚 Documentation

- **[User Manual](USER_MANUAL.md)** - Comprehensive usage guide
- **[Agent Session Workflow](docs/agent-session-workflow.md)** - Session lifecycle
- **[Task Setup Guide](docs/task-setup-guide.md)** - Copilot integration setup
- **[API Documentation](playground/backend/API.md)** - Backend API reference

## 🛠️ Development

### Running in Development Mode

```bash
# Backend with hot reload
cd playground/backend
npm run dev

# Frontend (use any HTTP server)
npx http-server playground/frontend -p 3000
```

### Building for Production

```bash
cd playground/backend
npm run build
npm start
```

## 🔌 API Endpoints

### Core Endpoints
- `GET /tasks` - List all tasks
- `POST /tasks` - Create a new task
- `GET /history/:taskId` - Get task conversation history
- `GET /terminals` - List active terminals
- `POST /session/:sessionId/task` - Map Copilot session to task

See [API.md](playground/backend/API.md) for complete documentation.

## 🐛 Troubleshooting

### Backend not starting
```bash
# Check if port 3001 is in use
netstat -ano | findstr :3001

# Kill the process and restart
taskkill /PID <pid> /F
npm run dev
```

### WebSocket connection issues
- Ensure backend is running on port 3001
- Check browser console for connection errors
- Verify CORS settings in backend configuration

### Task validation errors
- Ensure task has a workflow attached
- Verify workflow file exists in `playground/workflows/`
- Check task data integrity in `playground/backend/data/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Matrix-inspired UI design
- GitHub Copilot integration framework
- xterm.js terminal emulator
- Socket.IO real-time communication

---

**Project Status**: Active Development | **Version**: 1.0.0 | **Last Updated**: March 2026
