import * as fs from 'fs';
import * as path from 'path';

export interface WorkflowHandoff {
  fromAgent: string;
  toAgent: string;
  condition: string;
}

export interface WorkflowData {
  filename: string;
  description: string;
  handoffChain: WorkflowHandoff[];
}

export interface WorkflowListItem {
  filename: string;
  description: string;
}

/**
 * Manages workflow markdown files in .playground/workflows/ directory
 */
export class WorkflowManager {
  private readonly workflowDir: string;
  private workflowCache: Map<string, WorkflowData>;

  constructor() {
    // Store workflows in .playground/workflows/
    this.workflowDir = path.resolve(process.cwd(), '../../.playground/workflows');
    if (!fs.existsSync(this.workflowDir)) {
      fs.mkdirSync(this.workflowDir, { recursive: true });
    }

    // Initialize cache and load all workflows
    this.workflowCache = new Map();
    this._loadAllWorkflows();
  }

  /**
   * Load all workflows from disk into memory cache (eager loading on startup)
   */
  private _loadAllWorkflows(): void {
    if (!fs.existsSync(this.workflowDir)) {
      return;
    }

    const files = fs.readdirSync(this.workflowDir);
    for (const file of files) {
      if (!file.endsWith('.md') || file === 'sample-workflow.md') {
        continue;
      }

      const filename = file.replace('.md', '');
      const filePath = path.join(this.workflowDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const workflowData = this._parseMarkdown(filename, content);
        this.workflowCache.set(filename, workflowData);
      } catch (err) {
        console.error(`[WorkflowManager] Error loading workflow ${filename}:`, err);
      }
    }

  }

