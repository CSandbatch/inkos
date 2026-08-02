import { randomUUID } from "node:crypto";
import type { StudioStore } from "./store.js";
import { STANDARD_WORKFLOW, type WorkflowNode } from "./domain.js";

export type AgentCapability = "research" | "write" | "canon" | "publish";

export interface WorkflowRunOptions {
  readonly idempotencyKey: string;
  readonly budgetCents: number;
  readonly capabilities: ReadonlySet<AgentCapability>;
  readonly nodes?: ReadonlyArray<WorkflowNode>;
}

/** Durable DAG state. Agent execution is deliberately supplied by the caller. */
export class WorkflowHarness {
  constructor(private readonly store: StudioStore) {}

  start(bookId: string, options: WorkflowRunOptions): string {
    const jobId = this.store.createJob(bookId, options.idempotencyKey, options.budgetCents);
    const nodes = options.nodes ?? STANDARD_WORKFLOW;
    this.store.db.exec("BEGIN IMMEDIATE");
    try {
      const insert = this.store.db.prepare("INSERT OR IGNORE INTO job_nodes (id, job_id, node_key, kind, status, depends_on_json, capability) VALUES (?, ?, ?, ?, 'pending', ?, ?)");
      for (const node of nodes) insert.run(randomUUID(), jobId, node.id, node.kind, JSON.stringify(node.dependsOn), node.capability);
      this.store.db.exec("COMMIT");
    } catch (error) {
      this.store.db.exec("ROLLBACK");
      throw error;
    }
    this.store.updateJobStatus(jobId, "running");
    this.event(jobId, "info", "Workflow started", { budgetCents: options.budgetCents });
    return jobId;
  }

  readyNodes(jobId: string, capabilities: ReadonlySet<AgentCapability>): ReadonlyArray<{ id: string; key: string; kind: string }> {
    const nodes = this.store.db.prepare("SELECT id, node_key, kind, depends_on_json, capability FROM job_nodes WHERE job_id = ? AND status = 'pending'").all(jobId) as Array<{ id: string; node_key: string; kind: string; depends_on_json: string; capability: AgentCapability }>;
    const states = this.store.db.prepare("SELECT node_key, status FROM job_nodes WHERE job_id = ?").all(jobId) as Array<{ node_key: string; status: string }>;
    const stateByKey = new Map(states.map((state) => [state.node_key, state.status]));
    return nodes.filter((node) => capabilities.has(node.capability) && (JSON.parse(node.depends_on_json) as string[]).every((dependency) => stateByKey.get(dependency) === "completed"))
      .map((node) => ({ id: node.id, key: node.node_key, kind: node.kind }));
  }

  beginNode(jobId: string, nodeId: string, input: unknown): void {
    this.ensureJobRunnable(jobId);
    this.store.db.prepare("UPDATE job_nodes SET status = 'running', input_json = ?, started_at = ? WHERE id = ? AND job_id = ? AND status = 'pending'").run(JSON.stringify(input ?? {}), new Date().toISOString(), nodeId, jobId);
    this.event(jobId, "info", "Node started", { nodeId });
  }

  completeNode(jobId: string, nodeId: string, output: unknown, costCents = 0): void {
    this.store.chargeJob(jobId, costCents);
    this.store.db.prepare("UPDATE job_nodes SET status = 'completed', output_json = ?, completed_at = ? WHERE id = ? AND job_id = ?").run(JSON.stringify(output ?? {}), new Date().toISOString(), nodeId, jobId);
    this.event(jobId, "info", "Node completed", { nodeId, costCents });
    this.finishIfComplete(jobId);
  }

  failNode(jobId: string, nodeId: string, error: unknown, retryable = false): void {
    this.store.db.prepare("UPDATE job_nodes SET status = ?, error_json = ?, completed_at = ? WHERE id = ? AND job_id = ?").run(retryable ? "pending" : "failed", JSON.stringify(error), new Date().toISOString(), nodeId, jobId);
    this.store.updateJobStatus(jobId, retryable ? "running" : "blocked");
    this.event(jobId, "error", retryable ? "Node scheduled for retry" : "Node blocked workflow", { nodeId, error });
  }

  requestCancellation(jobId: string): void {
    this.store.db.prepare("UPDATE jobs SET cancellation_requested = 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), jobId);
    this.event(jobId, "warning", "Cancellation requested", {});
  }

  resume(jobId: string): void {
    this.store.db.prepare("UPDATE jobs SET status = 'running', cancellation_requested = 0, updated_at = ? WHERE id = ? AND status IN ('blocked', 'failed')").run(new Date().toISOString(), jobId);
    this.store.db.prepare("UPDATE job_nodes SET status = 'pending', error_json = NULL WHERE job_id = ? AND status IN ('failed', 'blocked')").run(jobId);
    this.event(jobId, "info", "Workflow resumed", {});
  }

  private ensureJobRunnable(jobId: string): void {
    const job = this.store.db.prepare("SELECT status, cancellation_requested FROM jobs WHERE id = ?").get(jobId) as { status: string; cancellation_requested: number } | undefined;
    if (!job || job.status !== "running") throw new Error("Job is not running");
    if (job.cancellation_requested) throw new Error("Job cancellation was requested");
  }

  private finishIfComplete(jobId: string): void {
    const remaining = this.store.db.prepare("SELECT COUNT(*) AS count FROM job_nodes WHERE job_id = ? AND status NOT IN ('completed', 'skipped')").get(jobId) as { count: number };
    if (remaining.count === 0) { this.store.updateJobStatus(jobId, "completed"); this.event(jobId, "info", "Workflow completed", {}); }
  }

  private event(jobId: string, level: string, message: string, data: unknown): void {
    this.store.db.prepare("INSERT INTO job_events VALUES (?, ?, NULL, ?, ?, ?, ?)").run(randomUUID(), jobId, level, message, JSON.stringify(data ?? {}), new Date().toISOString());
  }
}
