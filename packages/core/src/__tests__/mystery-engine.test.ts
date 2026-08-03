import { afterEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  DiscoveryEngine, FAIR_PLAY_RULE_PACK, MYSTERY_WORKFLOW, MysteryEngine, MysteryPolicySchema, StudioStore, WorkflowHarness,
} from "../studio/index.js";

const stores: StudioStore[] = []; const temporary: string[] = [];
function store(): StudioStore { const value = new StudioStore(":memory:"); stores.push(value); return value; }
function book(db: StudioStore): string { const seriesId = db.createSeries({ title: "Cases", premise: "", publicationTarget: "general" }); return db.createBook({ seriesId, title: "Case", premise: "", genrePack: "mystery", plannedOrder: 1 }); }
afterEach(() => { while (stores.length) stores.pop()?.close(); while (temporary.length) rmSync(temporary.pop()!, { recursive: true, force: true }); });

describe("fair-play mystery engine", () => {
  it("defaults to contemporary mode and exposes all four policies", () => {
    const db = store(); const bookId = book(db); const engine = new MysteryEngine(db);
    engine.configurePolicy(MysteryPolicySchema.parse({ bookId, centralCrime: "A concealed death" }));
    expect(engine.getPolicy(bookId)?.mode).toBe("contemporary");
    for (const mode of ["strict-golden-age", "contemporary", "hybrid", "rule-breaking"] as const) expect(() => MysteryPolicySchema.parse({ bookId, mode, centralCrime: "Murder" })).not.toThrow();
  });

  it("requires approval and invalidates audits when mode changes", () => {
    const db = store(); const bookId = book(db); const engine = new MysteryEngine(db);
    engine.configurePolicy({ bookId, mode: "contemporary", centralCrime: "Murder" });
    expect(() => engine.configurePolicy({ bookId, mode: "strict-golden-age", centralCrime: "Murder" })).toThrow("requires approved request");
    const approval = db.db.prepare("SELECT id FROM approvals WHERE book_id = ? AND subject_id = 'mystery-mode:contemporary->strict-golden-age'").get(bookId) as { id: string };
    db.resolveApproval(approval.id, true);
    engine.configurePolicy({ bookId, mode: "strict-golden-age", centralCrime: "Murder" });
    expect(engine.getPolicy(bookId)?.mode).toBe("strict-golden-age");
    expect(db.db.prepare("SELECT status FROM approvals WHERE id = ?").get(approval.id)).toEqual({ status: "applied" });
    expect(() => engine.configurePolicy({ bookId, mode: "contemporary", centralCrime: "Murder" })).toThrow("requires approved request");
  });

  it("denies sealed solution access and strips true meanings from reader projection", () => {
    const db = store(); const bookId = book(db); const engine = new MysteryEngine(db);
    engine.configurePolicy({ bookId, centralCrime: "Murder" });
    engine.saveSolution({ bookId, victimOrTarget: "Victim", responsibleParties: ["Culprit"], actualEvent: "Culprit killed Victim", apparentEvent: "Locked room", motive: { actual: "Exposure" }, method: "Poison", opportunity: "Shared tea", concealment: "Swapped cups", reconstruction: ["Cup was moved"], locked: true });
    engine.addEvidence({ bookId, title: "Cup residue", kind: "physical", source: "Scene", reliability: "established", visibility: "reader-visible", firstAppearanceChapter: 2, revealChapter: 8, apparentMeaning: "Untouched tea", trueMeaning: "The cups were swapped", required: true, extensions: { notes: [{ secret: "Culprit changed the cups" }], material: "porcelain" } });
    engine.addTimelineEvent({ bookId, label: "Secret murder time", earliest: "2026-01-01T22:00:00Z", latest: "2026-01-01T22:05:00Z", timeKind: "fixed", source: "Sealed reconstruction", reliability: "established" });
    engine.addTimelineEvent({ bookId, label: "Future public timestamp", earliest: "2026-01-01T23:00:00Z", latest: "2026-01-01T23:05:00Z", timeKind: "reported", source: "Witness", reliability: "plausible", visibility: "reader-visible", firstAppearanceChapter: 7 });
    engine.addKnowledge({ bookId, characterId: "Culprit", fact: "The poisoned cup was swapped", state: "conceals", chapter: 1 });
    expect(() => engine.getSolution(bookId, "reader-view:read", "writer")).toThrow("solution:read");
    expect(() => engine.getSolution(bookId, "solution:write", "architect")).toThrow("solution:read");
    const projection = engine.readerProjection(bookId, 3);
    expect(projection.evidence[0]).not.toHaveProperty("trueMeaning");
    expect(JSON.stringify(projection)).not.toContain("Culprit killed Victim");
    expect(JSON.stringify(projection)).not.toContain("Secret murder time");
    expect(JSON.stringify(projection)).not.toContain("Future public timestamp");
    expect(JSON.stringify(projection)).not.toContain("poisoned cup");
    expect(JSON.stringify(projection)).not.toContain("changed the cups");
    expect(JSON.stringify(engine.workbench(bookId))).not.toContain("The cups were swapped");
    expect(JSON.stringify(engine.workbench(bookId))).not.toContain("Secret murder time");
    expect(JSON.stringify(engine.workbench(bookId, true))).toContain("The cups were swapped");
  });

  it("blocks hidden decisive evidence and unsupported access", () => {
    const db = store(); const bookId = book(db); const engine = new MysteryEngine(db);
    engine.configurePolicy({ bookId, centralCrime: "Murder" });
    engine.saveSolution({ bookId, victimOrTarget: "Victim", responsibleParties: ["Culprit"], actualEvent: "Murder", apparentEvent: "Accident", motive: { actual: "Blackmail" }, method: "Staged fall", opportunity: "At the stair", concealment: "Moved the body", reconstruction: ["Scuff marks"], locked: true });
    engine.addEvidence({ bookId, title: "Hidden scuff", kind: "physical", source: "Stair", reliability: "established", visibility: "solution-authorized", trueMeaning: "Body moved", required: true });
    const result = engine.validate(bookId);
    expect(result.passed).toBe(false);
    expect(result.findings.map((item) => item.ruleCode)).toEqual(expect.arrayContaining(["FP-DISCLOSURE-001", "FP-DISCLOSURE-002", "ACCESS-001"]));
  });

  it("filters durable workflow artifacts by capability", () => {
    const db = store(); const bookId = book(db); const discovery = new DiscoveryEngine(db); discovery.start(bookId); const charter = discovery.proposeCharter(bookId, { mainThrust: "Solve the case", readerPromise: ["A fair solution"], protagonist: { name: "Mara" }, centralConflict: "Evidence contradicts testimony", genreContract: [], thematicQuestions: [], narrativeForm: {}, endingHorizon: "The evidence resolves the contradiction", constraints: [], productiveUnknowns: [], rejectedDirections: [] }); discovery.resolveCharter(charter.id, true, "Approved for workflow test"); const harness = new WorkflowHarness(db);
    const jobId = harness.start(bookId, { idempotencyKey: "mystery", budgetCents: 100, capabilities: new Set(["solution:write"]), nodes: MYSTERY_WORKFLOW });
    harness.putArtifact(jobId, undefined, "solution", "solution-authorized", { culprit: "A" }, FAIR_PLAY_RULE_PACK);
    harness.putArtifact(jobId, undefined, "projection", "reader-visible", { clue: "B" }, FAIR_PLAY_RULE_PACK);
    harness.putArtifact(jobId, undefined, "author-note", "author-only", { note: "private" }, FAIR_PLAY_RULE_PACK);
    expect(harness.readArtifacts(jobId, new Set(["reader-view:read"])).map((item) => item.kind)).toEqual(["projection"]);
    expect(harness.readArtifacts(jobId, new Set(["solution:read"]))).toHaveLength(2);
    expect(harness.readArtifacts(jobId, new Set(["approval:request", "publish:export", "solution:write"])).map((item) => item.kind)).not.toContain("author-note");
    const policyNode = db.db.prepare("SELECT id FROM job_nodes WHERE job_id = ? AND node_key = 'policy'").get(jobId) as { id: string };
    expect(() => harness.beginNode(jobId, policyNode.id, {}, new Set(["solution:write"]))).toThrow("Capability denied");
    harness.beginNode(jobId, policyNode.id, {}, new Set(["canon:propose"]));
    expect(() => harness.completeNode(jobId, policyNode.id, {}, new Set(["solution:write"]))).toThrow("Capability denied");
    harness.completeNode(jobId, policyNode.id, {}, new Set(["canon:propose"]));
  });

  it("invalidates audits when any policy field changes", () => {
    const db = store(); const bookId = book(db); const engine = new MysteryEngine(db);
    engine.configurePolicy({ bookId, centralCrime: "Murder" }); engine.validate(bookId);
    engine.configurePolicy({ bookId, centralCrime: "Attempted murder" });
    expect(db.db.prepare("SELECT audit_generation FROM mystery_policies WHERE book_id = ?").get(bookId)).toEqual({ audit_generation: 2 });
    expect(db.db.prepare("SELECT status FROM validation_runs WHERE book_id = ?").get(bookId)).toEqual({ status: "stale" });
  });

  it("preserves every finding from the current validation run", () => {
    const db = store(); const bookId = book(db); const engine = new MysteryEngine(db);
    engine.configurePolicy({ bookId, centralCrime: "Murder" });
    for (const title of ["Hidden one", "Hidden two"]) engine.addEvidence({ bookId, title, kind: "physical", source: "Scene", reliability: "established", visibility: "solution-authorized", trueMeaning: "Decisive", required: true });
    engine.validate(bookId);
    expect(engine.currentFindings(bookId).filter((item) => item.ruleCode === "FP-DISCLOSURE-001")).toHaveLength(2);
  });

  it("detects oracle evidence and permits documented blocker waivers only in rule-breaking mode", () => {
    const db = store(); const bookId = book(db); const engine = new MysteryEngine(db);
    engine.configurePolicy({ bookId, mode: "rule-breaking", centralCrime: "A hidden event" });
    engine.addEvidence({ bookId, title: "Face match", kind: "digital", source: "Camera", reliability: "plausible", visibility: "reader-visible", firstAppearanceChapter: 1, trueMeaning: "A lead only", required: false, extensions: { origin: "camera", establishesGuiltAlone: true } });
    engine.validate(bookId); const oracle = engine.currentFindings(bookId).find((item) => item.ruleCode === "ORACLE-001")!;
    expect(oracle.severity).toBe("blocker");
    expect(engine.waiveFinding(bookId, oracle.id!, "The novel foregrounds the institution's error.")).toMatch(/[0-9a-f-]{36}/);
    expect(engine.currentFindings(bookId).find((item) => item.ruleCode === "ORACLE-001")?.status).toBe("waived");
  });

  it("validates typed digital-evidence extensions", () => {
    const db = store(); const bookId = book(db); const engine = new MysteryEngine(db);
    expect(() => engine.addEvidence({ bookId, title: "Camera", kind: "digital", source: "Device", reliability: "plausible", visibility: "reader-visible", trueMeaning: "Gap", extensions: { camera: { position: 42 } } })).toThrow("Invalid digital-evidence extension");
  });

  it("backs up an existing alpha database before migration", () => {
    const directory = mkdtempSync(join(tmpdir(), "novelgraph-migration-")); temporary.push(directory); const filename = join(directory, "studio.sqlite");
    const old = new DatabaseSync(filename); old.exec("CREATE TABLE books (id TEXT PRIMARY KEY, genre_pack TEXT NOT NULL); CREATE TABLE mystery_cases (book_id TEXT PRIMARY KEY, culprit TEXT NOT NULL, motive TEXT NOT NULL, means TEXT NOT NULL, opportunity TEXT NOT NULL, solution_locked INTEGER NOT NULL, approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE clues (id TEXT PRIMARY KEY, book_id TEXT NOT NULL, title TEXT NOT NULL, evidence TEXT NOT NULL, discovered_chapter INTEGER, interpretation TEXT NOT NULL DEFAULT '', visibility TEXT NOT NULL DEFAULT 'reader-visible', payoff_chapter INTEGER, red_herring INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)");
    const legacyBookId = "11111111-1111-4111-8111-111111111111"; old.prepare("INSERT INTO books VALUES (?, 'mystery')").run(legacyBookId); old.prepare("INSERT INTO mystery_cases VALUES (?, 'Elias', 'Exposure', 'Poison', 'Tea service', 1, NULL, 'now', 'now')").run(legacyBookId); old.prepare("INSERT INTO clues VALUES ('22222222-2222-4222-8222-222222222222', ?, 'Stopped clock', 'The clock stopped early', 2, 'The death occurred before midnight', 'reader-visible', 8, 0, 'resolved', 'now', 'now')").run(legacyBookId); old.close();
    const migrated = new StudioStore(filename);
    expect(readdirSync(join(directory, "backups")).some((name) => name.startsWith("studio-pre-v2-"))).toBe(true);
    expect(new MysteryEngine(migrated).getPolicy(legacyBookId)?.mode).toBe("contemporary");
    expect(new MysteryEngine(migrated).getSolution(legacyBookId, "solution:read")?.responsibleParties).toEqual(["Elias"]);
    expect(JSON.stringify(new MysteryEngine(migrated).workbench(legacyBookId, true))).toContain("Stopped clock");
    migrated.close();
  });

  it("rolls back an injected migration failure without losing alpha records", () => {
    const directory = mkdtempSync(join(tmpdir(), "novelgraph-migration-failure-")); temporary.push(directory); const filename = join(directory, "studio.sqlite");
    const old = new DatabaseSync(filename); old.exec(`
      CREATE TABLE books (id TEXT PRIMARY KEY, genre_pack TEXT NOT NULL);
      CREATE TABLE mystery_cases (book_id TEXT PRIMARY KEY, culprit TEXT NOT NULL, motive TEXT NOT NULL, means TEXT NOT NULL, opportunity TEXT NOT NULL, solution_locked INTEGER NOT NULL, approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE revisions (id TEXT PRIMARY KEY, book_id TEXT NOT NULL);
      CREATE TABLE jobs (id TEXT PRIMARY KEY, book_id TEXT NOT NULL);
      CREATE TABLE approvals (id TEXT PRIMARY KEY, book_id TEXT NOT NULL);
      INSERT INTO books VALUES ('11111111-1111-4111-8111-111111111111', 'mystery');
      INSERT INTO mystery_cases VALUES ('11111111-1111-4111-8111-111111111111', 'Elias', 'Exposure', 'Poison', 'Tea', 1, NULL, 'now', 'now');
      INSERT INTO revisions VALUES ('revision-1', '11111111-1111-4111-8111-111111111111');
      INSERT INTO jobs VALUES ('job-1', '11111111-1111-4111-8111-111111111111');
      INSERT INTO approvals VALUES ('approval-1', '11111111-1111-4111-8111-111111111111');
    `); old.close();
    expect(() => new StudioStore(filename, { failMigrationVersion: 2 })).toThrow("Injected fair-play migration failure");
    const restored = new DatabaseSync(filename);
    for (const [table, id] of [["books", "11111111-1111-4111-8111-111111111111"], ["revisions", "revision-1"], ["jobs", "job-1"], ["approvals", "approval-1"]]) expect(restored.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id)).toEqual({ id });
    expect(restored.prepare("SELECT 1 FROM schema_migrations WHERE version = 2").get()).toBeUndefined();
    expect(restored.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'mystery_policies'").get()).toBeUndefined();
    restored.close();
    expect(readdirSync(join(directory, "backups")).some((name) => name.startsWith("studio-pre-v2-"))).toBe(true);
  });
});
