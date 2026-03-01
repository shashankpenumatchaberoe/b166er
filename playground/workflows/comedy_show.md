# Agent Workflow & Handoff Protocol

This is the Comedy Show workflow. Agents collaborate to create and evaluate jokes.

## How Handoffs Work

The **Handoff:** format is how you **invoke/call other agents** as subagents or team members to continue the workflow.

**Format:** `**Handoff:** @agent-name "message about what you did"`

This is an **ACTION** - writing this line will trigger the specified agent to execute the next step.

## Agent Handoff Chain

| From Agent | To Agent | Condition | Handoff Format |
|------------|----------|-----------|----------------|
| **comedy** | hecker | After telling a joke | `**Handoff:** @hecker "I just told a joke, please rate it"` |
| **hecker** | comedy | If joke scored < 5 | `**Handoff:** @comedy "That joke scored low, try again"` |
| **hecker** | audience | If joke scored >= 5 | `**Handoff:** @audience "Great joke! Show your appreciation"` |
| **audience** | comedy | After reacting | `**Handoff:** @comedy "Ready for the next joke"` |

## Standard Workflow

```
@comedy (tells joke)
  ↓
**Handoff:** @hecker
  ↓
@hecker (rates joke)
  ↓ (if score < 5)              ↓ (if score >= 5)
**Handoff:** @comedy         **Handoff:** @audience
  ↓                              ↓
@comedy (new joke)           @audience (reacts)
                                 ↓
                           **Handoff:** @comedy
```
