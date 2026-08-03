import type { StudioStore } from "./store.js";
import { KnowledgeBase } from "./knowledge.js";

const CURATED_CRAFT: ReadonlyArray<{ title: string; topics: string[]; content: string }> = [
  { title: "Scene causality", topics: ["structure", "scene", "pacing"], content: "Every scene needs a point-of-view character, a concrete goal, meaningful opposition, and an outcome that changes the next decision. A scene without change is summary, not dramatic progression." },
  { title: "Character agency", topics: ["character", "arc", "motivation"], content: "Characters drive plot when choices emerge from values, pressures, knowledge, and consequences. Track what each character wants, fears, knows, and can lose before evaluating their actions." },
  { title: "Fair-play mystery", topics: ["mystery", "clues", "fairness"], content: "The solution must be supported by discoverable evidence available before the reveal. Red herrings require a truthful explanation. The culprit's motive, means, and opportunity must remain consistent with the timeline." },
  { title: "Promise and payoff", topics: ["plot", "obligations", "closure"], content: "Treat setups, clues, commitments, and dramatic promises as obligations. Resolve them, deliberately defer them with a future target, or record an author-approved waiver with a rationale." },
  { title: "Reader expectations", topics: ["reader", "genre", "review"], content: "Reader feedback should identify a concrete reaction, confusion, expectation, evidence from the chapter, severity, and a recommended action. Avoid unsupported taste judgments." },
];

export function seedCuratedKnowledge(store: StudioStore): void {
  const existing = store.db.prepare("SELECT id FROM knowledge_sources WHERE origin = 'novelgraph-curated' LIMIT 1").get() as { id: string } | undefined;
  if (existing) return;
  const knowledge = new KnowledgeBase(store);
  const sourceId = knowledge.addSource({ title: "NovelGraph Curated Literary Craft Library", origin: "novelgraph-curated", licenseNote: "Original NovelGraph editorial guidance", version: "1.0.0" });
  for (const item of CURATED_CRAFT) knowledge.addChunk(sourceId, { content: item.content, topics: item.topics, applicability: ["general"], citation: item.title });
}
