export interface TerminalRecord {
  id: string;       // uuid
  taskId: string;
  name: string;
  isAgent: boolean;
  buffer: string;   // accumulated raw output for replay
  alive: boolean;
}

export interface SpawnOptions {
  taskId: string;
  name: string;
  agent?: string;
  userPrompt?: string;
  command?: string;
  isAgent: boolean;
  cols: number;
  rows: number;
}
