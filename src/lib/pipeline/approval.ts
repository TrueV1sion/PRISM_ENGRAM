/**
 * Blueprint Approval Registry
 *
 * Manages Promise-based gates for blueprint approval.
 * When a pipeline reaches the blueprint phase, it registers a pending approval.
 * The approval POST endpoint resolves the promise, allowing the pipeline to continue.
 */

type PendingApproval = {
  resolve: () => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const pendingApprovals = new Map<string, PendingApproval>();

/**
 * Wait for blueprint approval for a given run.
 * Returns a Promise that resolves when the client approves.
 * Times out after 10 minutes.
 */
export function waitForBlueprintApproval(
  runId: string,
  timeoutMs: number = 10 * 60 * 1000,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingApprovals.delete(runId);
      reject(new Error("Blueprint approval timed out after 10 minutes"));
    }, timeoutMs);

    pendingApprovals.set(runId, { resolve, reject, timeout });
  });
}

/**
 * Approve a pending blueprint. Returns true if there was a pending approval.
 */
export function approveBlueprintForRun(runId: string): boolean {
  const pending = pendingApprovals.get(runId);
  if (!pending) return false;

  clearTimeout(pending.timeout);
  pending.resolve();
  pendingApprovals.delete(runId);
  return true;
}

/**
 * Cancel a pending approval (e.g., on abort).
 */
export function cancelApproval(runId: string): void {
  const pending = pendingApprovals.get(runId);
  if (pending) {
    clearTimeout(pending.timeout);
    pending.reject(new Error("Pipeline aborted"));
    pendingApprovals.delete(runId);
  }
}
