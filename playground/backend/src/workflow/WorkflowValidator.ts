import { WorkflowHandoff } from './WorkflowManager';
import { AgentListItem } from '../agents/AgentManager';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validates workflow data
 */
export class WorkflowValidator {
  /**
   * Validate a workflow before creation/update
   */
  static validate(
    filename: string,
    description: string,
    handoffChain: WorkflowHandoff[],
    existingAgents: AgentListItem[],
    existingWorkflows: string[],
    isUpdate: boolean = false
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate filename
    if (!filename || filename.trim().length === 0) {
      errors.push({
        field: 'filename',
        message: 'Filename is required',
      });
    } else {
      // Check for invalid characters (before sanitization)
      if (!/^[a-zA-Z0-9_\-]+$/.test(filename.replace(/\.md$/i, ''))) {
        errors.push({
          field: 'filename',
          message: 'Filename can only contain letters, numbers, hyphens, and underscores',
        });
      }

      // Check uniqueness (only for create operation)
      if (!isUpdate && existingWorkflows.includes(filename.replace(/\.md$/i, ''))) {
        errors.push({
          field: 'filename',
          message: 'A workflow with this filename already exists',
        });
      }
    }

    // Validate description
    if (!description || description.trim().length === 0) {
      errors.push({
        field: 'description',
        message: 'Description is required',
      });
    }

    // Validate handoff chain
    if (!handoffChain || handoffChain.length === 0) {
      errors.push({
        field: 'handoffChain',
        message: 'At least one handoff rule is required',
      });
    } else {
      // Check agent references
      const agentNames = new Set(existingAgents.map((a) => a.name));

      handoffChain.forEach((handoff, index) => {
        if (!handoff.fromAgent || handoff.fromAgent.trim().length === 0) {
          errors.push({
            field: `handoffChain[${index}].fromAgent`,
            message: `Handoff rule ${index + 1}: "From Agent" is required`,
          });
        } else if (!agentNames.has(handoff.fromAgent)) {
          errors.push({
            field: `handoffChain[${index}].fromAgent`,
            message: `Handoff rule ${index + 1}: Agent "${handoff.fromAgent}" does not exist`,
          });
        }

        if (!handoff.toAgent || handoff.toAgent.trim().length === 0) {
          errors.push({
            field: `handoffChain[${index}].toAgent`,
            message: `Handoff rule ${index + 1}: "To Agent" is required`,
          });
        } else if (!agentNames.has(handoff.toAgent)) {
          errors.push({
            field: `handoffChain[${index}].toAgent`,
            message: `Handoff rule ${index + 1}: Agent "${handoff.toAgent}" does not exist`,
          });
        }

        if (!handoff.condition || handoff.condition.trim().length === 0) {
          errors.push({
            field: `handoffChain[${index}].condition`,
            message: `Handoff rule ${index + 1}: "Condition" is required`,
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate agent data
   */
  static validateAgent(
    filename: string,
    name: string,
    description: string,
    prompt: string,
    existingAgents: string[],
    isUpdate: boolean = false
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate filename
    if (!filename || filename.trim().length === 0) {
      errors.push({
        field: 'filename',
        message: 'Filename is required',
      });
    } else {
      // Check for invalid characters
      if (!/^[a-zA-Z0-9_\-]+$/.test(filename.replace(/\.md$/i, ''))) {
        errors.push({
          field: 'filename',
          message: 'Filename can only contain letters, numbers, hyphens, and underscores',
        });
      }

      // Check uniqueness (only for create operation)
      if (!isUpdate && existingAgents.includes(filename.replace(/\.md$/i, ''))) {
        errors.push({
          field: 'filename',
          message: 'An agent with this filename already exists',
        });
      }
    }

    // Validate name
    if (!name || name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Name is required',
      });
    }

    // Validate description
    if (!description || description.trim().length === 0) {
      errors.push({
        field: 'description',
        message: 'Description is required',
      });
    }

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      errors.push({
        field: 'prompt',
        message: 'Prompt is required',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
