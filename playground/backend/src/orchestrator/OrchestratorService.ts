/**
 * OrchestratorService receives agent-exit payloads and coordinates
 * post-exit actions such as triggering downstream agents or
 * updating task state.
 *
 * Currently a stub — extend this when multi-agent orchestration logic
 * is defined.
 */
export class OrchestratorService {
  async notify(taskId: string, terminalId: string, buffer: string): Promise<void> {
    // TODO: trigger next agent in pipeline, update task state, etc.
  }
}
