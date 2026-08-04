import { describe, expect, it } from "vitest";
import { createRevisionFromMarkdown, GovernedWorkflowKernel } from "../studio/index.js";

describe("governed workflow kernel", () => {
  const manifest = () => ({ revisionId: createRevisionFromMarkdown("# Book\n\nA scene.").id, packSnapshot: "pack@1", capabilities: ["scene-plan"], exclusions: ["sealed:solution"], resources: [] });

  it("requires a server-issued, scoped, unexpired grant", () => {
    const kernel = new GovernedWorkflowKernel();
    const grant = kernel.issueGrant({ capability: "scene-plan", subject: "worker-1", scope: ["book-1"], expiresAt: "2030-01-01T00:00:00.000Z", now: "2029-01-01T00:00:00.000Z" });
    const attempt = kernel.begin({ id: "scene-plan", capability: "scene-plan" }, "worker-1", grant.id, {}, manifest(), "2029-02-01T00:00:00.000Z");
    expect(attempt.number).toBe(1);
    expect(() => kernel.begin({ id: "other", capability: "scene-plan" }, "worker-2", grant.id, {}, manifest(), "2029-02-01T00:00:00.000Z")).toThrow("Capability denied");
  });

  it("retains failed attempts when a retry succeeds", () => {
    const kernel = new GovernedWorkflowKernel();
    const grant = kernel.issueGrant({ capability: "scene-plan", subject: "worker-1", scope: ["book-1"], expiresAt: "2030-01-01T00:00:00.000Z", now: "2029-01-01T00:00:00.000Z" });
    const node = { id: "scene-plan", capability: "scene-plan" };
    const first = kernel.begin(node, "worker-1", grant.id, {}, manifest(), "2029-02-01T00:00:00.000Z");
    kernel.fail(node.id, first.id, { code: "invalid-output" }, "2029-02-01T00:01:00.000Z");
    const second = kernel.begin(node, "worker-1", grant.id, {}, manifest(), "2029-02-01T00:02:00.000Z");
    kernel.complete(node.id, second.id, { title: "Scene" }, "2029-02-01T00:03:00.000Z");
    expect(kernel.history(node.id).map((attempt) => attempt.status)).toEqual(["failed", "completed"]);
    expect(kernel.history(node.id)[0]?.number).toBe(1);
    expect(kernel.history(node.id)[1]?.number).toBe(2);
  });

  it("rejects expired grants and malformed manifests", () => {
    const kernel = new GovernedWorkflowKernel();
    const grant = kernel.issueGrant({ capability: "scene-plan", subject: "worker-1", scope: ["book-1"], expiresAt: "2029-01-02T00:00:00.000Z", now: "2029-01-01T00:00:00.000Z" });
    expect(() => kernel.authorize(grant.id, "scene-plan", "worker-1", "2029-01-03T00:00:00.000Z")).toThrow("expired");
    expect(() => kernel.validateManifest({ revisionId: "not-a-revision", packSnapshot: "pack@1", capabilities: [], exclusions: [], resources: [] } as never)).toThrow();
  });
});
