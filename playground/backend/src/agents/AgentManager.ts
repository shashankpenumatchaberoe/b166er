import * as fs from 'fs';
import * as path from 'path';

export interface AgentData {
  filename: string;
  name: string;
  description: string;
  prompt: string;
}

export interface AgentListItem {
  filename: string;
  name: string;
  description: string;
}

/**
 * Manages agent markdown files in .github/agents/ directory
 */
export class AgentManager {
  private readonly agentDir: string;

  constructor() {
    // Store agents in .github/agents/
    this.agentDir = path.resolve(process.cwd(), '../../.github/agents');
    if (!fs.existsSync(this.agentDir)) {
      fs.mkdirSync(this.agentDir, { recursive: true });
    }
  }

  /**
   * Create a new agent markdown file
   */
  createAgent(filename: string, data: Omit<AgentData, 'filename'>): void {
    const sanitized = this._sanitizeFilename(filename);
    const filePath = this._filePath(sanitized);

    if (fs.existsSync(filePath)) {
      throw new Error(`Agent '${sanitized}' already exists`);
    }

    const content = this._generateMarkdown(data);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Get an agent by filename
   */
  getAgent(filename: string): AgentData | null {
    const sanitized = this._sanitizeFilename(filename);
    const filePath = this._filePath(sanitized);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this._parseMarkdown(sanitized, content);
    } catch {
      return null;
    }
  }

  /**
   * Update an existing agent
   */
  updateAgent(filename: string, data: Omit<AgentData, 'filename'>): void {
    const sanitized = this._sanitizeFilename(filename);
    const filePath = this._filePath(sanitized);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Agent '${sanitized}' does not exist`);
    }

    const content = this._generateMarkdown(data);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Delete an agent
   */
  deleteAgent(filename: string): void {
    const sanitized = this._sanitizeFilename(filename);
    const filePath = this._filePath(sanitized);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Agent '${sanitized}' does not exist`);
    }

    fs.unlinkSync(filePath);
  }

  /**
   * List all agents
   */
  listAgents(): AgentListItem[] {
    if (!fs.existsSync(this.agentDir)) {
      return [];
    }

    return fs
      .readdirSync(this.agentDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const filename = f.replace('.md', '');
        const filePath = path.join(this.agentDir, f);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = this._parseMarkdown(filename, content);
          return {
            filename,
            name: parsed.name,
            description: parsed.description,
          };
        } catch {
          return {
            filename,
            name: filename,
            description: 'Error parsing agent',
          };
        }
      })
      .sort((a, b) => a.filename.localeCompare(b.filename));
  }

  /**
   * Generate markdown content with YAML frontmatter
   */
  private _generateMarkdown(data: Omit<AgentData, 'filename'>): string {
    let markdown = `---\n`;
    markdown += `name: ${data.name}\n`;
    markdown += `description: ${data.description}\n`;
    markdown += `---\n\n`;
    markdown += `##user prompt##\n\n`;
    markdown += data.prompt;
    markdown += `\n\n`;
    
    // Add required task management section
    markdown += `**TASK MANAGEMENT (REQUIRED)**: \n`;
    markdown += `This agent uses the task-management skill located at \`.github/skills/task-management/SKILL.md\`.\n`;
    markdown += `The skill automatically runs at conversation start to check for a task ID + workflow.\n`;
    markdown += `- If valid: Proceeds silently without asking\n`;
    markdown += `- If missing: Asks user to select a task, then registers it via API\n\n`;
    
    // Add critical workflow instructions
    markdown += `**CRITICAL INSTRUCTIONS FOR ALL WORKFLOWS:**\n\n`;
    markdown += `1. **ALWAYS complete your task FIRST** - Show your work to the user\n`;
    markdown += `2. **THEN add the handoff** at the END of your response\n`;
    markdown += `3. **NEVER output ONLY the handoff line** - users need to see your actual work!\n`;
    markdown += `4. **The handoff is an ACTION** - When you write \`**Handoff:** @agent-name "message"\`, you are actively invoking that agent\n\n`;
    markdown += `Example:\n`;
    markdown += `\`\`\`\n`;
    markdown += `[Your agent's actual work output here]\n\n`;
    markdown += `**Handoff:** @next-agent "Context for next agent"\n`;
    markdown += `\`\`\`\n\n`;
    markdown += `**If a workflow is provided in your context, follow its handoff chain exactly.**\n`;

    return markdown;
  }

  /**
   * Parse markdown content to extract agent data
   */
  private _parseMarkdown(filename: string, content: string): AgentData {
    let name = filename;
    let description = '';
    let prompt = '';
    let inFrontmatter = false;
    let inPrompt = false;

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for frontmatter boundaries
      if (line.trim() === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        } else {
          inFrontmatter = false;
          continue;
        }
      }

      // Parse frontmatter
      if (inFrontmatter) {
        if (line.startsWith('name:')) {
          name = line.substring(5).trim();
        } else if (line.startsWith('description:')) {
          description = line.substring(12).trim();
        }
        continue;
      }

      // Check for prompt section
      if (line.trim() === '##user prompt##') {
        inPrompt = true;
        continue;
      }

      // Collect prompt content
      if (inPrompt) {
        prompt += (prompt ? '\n' : '') + line;
      }
    }

    return {
      filename,
      name,
      description,
      prompt: prompt.trim(),
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
   * Get file path for an agent
   */
  private _filePath(filename: string): string {
    return path.join(this.agentDir, `${filename}.md`);
  }
}
