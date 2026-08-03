import { randomUUID } from "node:crypto";
import type { StudioStore } from "./store.js";
import {
  DiscoveryTurnInputSchema, KnowledgeClaimInputSchema, ScratchpadEntryInputSchema,
  StoryCharterInputSchema, StoryThrustCandidateInputSchema,
  type AgentRole, type DiscoveryTurnInput, type KnowledgeClaimInput,
  type ScratchpadEntryInput, type StoryCharterInput, type StoryThrustCandidateInput,
} from "./domain.js";

const now = () => new Date().toISOString();
const encode = (value: unknown) => JSON.stringify(value ?? {});
const decode = <T>(value: string): T => JSON.parse(value) as T;

export class DiscoveryEngine {
  constructor(private readonly store: StudioStore) {}

  ensureKnowledgeBases(bookId: string): { literaryId: string; seriesId: string; bookId: string } {
    const book = this.store.db.prepare("SELECT b.id, b.title, b.series_id, s.title AS series_title FROM books b JOIN series s ON s.id = b.series_id WHERE b.id = ?").get(bookId) as { id: string; title: string; series_id: string; series_title: string } | undefined;
    if (!book) throw new Error("Book not found");
    const timestamp = now();
    const find = (scope: string, ownerId: string | null) => this.store.db.prepare("SELECT id FROM knowledge_bases WHERE scope = ? AND owner_id IS ? ORDER BY created_at LIMIT 1").get(scope, ownerId) as { id: string } | undefined;
    const create = (scope: string, ownerId: string | null, title: string) => { const id = randomUUID(); this.store.db.prepare("INSERT INTO knowledge_bases VALUES (?, ?, ?, ?, 1, ?, ?)").run(id, scope, ownerId, title, timestamp, timestamp); return id; };
    const literaryId = find("literary", null)?.id ?? create("literary", null, "NovelGraph Literary Library");
    const seriesId = find("series", book.series_id)?.id ?? create("series", book.series_id, `${book.series_title} series canon`);
    const bookBaseId = find("book", book.id)?.id ?? create("book", book.id, `${book.title} book canon`);
    const link = this.store.db.prepare("INSERT OR IGNORE INTO knowledge_links VALUES (?, ?, ?, ?, ?)");
    link.run(randomUUID(), bookId, literaryId, "literary-guidance", timestamp);
    link.run(randomUUID(), bookId, seriesId, "series-canon", timestamp);
    return { literaryId, seriesId, bookId: bookBaseId };
  }

  start(bookId: string): string {
    this.ensureKnowledgeBases(bookId);
    const existing = this.store.db.prepare("SELECT id FROM discovery_sessions WHERE book_id = ? AND status IN ('active','charter-proposed') ORDER BY updated_at DESC LIMIT 1").get(bookId) as { id: string } | undefined;
    if (existing) return existing.id;
    const id = randomUUID(); const timestamp = now();
    this.store.db.prepare("INSERT INTO discovery_sessions VALUES (?, ?, 'active', ?, ?, ?)").run(id, bookId, "What experience should remain with the reader after the final page?", timestamp, timestamp);
    return id;
  }

