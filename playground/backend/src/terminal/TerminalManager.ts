import * as pty from 'node-pty';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { TerminalRecord, SpawnOptions } from './types';

type AgentExitHandler = (taskId: string, terminalId: string, buffer: string) => Promise<void>;

export class TerminalManager {
  private processes = new Map<string, pty.IPty>();
  private records = new Map<string, TerminalRecord>();
  private io: Server;
  private onAgentExit: AgentExitHandler;

  constructor(io: Server, onAgentExit: AgentExitHandler) {
    this.io = io;
    this.onAgentExit = onAgentExit;
  }

  spawn(options: SpawnOptions): TerminalRecord {
    const { taskId, name, command, isAgent, cols, rows } = options;

    if (isAgent) {
      const agentCount = [...this.records.values()].filter(
        (r) => r.isAgent && r.alive
      ).length;
      if (agentCount >= config.maxAgents) {
        throw new Error(
          `Agent limit reached. Maximum ${config.maxAgents} agent terminals allowed.`
        );
      }
    }

    const duplicate = [...this.records.values()].find(
      (r) => r.taskId === taskId && r.name === name && r.alive
    );
    if (duplicate) {
      throw new Error(
        `Terminal named "${name}" already exists in task "${taskId}".`
      );
    }

    const id = uuidv4();
    // Use PowerShell on Windows for better stability
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    
    // Build shell arguments
    let shellArgs: string[] = [];
    if (process.platform === 'win32') {
      // PowerShell with UTF-8 encoding setup
      if (command) {
        // Execute command with UTF-8 setup
        const utf8Setup = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8';
        shellArgs = ['-NoLogo', '-Command', `${utf8Setup}; ${command}`];
      } else {
        // Interactive shell - just use default with no profile for faster startup
        shellArgs = ['-NoLogo'];
      }
    } else {
      // Bash on Unix systems
      shellArgs = command ? ['-c', command] : [];
    }

    let ptyProcess: pty.IPty;
    try {
      const spawnOptions: any = {
        name: 'xterm-color',
        cols,
        rows,
        cwd: process.cwd(),
        env: {
          ...process.env,
          TERMINAL_ID: id,
        } as Record<string, string>,
      };

      // Windows-specific: use conpty
      if (process.platform === 'win32') {
        spawnOptions.useConpty = true;
        spawnOptions.conptyInheritCursor = false;
      }

      ptyProcess = pty.spawn(shell, shellArgs, spawnOptions);
    } catch (err) {
      console.error(`[TerminalManager] Error spawning PTY for terminal ${name}:`, err);
      throw new Error(`Failed to spawn terminal: ${err instanceof Error ? err.message : String(err)}`);
    }

    const record: TerminalRecord = {
      id,
      taskId,
      name,
      isAgent,
      buffer: '',
      alive: true,
    };

    this.processes.set(id, ptyProcess);
    this.records.set(id, record);

    ptyProcess.onData((data) => {
      try {
        record.buffer += data;
        this.io.emit('terminal:output', { id, data });
      } catch (err) {
        console.error(`[TerminalManager] Error handling data for terminal ${id}:`, err);
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.handleAgentExit(id).catch((err) => {
        console.error(`[TerminalManager] Error handling exit for terminal ${id}:`, err);
      });
    });


    return record;
  }

  write(id: string, data: string): void {
    const process = this.processes.get(id);
    if (!process) {
      throw new Error(`Terminal ${id} not found.`);
    }
    process.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const process = this.processes.get(id);
    if (!process) {
      throw new Error(`Terminal ${id} not found.`);
    }
    process.resize(cols, rows);
  }

  kill(id: string): void {
    const process = this.processes.get(id);
    const record = this.records.get(id);


    // If no record exists, nothing to do
    if (!record) {
      return;
    }

    // Set alive = false FIRST to prevent re-entrance from onExit
    record.alive = false;

    if (process) {
      try {
        process.kill();
      } catch (err) {
        console.error(`[TerminalManager] Error killing process for terminal ${id}:`, err);
      }
      this.processes.delete(id);
    } else {
    }
  }

  getAll(): TerminalRecord[] {
    return [...this.records.values()].filter((r) => r.alive);
  }

  getBuffer(id: string): string {
    const record = this.records.get(id);
    return record?.buffer ?? '';
  }

  getRecord(id: string): TerminalRecord | null {
    return this.records.get(id) ?? null;
  }

  getTaskId(terminalId: string): string | null {
    const record = this.records.get(terminalId);
    return record?.taskId ?? null;
  }

  private async handleAgentExit(id: string): Promise<void> {
    try {
      const record = this.records.get(id);
      if (!record) {
        return;
      }

      // Skip if already cleaned up
      if (!record.alive) {
        return;
      }

      // Mark as not alive to prevent re-entrance
      record.alive = false;


      // Step 1: Capture buffer
      const buffer = record.buffer;

      // Step 2: Notify orchestrator and hooks (in parallel for speed, but sequenced per plan)
      try {
        await this.onAgentExit(record.taskId, id, buffer);
      } catch (err) {
        console.error(`[TerminalManager] Error in onAgentExit for terminal ${id}:`, err);
        // Don't rethrow - continue with cleanup
      }

      // Step 3: Emit agent_exit to all sockets so frontend can remove the terminal UI
      try {
        this.io.emit('terminal:agent_exit', { id, taskId: record.taskId });
      } catch (err) {
        console.error(`[TerminalManager] Error emitting agent_exit for terminal ${id}:`, err);
      }

      // Step 4: Clean up process (if still running)
      const process = this.processes.get(id);
      if (process) {
        try {
          process.kill();
        } catch (err) {
          console.error(`[TerminalManager] Error killing process in handleAgentExit for ${id}:`, err);
        }
        this.processes.delete(id);
      }
    } catch (err) {
      console.error(`[TerminalManager] Unhandled error in handleAgentExit for terminal ${id}:`, err);
      // Ensure we don't crash the server
    }
  }
}
