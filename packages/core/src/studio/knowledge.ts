import { randomUUID } from "node:crypto";
import type { StudioStore } from "./store.js";

export interface KnowledgeMatch { readonly chunkId: string; readonly content: string; readonly topics: ReadonlyArray<string>; readonly citation: string; readonly score: number; }
function atomic(store: StudioStore, work: () => void): void { store.db.exec("BEGIN IMMEDIATE"); try { work(); store.db.exec("COMMIT"); } catch (error) { store.db.exec("ROLLBACK"); throw error; } }

export class KnowledgeBase {
  constructor(private readonly store: StudioStore) {}

  addSource(input: { title: string; origin: string; licenseNote: string; version: string }): string {
    const id = randomUUID();
    this.store.db.prepare("INSERT INTO knowledge_sources VALUES (?, ?, ?, ?, ?, ?)").run(id, input.title, input.origin, input.licenseNote, input.version, new Date().toISOString());
    return id;
  }

  addChunk(sourceId: string, input: { content: string; topics: ReadonlyArray<string>; applicability: ReadonlyArray<string>; citation: string }): string {
    const id = randomUUID(); const timestamp = new Date().toISOString();
    atomic(this.store, () => {
      this.store.db.prepare("INSERT INTO knowledge_chunks VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, sourceId, input.content, JSON.stringify(input.topics), JSON.stringify(input.applicability), input.citation, timestamp);
      this.store.db.prepare("INSERT INTO knowledge_fts (chunk_id, content, topics) VALUES (?, ?, ?)").run(id, input.content, input.topics.join(" "));
    }); return id;
  }

  search(query: string, limit = 8): ReadonlyArray<KnowledgeMatch> {
    const rows = this.store.db.prepare(`SELECT c.id, c.content, c.topics_json, c.citation, bm25(knowledge_fts) AS score FROM knowledge_fts JOIN knowledge_chunks c ON c.id = knowledge_fts.chunk_id WHERE knowledge_fts MATCH ? ORDER BY score LIMIT ?`).all(query, limit) as Array<{ id: string; content: string; topics_json: string; citation: string; score: number }>;
    return rows.map((row) => ({ chunkId: row.id, content: row.content, topics: JSON.parse(row.topics_json), citation: row.citation, score: row.score }));
  }
}