  addTurn(sessionId: string, input: DiscoveryTurnInput): string {
    const value = DiscoveryTurnInputSchema.parse(input); const id = randomUUID(); const timestamp = now();
    const ordinal = (this.store.db.prepare("SELECT COALESCE(MAX(ordinal), 0) + 1 AS ordinal FROM discovery_turns WHERE session_id = ?").get(sessionId) as { ordinal: number }).ordinal;
    this.store.db.exec("BEGIN IMMEDIATE");
    try {
      this.store.db.prepare("INSERT INTO discovery_turns VALUES (?, ?, ?, ?, ?, ?)").run(id, sessionId, ordinal, value.role, value.content, timestamp);
      const insertObservation = this.store.db.prepare("INSERT INTO discovery_observations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      for (const observation of value.observations) insertObservation.run(randomUUID(), sessionId, id, observation.key, encode(observation.value), observation.provenance, observation.confidence ?? null, observation.status, timestamp, timestamp);
      this.store.db.prepare("UPDATE discovery_sessions SET updated_at = ? WHERE id = ?").run(timestamp, sessionId);
      this.store.db.exec("COMMIT");
    } catch (error) { this.store.db.exec("ROLLBACK"); throw error; }
    return id;
  }

  addScratchpad(sessionId: string, input: ScratchpadEntryInput): string {
    const value = ScratchpadEntryInputSchema.parse(input); const id = randomUUID();
    this.store.db.prepare("INSERT INTO scratchpad_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, sessionId, value.agentRole, value.kind, value.content, value.confidence ?? null, encode(value.sourceRefs), now());
    return id;
  }

  proposeThrust(sessionId: string, input: StoryThrustCandidateInput): string {
    const value = StoryThrustCandidateInputSchema.parse(input); const id = randomUUID(); const timestamp = now();
    this.store.db.prepare("INSERT INTO story_thrust_candidates VALUES (?, ?, ?, ?, 'proposed', ?, ?)").run(id, sessionId, value.kind, encode(value), timestamp, timestamp);
    this.store.db.prepare("UPDATE discovery_sessions SET status = 'charter-proposed', updated_at = ? WHERE id = ?").run(timestamp, sessionId);
    return id;
  }

  proposeCharter(bookId: string, input: StoryCharterInput): { id: string; version: number; approvalId: string } {
    const value = StoryCharterInputSchema.parse(input); const id = randomUUID(); const timestamp = now();
    const version = (this.store.db.prepare("SELECT COALESCE(MAX(version), 0) + 1 AS version FROM story_charters WHERE book_id = ?").get(bookId) as { version: number }).version;
    const approvalId = this.store.requestApproval(bookId, "story-charter", id, `Approve Story Charter version ${version}`);
    this.store.db.prepare("INSERT INTO story_charters VALUES (?, ?, ?, ?, 'proposed', ?, ?, NULL)").run(id, bookId, version, encode(value), approvalId, timestamp);
    return { id, version, approvalId };
  }

  resolveCharter(charterId: string, approved: boolean, rationale: string): void {
    if (!rationale.trim()) throw new Error("Charter decisions require author rationale");
    const charter = this.store.db.prepare("SELECT * FROM story_charters WHERE id = ?").get(charterId) as { id: string; book_id: string; approval_id: string; version: number; content_json: string } | undefined;
    if (!charter) throw new Error("Story Charter not found");
    this.store.resolveApproval(charter.approval_id, approved);
    if (approved) {
      this.store.db.prepare("UPDATE story_charters SET status = 'superseded' WHERE book_id = ? AND status = 'approved'").run(charter.book_id);
      this.store.db.prepare("UPDATE story_charters SET status = 'approved', approved_at = ? WHERE id = ?").run(now(), charterId);
      this.store.db.prepare("UPDATE discovery_sessions SET status = 'approved', updated_at = ? WHERE book_id = ? AND status != 'superseded'").run(now(), charter.book_id);
      const chapterCount = this.store.db.prepare("SELECT COUNT(*) AS count FROM chapters WHERE book_id = ?").get(charter.book_id) as { count: number };
      if (chapterCount.count === 0) this.store.createChapter({ bookId: charter.book_id, number: 1, title: "Opening", contentMarkdown: "" });
    } else this.store.db.prepare("UPDATE story_charters SET status = 'rejected' WHERE id = ?").run(charterId);
    this.store.recordEvent(charter.book_id, "author", approved ? "charter.approved" : "charter.rejected", "story-charter", charterId, null, decode(charter.content_json), rationale, charter.approval_id);
  }

  addClaim(input: KnowledgeClaimInput): string {
    const value = KnowledgeClaimInputSchema.parse(input); const id = randomUUID(); const timestamp = now();
    const base = this.store.db.prepare("SELECT id FROM knowledge_bases WHERE scope = ? AND owner_id IS ? ORDER BY created_at LIMIT 1").get(value.scope, value.scopeId === "global" ? null : value.scopeId) as { id: string } | undefined;
    if (!base) throw new Error("Knowledge base not found");
    if (value.status === "approved") throw new Error("Creative claims must enter as proposals and be approved by the author service");
    this.store.db.prepare("INSERT INTO knowledge_claims VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)").run(id, base.id, value.subject, value.predicate, encode(value.value), value.provenance, value.status, encode(value.sourceRefs), timestamp, timestamp);
    return id;
  }

  promoteClaim(claimId: string, bookId: string, rationale: string): string {
    if (!rationale.trim()) throw new Error("Canon promotion requires author rationale");
    const claim = this.store.db.prepare("SELECT status FROM knowledge_claims WHERE id = ?").get(claimId) as { status: string } | undefined;
    if (!claim) throw new Error("Knowledge claim not found");
    const approvalId = this.store.requestApproval(bookId, "canon-promotion", claimId, rationale);
    this.store.resolveApproval(approvalId, true);
    this.store.db.prepare("UPDATE knowledge_claims SET status = 'approved', approval_id = ?, updated_at = ? WHERE id = ?").run(approvalId, now(), claimId);
    return approvalId;
  }

  dossier(bookId: string, agentRole: AgentRole): Record<string, unknown> {
    const session = this.store.db.prepare("SELECT * FROM discovery_sessions WHERE book_id = ? ORDER BY updated_at DESC LIMIT 1").get(bookId) as { id: string } | undefined;
    const charter = this.store.db.prepare("SELECT version, content_json FROM story_charters WHERE book_id = ? AND status = 'approved' ORDER BY version DESC LIMIT 1").get(bookId) as { version: number; content_json: string } | undefined;
    const bases = this.store.db.prepare("SELECT kb.* FROM knowledge_bases kb LEFT JOIN knowledge_links kl ON kl.target_knowledge_base_id = kb.id WHERE kb.owner_id = ? OR kl.book_id = ? ORDER BY kb.scope").all(bookId, bookId) as Array<{ id: string; scope: string; title: string }>;
    const claims = bases.flatMap((base) => (this.store.db.prepare("SELECT subject, predicate, value_json, provenance, status, source_refs_json FROM knowledge_claims WHERE knowledge_base_id = ? AND status = 'approved'").all(base.id) as Array<Record<string, unknown>>).map((claim) => ({ ...claim, scope: base.scope, value: decode(String(claim.value_json)), sourceRefs: decode(String(claim.source_refs_json)) })));
    const scratchpad = session ? this.store.db.prepare("SELECT agent_role, kind, content, confidence, source_refs_json, created_at FROM scratchpad_entries WHERE session_id = ? ORDER BY created_at").all(session.id) : [];
    const unresolved = session ? this.store.db.prepare("SELECT key, value_json, provenance, confidence FROM discovery_observations WHERE session_id = ? AND status IN ('working','unresolved') ORDER BY created_at").all(session.id) : [];
    const content = { agentRole, charter: charter ? { version: charter.version, ...decode<Record<string, unknown>>(charter.content_json) } : null, knowledgeBases: bases, approvedClaims: claims, scratchpad, unresolved, capabilities: capabilitiesFor(agentRole) };
    if (session) this.store.db.prepare("INSERT INTO context_dossiers VALUES (?, ?, ?, ?, ?, ?)").run(randomUUID(), bookId, session.id, agentRole, encode(content), now());
    return content;
  }

  view(bookId: string): Record<string, unknown> {
    const session = this.store.db.prepare("SELECT * FROM discovery_sessions WHERE book_id = ? ORDER BY updated_at DESC LIMIT 1").get(bookId) as Record<string, unknown> | undefined;
    if (!session) return { session: null, turns: [], observations: [], candidates: [], scratchpad: [], charters: [], knowledgeBases: [] };
    const sessionId = String(session.id);
    const mapJson = (rows: Array<Record<string, unknown>>, keys: string[]) => rows.map((row) => { const output = { ...row }; for (const key of keys) if (typeof output[key] === "string") output[key] = decode(String(output[key])); return output; });
    return {
      session,
      turns: this.store.db.prepare("SELECT * FROM discovery_turns WHERE session_id = ? ORDER BY ordinal").all(sessionId),
      observations: mapJson(this.store.db.prepare("SELECT * FROM discovery_observations WHERE session_id = ? ORDER BY created_at").all(sessionId) as Array<Record<string, unknown>>, ["value_json"]),
      candidates: mapJson(this.store.db.prepare("SELECT * FROM story_thrust_candidates WHERE session_id = ? ORDER BY created_at").all(sessionId) as Array<Record<string, unknown>>, ["content_json"]),
      scratchpad: mapJson(this.store.db.prepare("SELECT * FROM scratchpad_entries WHERE session_id = ? ORDER BY created_at").all(sessionId) as Array<Record<string, unknown>>, ["source_refs_json"]),
      charters: mapJson(this.store.db.prepare("SELECT * FROM story_charters WHERE book_id = ? ORDER BY version DESC").all(bookId) as Array<Record<string, unknown>>, ["content_json"]),
      knowledgeBases: this.store.db.prepare("SELECT kb.*, kl.relation FROM knowledge_bases kb LEFT JOIN knowledge_links kl ON kl.target_knowledge_base_id = kb.id WHERE kb.owner_id = ? OR kl.book_id = ? ORDER BY kb.scope").all(bookId, bookId),
    };
  }
}

function capabilitiesFor(role: AgentRole): string[] {
  if (role === "sol-orchestrator") return ["discovery:read", "discovery:write", "scratchpad:read", "literary:read", "series:read", "book:read", "charter:propose", "canon:propose", "approval:request"];
  if (role === "terra-specialist") return ["discovery:read", "scratchpad:read", "scratchpad:write", "literary:read", "series:read", "book:read", "charter:propose"];
  return ["discovery:read", "scratchpad:read", "scratchpad:write", "literary:read", "book:read"];
}
