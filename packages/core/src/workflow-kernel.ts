import { randomUUID } from "node:crypto";
import { CapabilityGrantSchema, ContextManifestSchema, type CapabilityGrant, type ContextManifest } from "./contracts.js";

export interface NodeDefinition { readonly id: string; readonly capability: string; readonly dependsOn?: readonly string[]; }
export interface NodeAttempt { readonly id: string; readonly nodeId: string; readonly number: number; readonly status: "running" | "completed" | "failed"; readonly input: unknown; readonly output?: unknown; readonly error?: unknown; readonly startedAt: string; readonly completedAt?: string; }

/** Deterministic, storage-independent kernel used by the durable workflow adapter. */
export class GovernedWorkflowKernel {
  private readonly grants = new Map<string, CapabilityGrant>();
  private readonly attempts = new Map<string, NodeAttempt[]>();

  issueGrant(input: Omit<CapabilityGrant, "id" | "issuedAt"> & { now?: string }): CapabilityGrant {
    const issuedAt = input.now ?? new Date().toISOString();
    const grant = CapabilityGrantSchema.parse({ ...input, id: randomUUID(), issuedAt });
    if (new Date(grant.expiresAt).getTime() <= new Date(grant.issuedAt).getTime()) throw new Error("Capability grant must expire in the future");
    this.grants.set(grant.id, grant);
    return grant;
  }

  authorize(grantId: string, capability: string, subject: string, now = new Date().toISOString()): CapabilityGrant {
    const grant = this.grants.get(grantId);
    if (!grant || grant.capability !== capability || grant.subject !== subject) throw new Error("Capability denied");
    if (new Date(grant.expiresAt).getTime() <= new Date(now).getTime()) throw new Error("Capability grant expired");
    return grant;
  }

  validateManifest(manifest: ContextManifest): ContextManifest {
    return ContextManifestSchema.parse(manifest);
  }

  begin(node: NodeDefinition, subject: string, grantId: string, input: unknown, manifest: ContextManifest, now = new Date().toISOString()): NodeAttempt {
    this.authorize(grantId, node.capability, subject, now);
    this.validateManifest(manifest);
    const attempts = this.attempts.get(node.id) ?? [];
    if (attempts.some((attempt) => attempt.status === "running")) throw new Error("Node already has a running attempt");
    const attempt: NodeAttempt = Object.freeze({ id: randomUUID(), nodeId: node.id, number: attempts.length + 1, status: "running", input, startedAt: now });
    attempts.push(attempt);
    this.attempts.set(node.id, attempts);
    return attempt;
  }

  complete(nodeId: string, attemptId: string, output: unknown, now = new Date().toISOString()): NodeAttempt {
    return this.finish(nodeId, attemptId, { status: "completed", output, completedAt: now });
  }

  fail(nodeId: string, attemptId: string, error: unknown, now = new Date().toISOString()): NodeAttempt {
    return this.finish(nodeId, attemptId, { status: "failed", error, completedAt: now });
  }

  history(nodeId: string): readonly NodeAttempt[] { return [...(this.attempts.get(nodeId) ?? [])]; }

  private finish(nodeId: string, attemptId: string, patch: Pick<NodeAttempt, "status" | "output" | "error" | "completedAt">): NodeAttempt {
    const attempts = this.attempts.get(nodeId) ?? [];
    const index = attempts.findIndex((attempt) => attempt.id === attemptId && attempt.status === "running");
    if (index < 0) throw new Error("Running attempt not found");
    const updated = Object.freeze({ ...attempts[index]!, ...patch });
    attempts[index] = updated;
    return updated;
  }
}
