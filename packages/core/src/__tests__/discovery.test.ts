import { afterEach, describe, expect, it } from "vitest";
import { DiscoveryEngine, StudioStore } from "../studio/index.js";

const stores: StudioStore[] = [];
function setup() { const store = new StudioStore(":memory:"); stores.push(store); const seriesId = store.createSeries({ title: "Series", premise: "", publicationTarget: "general" }); const bookId = store.createBook({ seriesId, title: "Book", premise: "", genrePack: "mystery", plannedOrder: 1 }); return { store, bookId, engine: new DiscoveryEngine(store) }; }
afterEach(() => { while (stores.length) stores.pop()?.close(); });

describe("NovelGraph discovery knowledge", () => {
  it("keeps scratchpad material noncanonical and emits role-bounded dossiers", () => {
    const { bookId, engine } = setup(); const sessionId = engine.start(bookId);
    engine.addTurn(sessionId, { role: "author", content: "The reader should recognize the clue in retrospect.", observations: [{ key: "reader-promise", value: "recognition", provenance: "author-stated", confidence: 1, status: "working" }] });
    engine.addScratchpad(sessionId, { agentRole: "terra-specialist", kind: "hypothesis", content: "A false timeline could carry that promise.", confidence: 0.7, sourceRefs: [] });
    const dossier = engine.dossier(bookId, "luna-worker");
    expect(dossier.scratchpad).toHaveLength(1); expect(dossier.approvedClaims).toEqual([]); expect(dossier.capabilities).not.toContain("canon:propose");
  });

  it("creates a chapter only after the author approves the charter", () => {
    const { store, bookId, engine } = setup(); engine.start(bookId);
    const proposed = engine.proposeCharter(bookId, { mainThrust: "A clock disproves a witness", readerPromise: ["Fair disclosure"], protagonist: { name: "Mara" }, centralConflict: "Testimony conflicts with time", genreContract: ["mystery"], thematicQuestions: ["What can evidence know?"], narrativeForm: { perspective: "third" }, endingHorizon: "The lie is reconstructed", constraints: [], productiveUnknowns: [], rejectedDirections: [] });
    expect((store.db.prepare("SELECT COUNT(*) AS count FROM chapters WHERE book_id = ?").get(bookId) as { count: number }).count).toBe(0);
    engine.resolveCharter(proposed.id, true, "The author approves this governing premise");
    expect((store.db.prepare("SELECT COUNT(*) AS count FROM chapters WHERE book_id = ?").get(bookId) as { count: number }).count).toBe(1);
  });

  it("rejects direct promotion of a creative claim", () => {
    const { bookId, engine } = setup(); engine.start(bookId);
    expect(() => engine.addClaim({ scope: "book", scopeId: bookId, subject: "culprit", predicate: "is", value: "Elias", provenance: "agent-proposed", status: "approved", sourceRefs: [] })).toThrow("proposals");
  });
});
