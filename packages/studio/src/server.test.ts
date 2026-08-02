import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeStudioApp, createStudioApp } from "./server.js";

const directories: string[] = []; const apps: ReturnType<typeof createStudioApp>[] = [];
afterEach(() => { while (apps.length) closeStudioApp(apps.pop()!); while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

describe("fair-play Studio API", () => {
  it("keeps sealed solutions off ordinary endpoints", async () => {
    const root = mkdtempSync(join(tmpdir(), "inkos-api-")); directories.push(root); const app = createStudioApp(root); apps.push(app);
    const crossOrigin = await app.request("/api/v1/health", { method: "OPTIONS", headers: { origin: "https://malicious.example", "access-control-request-method": "GET" } });
    expect(crossOrigin.headers.get("access-control-allow-origin")).toBeNull();
    const created = await app.request("/api/v1/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seriesTitle: "Cases", bookTitle: "Case One", premise: "A false timestamp", genrePack: "mystery", seedMystery: true, mysteryMode: "hybrid" }) });
    expect(created.status).toBe(201); const { bookId } = await created.json() as { bookId: string };
    const workbench = await (await app.request(`/api/v1/books/${bookId}/mystery/workbench`)).json() as { policy: { mode: string } };
    expect(workbench.policy.mode).toBe("hybrid");
    expect((await app.request(`/api/v1/books/${bookId}/mystery/solution`)).status).toBe(400);
    const solution = { victimOrTarget: "Mara", responsibleParties: ["Elias"], actualEvent: "Elias killed Mara before midnight", apparentEvent: "A midnight intruder", motive: { actual: "Exposure" }, method: "Poisoned tea", opportunity: "Tea service", concealment: "False timestamp", reconstruction: ["The stopped clock disproves midnight"], uncertainty: "established", locked: true };
    expect((await app.request(`/api/v1/books/${bookId}/mystery/solution`, { method: "PUT", headers: { "content-type": "application/json", "x-inkos-capability": "solution:write" }, body: JSON.stringify(solution) })).status).toBe(200);
    const projection = await (await app.request(`/api/v1/books/${bookId}/mystery/reader-projection`)).text();
    expect(projection).not.toContain("Elias killed Mara");
  });

  it("exposes structured resources, validation, and advisory prose analysis", async () => {
    const root = mkdtempSync(join(tmpdir(), "inkos-api-")); directories.push(root); const app = createStudioApp(root); apps.push(app);
    const created = await app.request("/api/v1/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seriesTitle: "Cases", bookTitle: "Case", premise: "Evidence", genrePack: "mystery", seedMystery: true }) }); const { bookId } = await created.json() as { bookId: string };
    const evidence = await app.request(`/api/v1/books/${bookId}/mystery/evidence`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Message", kind: "digital", source: "Phone", reliability: "plausible", visibility: "reader-visible", firstAppearanceChapter: 1, apparentMeaning: "Elias sent it", trueMeaning: "The account was shared", required: true, extensions: { account: "shared", extractionMethod: "device image" } }) });
    expect(evidence.status).toBe(201);
    expect(await (await app.request(`/api/v1/books/${bookId}/mystery/workbench`)).text()).not.toContain("The account was shared");
    const validation = await app.request(`/api/v1/books/${bookId}/mystery/validate`, { method: "POST" }); expect(validation.status).toBe(200);
    const prose = await (await app.request("/api/v1/prose-patterns/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "This robust framework can help." }) })).json() as { findings: Array<{ severity: string }> };
    expect(prose.findings.every((item) => item.severity === "advisory")).toBe(true);
    const job = await (await app.request(`/api/v1/books/${bookId}/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idempotencyKey: "api-worker", budgetCents: 100 }) })).json() as { id: string };
    const ready = await (await app.request(`/api/v1/jobs/${job.id}/ready`, { headers: { "x-inkos-capabilities": "canon:propose" } })).json() as { nodes: Array<{ id: string; key: string }> };
    expect(ready.nodes.map((node) => node.key)).toEqual(["policy"]);
    expect((await app.request(`/api/v1/jobs/${job.id}/nodes/${ready.nodes[0].id}/begin`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: {} }) })).status).toBe(400);
    expect((await app.request(`/api/v1/jobs/${job.id}/nodes/${ready.nodes[0].id}/begin`, { method: "POST", headers: { "content-type": "application/json", "x-inkos-capabilities": "canon:propose" }, body: JSON.stringify({ input: {} }) })).status).toBe(200);
    expect((await app.request(`/api/v1/jobs/${job.id}/nodes/${ready.nodes[0].id}/complete`, { method: "POST", headers: { "content-type": "application/json", "x-inkos-capabilities": "canon:propose" }, body: JSON.stringify({ output: { configured: true } }) })).status).toBe(200);
  });
});
