# Agent Workflow & Handoff Protocol

its a simulation of a comedy show. The **Handoff:** format is how you **invoke/call other agents** as subagents or team members to continue the workflow. **Format:** `**Handoff:** @agent-name "message about what you did"` This is an **ACTION** - writing this line will trigger the specified agent to execute the next step.

## How Handoffs Work

The **Handoff:** format is how you **invoke/call other agents** as subagents or team members to continue the workflow.

**Format:** `**Handoff:** @agent-name "message about what you did"`

This is an **ACTION** - writing this line will trigger the specified agent to execute the next step.

## Agent Handoff Chain

| From Agent | To Agent | Condition | Handoff Format |
|------------|----------|-----------|----------------|
| **comedian** | heckler | always | `**Handoff:** @heckler "[message]"` |
| **heckler** | comedian | if joke rating < 5 out of 10 | `**Handoff:** @comedian "[message]"` |
| **heckler** | audience | if joke rating >= 5 out of 10 | `**Handoff:** @audience "[message]"` |
| **audience** | comedian | till 5 funny jokes are delivered | `**Handoff:** @comedian "[message]"` |

## Standard Workflow

```
@comedian
  ↓
@heckler
  ↓ (if joke rating < 5 out of 10)       ↓ (if joke rating >= 5 out of 10)
@comedian (cycle)                      @audience                          
  ↓
  ↓ (till 5 funny jokes are delivered)
@comedian (cycle back)
```
