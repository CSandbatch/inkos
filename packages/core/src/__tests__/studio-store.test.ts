import { afterEach, describe, expect, it } from "vitest";
import { StudioStore, KnowledgeBase, MysteryLedger, WorkflowHarness } from "../studio/index.js";

const stores: StudioStore[] = [];
function store(): StudioStore { const value = new StudioStore(":memory:"); stores.push(value); return value; }
afterEach(() => { while (stores.length) stores.pop()?.close(); });

describe("StudioStore", () => {
  it("blocks publication for an unresolved hard obligation", () => {
    const db = store();
    const seriesId = db.createSeries({ title: "Series", premise: "", publicationTarget: "general" });
    const bookId = db.createBook({ seriesId, title: "Book", premise: "", genrePack: "general", plannedOrder: 1 });
    db.createObligation({ bookId, kind: "setup", title: "The sealed letter", description: "", hard: true, dependencies: [] });
    expect(db.closureReport(bookId).publishable).toBe(false);
  });

  it("requires evidence of a mystery clue payoff", () => {
    const db = store(); const seriesId = db.createSeries({ title: "Series", premise: "", publicationTarget: "general" });
    const bookId = db.createBook({ seriesId, title: "Mystery", premise: "", genrePack: "mystery", plannedOrder: 1 });
    const ledger = new MysteryLedger(db);
    ledger.lockSolution({ bookId, culprit: "A", motive: "B", means: "C", opportunity: "D", solutionLocked: true });
    expect(db.closureReport(bookId).findings.some((item) => item.code === "MYSTERY_NO_PAYOFF_EVIDENCE")).toBe(true);
  });

  it("enforces job budgets and idempotency", () => {
    const db = store(); const seriesId = db.createSeries({ title: "Series", premise: "", publicationTarget: "general" });
    const bookId = db.createBook({ seriesId, title: "Book", premise: "", genrePack: "general", plannedOrder: 1 });
    const harness = new WorkflowHarness(db); const options = { idempotencyKey: "unique-run", budgetCents: 10, capabilities: new Set(["research", "write", "canon", "publish"] as const) };
    const first = harness.start(bookId, options); const second = harness.start(bookId, options);
    expect(first).toBe(second); expect(() => db.chargeJob(first, 11)).toThrow("budget exceeded");
  });

  it("searches literary knowledge when FTS5 is unavailable", () => {
    const db = store();
    db.db.exec("DROP TABLE IF EXISTS knowledge_fts");
    const knowledge = new KnowledgeBase(db);
    const sourceId = knowledge.addSource({ title: "Craft", origin: "test", licenseNote: "original", version: "1" });
    knowledge.addChunk(sourceId, { content: "A clue must be visible before the reveal.", topics: ["mystery"], applicability: ["mystery"], citation: "Fair play" });
    expect(knowledge.search("clue")[0]?.citation).toBe("Fair play");
  });
});
