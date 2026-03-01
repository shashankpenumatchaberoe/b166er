// MUST be imported first to suppress node-pty Windows warnings
import './suppress-console-warnings';

import express, { json } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as path from 'path';
import { config } from './config';
import { TerminalManager } from './terminal/TerminalManager';
import { HistoryManager } from './history/HistoryManager';
import { CopilotAdapter } from './hooks/adapters/CopilotAdapter';
import { OrchestratorService } from './orchestrator/OrchestratorService';
import { HookEventPayload } from './hooks/types';
import { SessionTaskManager } from './session/SessionTaskManager';
import { SessionInitializer } from './session/SessionInitializer';
import { TerminalMappingManager } from './copilot/TerminalMappingManager';
import googlePageApi from './googlePageApi';
import { WorkflowManager } from './workflow/WorkflowManager';
import { AgentManager } from './agents/AgentManager';
import { WorkflowValidator } from './workflow/WorkflowValidator';
import { TaskManager } from './task/TaskManager';
import { createTaskWorkflowValidator } from './middleware/taskWorkflowValidator';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Socket.IO server-level error handling
io.engine.on('connection_error', (err) => {
  console.error('[Socket.IO] Connection error:', err);
});

app.use(cors());
app.use(express.json());

// --- Serve frontend ---
const frontendDir = path.resolve(__dirname, '../../frontend');
app.use(express.static(frontendDir));

// --- Service wiring ---
const historyManager = new HistoryManager();

const orchestratorService = new OrchestratorService();
const copilotAdapter = new CopilotAdapter();
const workflowManager = new WorkflowManager();
const agentManager = new AgentManager();
const taskManager = new TaskManager();
const terminalMappingManager = new TerminalMappingManager('.copilot-terminals.json', taskManager, workflowManager);
const sessionTaskManager = new SessionTaskManager(config.dataDir, taskManager);
const sessionInitializer = new SessionInitializer(taskManager, workflowManager, sessionTaskManager);

// Track active sessions (for agents to query)
// Key: sessionId, Value: { sessionId, timestamp, taskId }
const activeSessions = new Map<string, { sessionId: string; timestamp: Date; taskId?: string }>();

// Middleware
const requireTaskWorkflow = createTaskWorkflowValidator(taskManager, workflowManager);

const terminalManager = new TerminalManager(io, async (taskId, terminalId, buffer) => {
  await orchestratorService.notify(taskId, terminalId, buffer);
  // History is now populated via Copilot hooks, not terminal end events
});


// --- REST endpoints ---

app.get('/package-info', (_req, res) => {
  try {
    const pkg = require('../../../package.json');
    res.json({ name: pkg.name || 'MAX' });
  } catch (err) {
    res.json({ name: 'MAX' });
  }
});

app.get('/terminals', (_req, res) => {
  res.json(terminalManager.getAll());
});

app.get('/history', (_req, res) => {
  const allHistory = historyManager.getAll();
  res.json(allHistory);
});

