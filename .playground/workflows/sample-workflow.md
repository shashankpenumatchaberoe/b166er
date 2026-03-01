# Agent Workflow & Handoff Protocol

This document defines the mandatory agent handoff chain for the playground system.

## Agent Handoff Chain

All agents **must** follow this handoff chain when completing their work:

| From Agent | To Agent | Condition |
|------------|----------|-----------|
| **orchestrator** | `coder` | Always |
| **coder** | `reviewer` | Always |
| **reviewer** | `test` | If code passes review |
| **reviewer** | `coder` | If issues found (for fixes) |
| **test** | `reviewer` | Always (for re-validation) |
| **lead** | `user` | Always (never merges to dev) |

## Standard Workflow

```
@orchestrator (plan) 
  ↓
@coder (implement) 
  ↓
@reviewer (check) 
  ↓ (if passed)          ↓ (if issues)
@test (write & run)    @coder (fix)
  ↓                       ↓
@reviewer (re-check)   @reviewer (re-check)
  ↓
@lead (validate & push to remote)
  ↓
user (merge to dev)
```