  /**
   * Create a new workflow markdown file (add to memory, then save to disk)
   */
  createWorkflow(filename: string, data: Omit<WorkflowData, 'filename'>): void {
    const sanitized = this._sanitizeFilename(filename);
    const filePath = this._filePath(sanitized);

    if (this.workflowCache.has(sanitized)) {
      throw new Error(`Workflow '${sanitized}' already exists`);
    }

    const workflowData: WorkflowData = {
      filename: sanitized,
      ...data
    };

    // Add to memory cache first
    this.workflowCache.set(sanitized, workflowData);
    
    // Then persist to disk
    const content = this._generateMarkdown(data);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Get a workflow by filename (read from memory cache)
   */
  getWorkflow(filename: string): WorkflowData | null {
    const sanitized = this._sanitizeFilename(filename);
    return this.workflowCache.get(sanitized) || null;
  }

  /**
   * Update an existing workflow (update memory, then save to disk)
   */
  updateWorkflow(filename: string, data: Omit<WorkflowData, 'filename'>): void {
    const sanitized = this._sanitizeFilename(filename);
    const filePath = this._filePath(sanitized);

    if (!this.workflowCache.has(sanitized)) {
      throw new Error(`Workflow '${sanitized}' does not exist`);
    }

    const workflowData: WorkflowData = {
      filename: sanitized,
      ...data
    };

    // Update memory cache first
    this.workflowCache.set(sanitized, workflowData);
    
    // Then persist to disk
    const content = this._generateMarkdown(data);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Delete a workflow (remove from memory, then delete from disk)
   */
  deleteWorkflow(filename: string): void {
    const sanitized = this._sanitizeFilename(filename);
    const filePath = this._filePath(sanitized);

    if (!this.workflowCache.has(sanitized)) {
      throw new Error(`Workflow '${sanitized}' does not exist`);
    }

    // Remove from memory cache first
    const cachedWorkflow = this.workflowCache.get(sanitized);
    this.workflowCache.delete(sanitized);
    
    try {
      // Then delete from disk
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`[WorkflowManager] Error deleting workflow ${sanitized}:`, err);
      // Restore to cache if disk delete failed
      if (cachedWorkflow) {
        this.workflowCache.set(sanitized, cachedWorkflow);
      }
      throw err;
    }
  }

  /**
   * List all workflows (read from memory cache)
   */
  listWorkflows(): WorkflowListItem[] {
    const workflows: WorkflowListItem[] = [];

    for (const workflow of this.workflowCache.values()) {
      workflows.push({
        filename: workflow.filename,
        description: workflow.description,
      });
    }

    return workflows.sort((a, b) => a.filename.localeCompare(b.filename));
  }

  /**
   * Generate markdown content from workflow data
   */
  private _generateMarkdown(data: Omit<WorkflowData, 'filename'>): string {
    let markdown = `# Agent Workflow & Handoff Protocol\n\n`;
    markdown += `${data.description}\n\n`;
    markdown += `## How Handoffs Work\n\n`;
    markdown += `The **Handoff:** format is how you **invoke/call other agents** as subagents or team members to continue the workflow.\n\n`;
    markdown += `**Format:** \`**Handoff:** @agent-name "message about what you did"\`\n\n`;
    markdown += `This is an **ACTION** - writing this line will trigger the specified agent to execute the next step.\n\n`;
    markdown += `## Agent Handoff Chain\n\n`;
    markdown += `| From Agent | To Agent | Condition | Handoff Format |\n`;
    markdown += `|------------|----------|-----------|----------------|`;

    for (const handoff of data.handoffChain) {
      const handoffFormat = `\`**Handoff:** @${handoff.toAgent} "[message]"\``;
      markdown += `\n| **${handoff.fromAgent}** | ${handoff.toAgent} | ${handoff.condition} | ${handoffFormat} |`;
    }

    markdown += `\n\n`;
    
    // Add Standard Workflow visualization
    markdown += `## Standard Workflow\n\n`;
    markdown += `\`\`\`\n`;
    markdown += this._generateFlowVisualization(data.handoffChain);
    markdown += `\`\`\`\n`;

    return markdown;
  }

  /**
   * Generate ASCII flow visualization with support for branching
   */
  private _generateFlowVisualization(handoffChain: WorkflowHandoff[]): string {
    if (handoffChain.length === 0) return '';

    // Group handoffs by "from agent" to detect branches
    const handoffMap = new Map<string, WorkflowHandoff[]>();
    for (const handoff of handoffChain) {
      if (!handoffMap.has(handoff.fromAgent)) {
        handoffMap.set(handoff.fromAgent, []);
      }
      handoffMap.get(handoff.fromAgent)!.push(handoff);
    }

    let flow = '';
    const startAgent = handoffChain[0].fromAgent;
    const visited = new Set<string>();
    const inProgress = new Set<string>();

    const processAgent = (agent: string, depth: number = 0): void => {
      // Prevent infinite loops
      if (depth > 10) return;
      
      // Check for cycles
      if (inProgress.has(agent)) {
        flow += `@${agent} (cycle)\n`;
        return;
      }

      // Mark as being processed
      inProgress.add(agent);

      // Add agent
      if (!visited.has(agent)) {
        flow += `@${agent}\n`;
        visited.add(agent);
      }

      // Get all handoffs from this agent
      const handoffs = handoffMap.get(agent) || [];
      
      if (handoffs.length === 0) {
        // No more handoffs
        inProgress.delete(agent);
        return;
      } else if (handoffs.length === 1) {
        // Single path
        const handoff = handoffs[0];
        const condition = handoff.condition.toLowerCase();
        if (condition === 'always') {
          flow += `  ↓\n`;
        } else {
          flow += `  ↓ (${condition})\n`;
        }
        
        // Check if target was already visited (cycle)
        if (visited.has(handoff.toAgent)) {
          flow += `@${handoff.toAgent} (cycle back)\n`;
        } else {
          processAgent(handoff.toAgent, depth + 1);
        }
      } else {
        // Multiple paths - show branches side by side
        const columns: Array<{ arrow: string; agent: string; handoff: WorkflowHandoff }> = [];
        
        for (const handoff of handoffs) {
          const condition = handoff.condition.toLowerCase();
          let arrow = '';
          if (condition === 'always') {
            arrow = '  ↓';
          } else {
            arrow = `  ↓ (${condition})`;
          }
          columns.push({
            arrow,
            agent: `@${handoff.toAgent}`,
            handoff
          });
        }
        
        // Calculate column widths
        const columnWidths = columns.map(col => 
          Math.max(col.arrow.length, col.agent.length)
        );
        
        // Build arrow line
        const arrowLine = columns.map((col, idx) => 
          col.arrow.padEnd(columnWidths[idx], ' ')
        ).join('     ');
        
        // Build agent line
        const agentLine = columns.map((col, idx) => {
          const cycleNote = visited.has(col.handoff.toAgent) ? ' (cycle)' : '';
          return (col.agent + cycleNote).padEnd(columnWidths[idx], ' ');
        }).join('     ');
        
        flow += arrowLine + '\n';
        flow += agentLine + '\n';
        
        // Process each branch target if not visited
        for (const col of columns) {
          if (!visited.has(col.handoff.toAgent)) {
            visited.add(col.handoff.toAgent);
            // Check if this agent has further handoffs
            const nextHandoffs = handoffMap.get(col.handoff.toAgent) || [];
            if (nextHandoffs.length > 0) {
              flow += `  ↓\n`;
              processAgent(col.handoff.toAgent, depth + 1);
            }
          }
        }
      }

      inProgress.delete(agent);
    };

    processAgent(startAgent);
    return flow;
  }

  /**
   * Parse markdown content to extract workflow data
   */
  private _parseMarkdown(filename: string, content: string): WorkflowData {
    const lines = content.split('\n');
    let description = '';
    const handoffChain: WorkflowHandoff[] = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Extract description (text between first # and ## Agent Handoff Chain)
      if (line.startsWith('# ') && i === 0) {
        // Skip the title line
        continue;
      }

      if (line.startsWith('## Agent Handoff Chain')) {
        inTable = true;
        continue;
      }

      if (!inTable && line && !line.startsWith('#')) {
        description += (description ? ' ' : '') + line;
      }

      // Parse table rows - support both 3 and 4 column formats
      if (inTable && line.startsWith('|') && !line.includes('From Agent')) {
        if (line.includes('---')) continue; // Skip separator line
        
        const parts = line.split('|').map(p => p.trim()).filter(p => p);
        if (parts.length >= 3) {
          handoffChain.push({
            fromAgent: parts[0].replace(/\*\*/g, '').trim(),
            toAgent: parts[1].replace(/`/g, '').trim(),
            condition: parts[2].trim(),
          });
        }
      }
    }

    return {
      filename,
      description: description.trim(),
      handoffChain,
    };
  }

  /**
   * Sanitize filename and ensure .md extension
   */
  private _sanitizeFilename(filename: string): string {
    // Remove .md extension if provided
    let sanitized = filename.replace(/\.md$/i, '');
    
    // Replace invalid characters with hyphens
    sanitized = sanitized.replace(/[^a-zA-Z0-9_\-]/g, '-');
    
    // Remove consecutive hyphens
    sanitized = sanitized.replace(/-+/g, '-');
    
    // Remove leading/trailing hyphens
    sanitized = sanitized.replace(/^-+|-+$/g, '');
    
    return sanitized;
  }

  /**
   * Get file path for a workflow
   */
  private _filePath(filename: string): string {
    return path.join(this.workflowDir, `${filename}.md`);
  }
}