app.get('/history/debug/status', (_req, res) => {
  try {
    const allHistory = historyManager.getAll();
    const fs = require('fs');
    const path = require('path');
    
    const dataDir = config.dataDir;
    const dataDirExists = fs.existsSync(dataDir);
    const files = dataDirExists ? fs.readdirSync(dataDir).filter((f: string) => f.endsWith('.json')) : [];
    
    res.json({
      dataDirectory: dataDir,
      dataDirExists,
      totalHistoryFiles: files.length,
      files: files,
      loadedHistories: allHistory.length,
      histories: allHistory.map(h => ({
        taskId: h.taskId,
        conversationCount: h.conversations.length,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
        lastMessage: h.conversations[h.conversations.length - 1]?.message?.substring(0, 100) || 'N/A'
      }))
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.get('/history/:taskId', (req, res) => {
  const history = historyManager.get(req.params.taskId);
  if (!history) {
    res.status(404).json({ error: 'Task history not found.' });
    return;
  }
  res.json(history);
});

app.patch('/history/:taskId/:index', (req, res) => {
  const entryIndex = Number(req.params.index);
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (!Number.isInteger(entryIndex) || entryIndex < 0) {
    res.status(400).json({ error: 'Invalid history index.' });
    return;
  }

  if (!message) {
    res.status(400).json({ error: 'Message is required.' });
    return;
  }

  const updated = historyManager.updateMessage(req.params.taskId, entryIndex, message);
  if (!updated) {
    res.status(404).json({ error: 'Task or history entry not found.' });
    return;
  }

  res.json(updated);
});

app.delete('/history/:taskId/:index', (req, res) => {
  const entryIndex = Number(req.params.index);

  if (!Number.isInteger(entryIndex) || entryIndex < 0) {
    res.status(400).json({ error: 'Invalid history index.' });
    return;
  }

  const updated = historyManager.deleteEntry(req.params.taskId, entryIndex);
  if (!updated) {
    res.status(404).json({ error: 'Task or history entry not found.' });
    return;
  }

  res.json(updated);
});


// --- Terminal context endpoint (for playground terminal task mapping) ---

app.get('/context/terminal/:terminalId', async (req, res) => {
  const record = terminalManager.getRecord(req.params.terminalId);
  if (!record) {
    res.status(404).json({ error: 'Terminal not found or no task associated' });
    return;
  }

  // Get workflow filename for the task
  let workflowFilename = null;
  try {
    workflowFilename = await taskManager.getWorkflow(record.taskId);
  } catch (err) {
    console.warn('[GET /context/terminal/:terminalId] Failed to get workflow:', err);
  }

  res.json({
    taskId: record.taskId,
    terminalName: record.name,
    agentName: deriveAgentNameFromTerminalName(record.name),
    workflowFilename: workflowFilename || undefined,
  });
});

// --- Session-Task mapping endpoints (for VS Code Copilot sessions) ---

app.get('/session/:sessionId/task', async (req, res) => {
  try {
    const taskId = await sessionTaskManager.getTaskId(req.params.sessionId);
    if (!taskId) {
      res.status(404).json({ error: 'No task mapped for this session' });
      return;
    }
    
    // Get workflow filename for the task
    const workflowFilename = await sessionTaskManager.getWorkflowFilename(req.params.sessionId);
    
    res.json({ 
      sessionId: req.params.sessionId, 
      taskId,
      workflowFilename: workflowFilename || undefined
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /session/:sessionId/task] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/session/:sessionId/task', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const taskId = typeof req.body?.taskId === 'string' ? req.body.taskId.trim() : '';
    if (!taskId) {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }
    
    await sessionTaskManager.setTaskId(sessionId, taskId);
    
    res.json({ sessionId, taskId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /session/:sessionId/task] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.delete('/session/:sessionId/task', async (req, res) => {
  try {
    await sessionTaskManager.removeSession(req.params.sessionId);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DELETE /session/:sessionId/task] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/sessions', async (_req, res) => {
  try {
    const sessions = await sessionTaskManager.getAll();
    res.json(sessions);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /sessions] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/pending-task', async (_req, res) => {
  try {
    const pendingTasks = await sessionTaskManager.getAllPendingTasks();
    res.json({ 
      pendingTasks,
      count: pendingTasks.length,
      // Legacy compatibility
      pendingTaskId: pendingTasks.length > 0 ? pendingTasks[0] : null
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /pending-task] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/session/latest', (_req, res) => {
  try {
    if (activeSessions.size === 0) {
      res.status(404).json({ error: 'No active sessions found' });
      return;
    }
    
    // Clean up stale sessions (older than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    for (const [sessionId, session] of activeSessions.entries()) {
      if (session.timestamp < fiveMinutesAgo) {
        activeSessions.delete(sessionId);
      }
    }
    
    if (activeSessions.size === 0) {
      res.status(404).json({ error: 'No recent active sessions' });
      return;
    }
    
    // Return the most recently active session
    const mostRecent = Array.from(activeSessions.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    res.json(mostRecent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /session/latest] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/session/active', (_req, res) => {
  try {
    // Clean up stale sessions first
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    for (const [sessionId, session] of activeSessions.entries()) {
      if (session.timestamp < fiveMinutesAgo) {
        activeSessions.delete(sessionId);
      }
    }
    
    // Return all active sessions
    const sessions = Array.from(activeSessions.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    res.json({
      count: sessions.length,
      sessions
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /session/active] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/session/:sessionId/initialize', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { promptForTask } = req.body;
    
    const result = await sessionInitializer.initialize(sessionId, promptForTask || false);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /session/:sessionId/initialize] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/session/:sessionId/map', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { taskId } = req.body;
    
    if (!taskId) {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }
    
    const result = await sessionInitializer.mapSession(sessionId, taskId);
    
    if (!result.success) {
      res.status(422).json({ error: result.error });
      return;
    }
    
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /session/:sessionId/map] Error:', message);
    res.status(500).json({ error: message });
  }
});

// --- Terminal-Task mapping endpoints (for Copilot CLI hooks) ---

app.get('/copilot/terminal/:terminalId/task', async (req, res) => {
  try {
    const taskId = terminalMappingManager.getTaskId(req.params.terminalId);
    if (!taskId) {
      res.status(404).json({ error: 'No task mapped for this terminal' });
      return;
    }
    
    // Get workflow filename for the task
    const workflowFilename = await taskManager.getWorkflow(taskId);
    
    res.json({ 
      terminalId: req.params.terminalId, 
      taskId,
      workflowFilename: workflowFilename || undefined
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /copilot/terminal/:terminalId/task] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/copilot/terminal/:terminalId/task', async (req, res) => {
  try {
    const taskId = typeof req.body?.taskId === 'string' ? req.body.taskId.trim() : '';
    const terminalName = typeof req.body?.terminalName === 'string' ? req.body.terminalName : undefined;
    
    if (!taskId) {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }
    
    // Use validation method to ensure task has workflow
    const result = await terminalMappingManager.registerWithValidation(
      req.params.terminalId,
      taskId,
      terminalName
    );
    
    if (!result.success) {
      res.status(422).json({ error: result.error });
      return;
    }
    
    res.json({ 
      terminalId: req.params.terminalId, 
      taskId: result.taskId,
      workflowFilename: result.workflowFilename
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /copilot/terminal/:terminalId/task] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.delete('/copilot/terminal/:terminalId/task', (req, res) => {
  try {
    terminalMappingManager.unregister(req.params.terminalId);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DELETE /copilot/terminal/:terminalId/task] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/copilot/terminals', (_req, res) => {
  try {
    const mappings = terminalMappingManager.getAll();
    res.json(mappings);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /copilot/terminals] Error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * Filter events for history persistence.
 * History stores only user prompts and bot responses for retrospection and skill-building.
 * Full event stream (including pre_tool_use, session_start/end, errors) remains in log files.
 */
function shouldSaveToHistory(eventType: string, data?: any): boolean {
  // Save user prompts and agent responses
  if (eventType === 'user_prompt' || eventType === 'agent_response') {
    return true;
  }
  
  // For post_tool_use, only save subagent invocations (task tool with agent_type)
  if (eventType === 'post_tool_use') {
    return (data?.toolName === "task" && data?.toolArgs?.agent_type) || data?.toolName === "read_agent";
  }
  
  return false;
}

app.post('/copilot/event', requireTaskWorkflow, (req, res) => {
  try {
    const { terminalId, taskId, eventType, data } = req.body;

    if (!terminalId || !taskId || !eventType) {
      res.status(400).json({ error: 'terminalId, taskId, and eventType are required' });
      return;
    }

    // Convert Copilot hook event to ConversationEntry format
    const timestamp = new Date().toISOString();
    let role: 'user' | 'assistant' | 'system' | 'tool' | 'event' = 'event';
    let message = '';
    const metadata: Record<string, unknown> = { ...data, eventType };

    switch (eventType) {
      case 'session_start':
        role = 'system';
        message = `Copilot session started in ${data.cwd || 'unknown directory'}`;
        break;

      case 'user_prompt':
        role = 'user';
        message = data.prompt || '';
        break;

      case 'agent_response':
        role = 'assistant';
        message = data.message || '';
        metadata.agentName = data.agentName || 'GitHub Copilot';
        break;

      case 'post_tool_use':
        role = 'assistant';
        message = `Used tool: ${data.toolName}\n\nResult: ${JSON.stringify(data.toolResult, null, 2)}`;
        break;

      case 'error':
        role = 'system';
        message = `Error: ${data.errorMessage || data.error || 'Unknown error'}`;
        break;

      case 'session_end':
        role = 'system';
        message = 'Copilot session ended';
        break;

      default:
        role = 'event';
        message = `${eventType}: ${JSON.stringify(data)}`;
    }

    const entry = {
      taskId,
      terminalId,
      terminalName: data.terminalName || 'copilot-cli',
      agentName: 'GitHub Copilot',
      eventType,
      role,
      message,
      timestamp,
      metadata,
    };

    // Save only user prompts and bot responses to history for retrospection.
    // Internal events (pre_tool_use, session_start/end, errors) are logged to files but not stored in history.
    // For post_tool_use, only save subagent invocations (task tool with agent_type)
    const shouldSave = shouldSaveToHistory(eventType, data);
    
    if (shouldSave) {
      historyManager.upsert(taskId, entry);
      
      // Emit real-time update to connected clients
      io.emit('history:updated', {
        taskId,
        entry,
        timestamp: new Date().toISOString()
      });
    }

    // Track active session (for agents to query)
    if (data.sessionId) {
      activeSessions.set(data.sessionId, {
        sessionId: data.sessionId,
        timestamp: new Date(),
        taskId
      });
    }

    res.json({ ok: true, saved: eventType, persisted: shouldSave });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /copilot/event] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/pending-task', async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId || typeof taskId !== 'string') {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }
    await sessionTaskManager.setPendingTask(taskId);
    const allPending = await sessionTaskManager.getAllPendingTasks();
    res.json({ 
      success: true, 
      taskId,
      pendingTasks: allPending,
      position: allPending.indexOf(taskId) + 1
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /pending-task] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.delete('/pending-task', async (_req, res) => {
  try {
    await sessionTaskManager.clearPendingTask();
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DELETE /pending-task] Error:', message);
    res.status(500).json({ error: message });
  }
});

// --- Workflow Management endpoints ---

app.get('/workflows', (_req, res) => {
  try {
    const workflows = workflowManager.listWorkflows();
    res.json(workflows);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /workflows] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/workflows/:filename', (req, res) => {
  try {
    const workflow = workflowManager.getWorkflow(req.params.filename);
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json(workflow);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /workflows/:filename] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/workflows', (req, res) => {
  try {
    const { filename, description, handoffChain } = req.body;

    // Validate input
    const agents = agentManager.listAgents();
    const existingWorkflows = workflowManager.listWorkflows().map((w) => w.filename);
    const validation = WorkflowValidator.validate(
      filename,
      description,
      handoffChain,
      agents,
      existingWorkflows,
      false
    );

    if (!validation.valid) {
      res.status(400).json({ errors: validation.errors });
      return;
    }

    workflowManager.createWorkflow(filename, { description, handoffChain });
    res.status(201).json({ success: true, filename });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /workflows] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.put('/workflows/:filename', (req, res) => {
  try {
    const { description, handoffChain } = req.body;
    const filename = req.params.filename;

    // Validate input
    const agents = agentManager.listAgents();
    const existingWorkflows = workflowManager.listWorkflows().map((w) => w.filename);
    const validation = WorkflowValidator.validate(
      filename,
      description,
      handoffChain,
      agents,
      existingWorkflows,
      true
    );

    if (!validation.valid) {
      res.status(400).json({ errors: validation.errors });
      return;
    }

    workflowManager.updateWorkflow(filename, { description, handoffChain });
    res.json({ success: true, filename });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[PUT /workflows/:filename] Error:', message);
    
    if (message.includes('does not exist')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

app.delete('/workflows/:filename', (req, res) => {
  try {
    workflowManager.deleteWorkflow(req.params.filename);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DELETE /workflows/:filename] Error:', message);
    
    if (message.includes('does not exist')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// --- Agent Management endpoints ---

app.get('/agents', (_req, res) => {
  try {
    const agents = agentManager.listAgents();
    res.json(agents);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /agents] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/agents/:filename', (req, res) => {
  try {
    const agent = agentManager.getAgent(req.params.filename);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json(agent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /agents/:filename] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/agents', (req, res) => {
  try {
    const { filename, name, description, prompt } = req.body;

    // Validate input
    const existingAgents = agentManager.listAgents().map((a) => a.filename);
    const validation = WorkflowValidator.validateAgent(
      filename,
      name,
      description,
      prompt,
      existingAgents,
      false
    );

    if (!validation.valid) {
      res.status(400).json({ errors: validation.errors });
      return;
    }

    agentManager.createAgent(filename, { name, description, prompt });
    res.status(201).json({ success: true, filename });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /agents] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.put('/agents/:filename', (req, res) => {
  try {
    const { name, description, prompt } = req.body;
    const filename = req.params.filename;

    // Validate input
    const existingAgents = agentManager.listAgents().map((a) => a.filename);
    const validation = WorkflowValidator.validateAgent(
      filename,
      name,
      description,
      prompt,
      existingAgents,
      true
    );

    if (!validation.valid) {
      res.status(400).json({ errors: validation.errors });
      return;
    }

    agentManager.updateAgent(filename, { name, description, prompt });
    res.json({ success: true, filename });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[PUT /agents/:filename] Error:', message);
    
    if (message.includes('does not exist')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

app.delete('/agents/:filename', (req, res) => {
  try {
    agentManager.deleteAgent(req.params.filename);
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DELETE /agents/:filename] Error:', message);
    
    if (message.includes('does not exist')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// ──────────────────────────────────────────────────────────────────
// Task Management
// ──────────────────────────────────────────────────────────────────

app.get('/tasks', async (_req, res) => {
  try {
    const tasks = await taskManager.listTasks();
    
    // Enrich tasks with workflow status information
    const enrichedTasks = await Promise.all(
      tasks.map(async (task) => {
        const hasWorkflow = !!task.workflowFilename;
        let workflowValid = false;
        
        if (hasWorkflow) {
          try {
            const workflow = await workflowManager.getWorkflow(task.workflowFilename!);
            workflowValid = !!workflow;
          } catch {
            workflowValid = false;
          }
        }
        
        return {
          ...task,
          hasWorkflow,
          workflowValid
        };
      })
    );
    
    res.json(enrichedTasks);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /tasks] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/tasks/:id', async (req, res) => {
  try {
    const task = await taskManager.getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /tasks/:id] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.post('/tasks', async (req, res) => {
  try {
    const { name, workflowFilename } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'Task name is required' });
      return;
    }

    // Validate workflow exists if provided
    if (workflowFilename) {
      const workflow = workflowManager.getWorkflow(workflowFilename);
      if (!workflow) {
        res.status(400).json({ error: `Workflow "${workflowFilename}" does not exist` });
        return;
      }
    }

    const task = await taskManager.createTask(name.trim(), workflowFilename);
    
    // Initialize empty history file for the new task
    historyManager.initializeHistory(task.id);
    
    // Auto-add to pending queue if task has a workflow
    if (workflowFilename) {
      await sessionTaskManager.setPendingTask(task.id);
    }
    
    res.json(task);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /tasks] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.put('/tasks/:id', async (req, res) => {
  try {
    const { name, workflowFilename } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'Task name is required' });
      return;
    }

    // Validate workflow exists if provided
    if (workflowFilename) {
      const workflow = workflowManager.getWorkflow(workflowFilename);
      if (!workflow) {
        res.status(400).json({ error: `Workflow "${workflowFilename}" does not exist` });
        return;
      }
    }

    const task = await taskManager.updateTask(req.params.id, { name: name.trim(), workflowFilename });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    // Ensure history file exists for this task
    historyManager.initializeHistory(task.id);
    
    res.json(task);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[PUT /tasks/:id] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.patch('/tasks/:id/workflow', async (req, res) => {
  try {
    const { workflowFilename } = req.body;

    // Validate workflow exists if provided
    if (workflowFilename) {
      const workflow = workflowManager.getWorkflow(workflowFilename);
      if (!workflow) {
        res.status(400).json({ error: `Workflow "${workflowFilename}" does not exist` });
        return;
      }
    }

    const task = await taskManager.setWorkflow(req.params.id, workflowFilename || null);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[PATCH /tasks/:id/workflow] Error:', message);
    res.status(500).json({ error: message });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const success = await taskManager.deleteTask(req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DELETE /tasks/:id] Error:', message);
    res.status(500).json({ error: message });
  }
});

// Get task-workflow mappings
app.get('/tasks/mappings/workflows', async (_req, res) => {
  try {
    const mappings = taskManager.getAllWorkflowMappings();
    const stats = taskManager.getWorkflowMapper().getStats();
    res.json({ mappings, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GET /tasks/mappings/workflows] Error:', message);
    res.status(500).json({ error: message });
  }
});

// --- Socket.IO events ---

io.on('connection', (socket) => {
  // Global socket error handler
  socket.on('error', (err) => {
    console.error(`[Socket] Socket error for ${socket.id}:`, err);
  });

  socket.on(
    'terminal:create',
    (data: { 
      taskId: string; 
      name: string; 
      agent?: string;
      userPrompt?: string;
      command?: string;
      isAgent: boolean; 
      cols: number; 
      rows: number;
    }) => {
      try {
        const record = terminalManager.spawn({
          taskId: data.taskId,
          name: data.name,
          agent: data.agent,
          userPrompt: data.userPrompt,
          command: data.command,
          isAgent: data.isAgent,
          cols: data.cols || 80,
          rows: data.rows || 24,
        });
        
        // Auto-register terminal with mapping manager for Copilot CLI hooks
        terminalMappingManager.register(record.id, record.taskId, record.name);
        
        socket.emit('terminal:created', record);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Socket] Error creating terminal:`, message);
        socket.emit('terminal:error', { message });
      }
    }
  );

  socket.on('terminal:input', (data: { id: string; data: string }) => {
    try {
      terminalManager.write(data.id, data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      socket.emit('terminal:error', { message });
    }
  });

  socket.on('terminal:resize', (data: { id: string; cols: number; rows: number }) => {
    try {
      terminalManager.resize(data.id, data.cols, data.rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      socket.emit('terminal:error', { message });
    }
  });

  socket.on('terminal:close', (data: { id: string }) => {
    // Wrap everything in try-catch to absolutely prevent crashes
    (async () => {
      try {
        // Get the terminal record before killing
        const record = terminalManager.getRecord(data.id);
        const taskId = record?.taskId;
        
        // Unregister from mapping manager
        terminalMappingManager.unregister(data.id);
        
        // Kill the terminal process
        terminalManager.kill(data.id);
        
        // Emit agent_exit so frontend removes the terminal UI
        if (taskId) {
          io.emit('terminal:agent_exit', { id: data.id, taskId });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Socket] Error closing terminal:`, message, err);
        try {
          socket.emit('terminal:error', { message });
        } catch (emitErr) {
          console.error(`[Socket] Failed to emit error:`, emitErr);
        }
      }
    })().catch((err) => {
      console.error(`[Socket] Unhandled error in terminal:close handler:`, err);
    });
  });

  socket.on('disconnect', () => {
  });
});

// --- Start ---

httpServer.listen(config.port, () => {
});

// Graceful shutdown
process.on('SIGTERM', () => {
  historyManager.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  historyManager.close();
  process.exit(0);
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log the error
});

function deriveAgentNameFromTerminalName(terminalName: string): string | null {
  const normalized = terminalName.toLowerCase();
  const knownAgents = ['orchestrator', 'coder', 'reviewer', 'test', 'lead'];
  const matchedAgent = knownAgents.find((agent) => normalized.includes(agent));

  return matchedAgent ?? null;
}
