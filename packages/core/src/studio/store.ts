import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { BALANCED_READER_PANEL, BookInputSchema, ChapterInputSchema, ChapterUpdateSchema, CharacterInputSchema, ObligationInputSchema, ReaderFeedbackSchema, SeriesInputSchema } from "./domain.js";
import type { BookInput, ChapterInput, ChapterUpdate, CharacterInput, ClosureReport, JobStatus, ObligationInput, ReaderPersona, SeriesInput } from "./domain.js";

const now = () => new Date().toISOString();
const json = (value: unknown) => JSON.stringify(value ?? {});
function atomic(db: DatabaseSync, work: () => void): void {
  db.exec("BEGIN IMMEDIATE");
  try { work(); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; }
}

/** Transactional source of truth for a local InkOS Studio workspace. */
export class StudioStore {
  readonly db: DatabaseSync;

  constructor(readonly filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.migrate();
  }

  close(): void { this.db.close(); }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS series (id TEXT PRIMARY KEY, title TEXT NOT NULL, premise TEXT NOT NULL, publication_target TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE, title TEXT NOT NULL, premise TEXT NOT NULL, genre_pack TEXT NOT NULL, planned_order INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS chapters (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, number INTEGER NOT NULL, title TEXT NOT NULL, content_markdown TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(book_id, number));
      CREATE TABLE IF NOT EXISTS scenes (id TEXT PRIMARY KEY, chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL, title TEXT NOT NULL, goal TEXT NOT NULL DEFAULT '', conflict TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(chapter_id, ordinal));
      CREATE TABLE IF NOT EXISTS graph_entities (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, type TEXT NOT NULL, name TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS graph_edges (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, from_id TEXT NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE, to_id TEXT NOT NULL REFERENCES graph_entities(id) ON DELETE CASCADE, type TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS obligations (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, owner_character_id TEXT, target_chapter INTEGER, hard INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', evidence_json TEXT NOT NULL DEFAULT '[]', waiver_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS obligation_dependencies (obligation_id TEXT NOT NULL REFERENCES obligations(id) ON DELETE CASCADE, dependency_id TEXT NOT NULL REFERENCES obligations(id) ON DELETE CASCADE, PRIMARY KEY(obligation_id, dependency_id));
      CREATE TABLE IF NOT EXISTS mystery_cases (book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE, culprit TEXT NOT NULL, motive TEXT NOT NULL, means TEXT NOT NULL, opportunity TEXT NOT NULL, solution_locked INTEGER NOT NULL, approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS clues (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, title TEXT NOT NULL, evidence TEXT NOT NULL, discovered_chapter INTEGER, interpretation TEXT NOT NULL DEFAULT '', visibility TEXT NOT NULL DEFAULT 'reader-visible', payoff_chapter INTEGER, red_herring INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reader_personas (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, name TEXT NOT NULL, role TEXT NOT NULL, weight REAL NOT NULL, blocks_approval INTEGER NOT NULL, prompt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reader_feedback (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE, persona_id TEXT NOT NULL REFERENCES reader_personas(id) ON DELETE CASCADE, reaction TEXT NOT NULL, confusion TEXT NOT NULL, expectation TEXT NOT NULL, evidence TEXT NOT NULL, severity TEXT NOT NULL, recommendation TEXT NOT NULL, resolved_at TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, kind TEXT NOT NULL, subject_id TEXT NOT NULL, rationale TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, resolved_at TEXT);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, actor TEXT NOT NULL, event_type TEXT NOT NULL, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, before_json TEXT, after_json TEXT, rationale TEXT NOT NULL DEFAULT '', approval_id TEXT, source_chapter_id TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, chapter_id TEXT, content_markdown TEXT NOT NULL, reason TEXT NOT NULL, applied_by TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL, budget_cents INTEGER NOT NULL, used_cents INTEGER NOT NULL DEFAULT 0, cancellation_requested INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS budget_settings (book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE, monthly_budget_cents INTEGER NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS job_nodes (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, node_key TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, depends_on_json TEXT NOT NULL, capability TEXT NOT NULL, input_json TEXT NOT NULL DEFAULT '{}', output_json TEXT, error_json TEXT, started_at TEXT, completed_at TEXT, UNIQUE(job_id, node_key));
      CREATE TABLE IF NOT EXISTS job_events (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, node_id TEXT, level TEXT NOT NULL, message TEXT NOT NULL, data_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS knowledge_sources (id TEXT PRIMARY KEY, title TEXT NOT NULL, origin TEXT NOT NULL, license_note TEXT NOT NULL, version TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS knowledge_chunks (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE, content TEXT NOT NULL, topics_json TEXT NOT NULL, applicability_json TEXT NOT NULL, citation TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(chunk_id UNINDEXED, content, topics);
      CREATE TABLE IF NOT EXISTS research_items (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, url TEXT NOT NULL, title TEXT NOT NULL, excerpt TEXT NOT NULL, source_snapshot TEXT NOT NULL, claim TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', citation TEXT NOT NULL, created_at TEXT NOT NULL, approved_at TEXT);
    `);
  }

  createSeries(input: SeriesInput): string {
    const id = randomUUID(); const timestamp = now();
    this.db.prepare("INSERT INTO series VALUES (?, ?, ?, ?, ?, ?)").run(id, input.title, input.premise, input.publicationTarget, timestamp, timestamp);
    return id;
  }

  createBook(input: BookInput): string {
    const id = randomUUID(); const timestamp = now();
    this.db.prepare("INSERT INTO books VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, input.seriesId, input.title, input.premise, input.genrePack, input.plannedOrder, timestamp, timestamp);
    this.setReaderPanel(id, BALANCED_READER_PANEL);
    this.recordEvent(id, "author", "book.created", "book", id, null, input, "Created book");
    return id;
  }

  createChapter(input: ChapterInput): string {
    const value = ChapterInputSchema.parse(input); const id = randomUUID(); const timestamp = now();
    atomic(this.db, () => {
      this.db.prepare("INSERT INTO chapters VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)").run(id, value.bookId, value.number, value.title, value.contentMarkdown, timestamp, timestamp);
      this.saveRevision(value.bookId, id, value.contentMarkdown, "Initial chapter", "author");
      this.recordEvent(value.bookId, "author", "chapter.created", "chapter", id, null, value, `Created chapter ${value.number}`);
    });
    return id;
  }

  updateChapter(chapterId: string, input: ChapterUpdate): void {
    const value = ChapterUpdateSchema.parse(input);
    const before = this.db.prepare("SELECT * FROM chapters WHERE id = ?").get(chapterId) as { id: string; book_id: string; title: string; content_markdown: string } | undefined;
    if (!before) throw new Error("Chapter not found");
    const title = value.title ?? before.title; const content = value.contentMarkdown ?? before.content_markdown;
    atomic(this.db, () => {
      this.saveRevision(before.book_id, chapterId, content, value.reason, "author");
      this.db.prepare("UPDATE chapters SET title = ?, content_markdown = ?, updated_at = ? WHERE id = ?").run(title, content, now(), chapterId);
      this.recordEvent(before.book_id, "author", "chapter.updated", "chapter", chapterId, { title: before.title, contentMarkdown: before.content_markdown }, { title, contentMarkdown: content }, value.reason, undefined, chapterId);
    });
  }

  resolveObligation(id: string, status: "resolved" | "deferred" | "waived", rationale: string): void {
    const obligation = this.db.prepare("SELECT * FROM obligations WHERE id = ?").get(id) as { id: string; book_id: string; status: string } | undefined;
    if (!obligation) throw new Error("Obligation not found");
    if (status === "waived" && !rationale.trim()) throw new Error("A waiver requires author rationale");
    this.db.prepare("UPDATE obligations SET status = ?, waiver_reason = ?, updated_at = ? WHERE id = ?").run(status, status === "waived" ? rationale : null, now(), id);
    this.recordEvent(obligation.book_id, "author", `obligation.${status}`, "obligation", id, { status: obligation.status }, { status, rationale }, rationale);
  }

  createCharacter(input: CharacterInput): string {
    const id = randomUUID(); const timestamp = now();
    this.db.prepare("INSERT INTO graph_entities VALUES (?, ?, 'character', ?, ?, ?, ?)").run(id, input.bookId, input.name, json(input.profile), timestamp, timestamp);
    this.recordEvent(input.bookId, "author", "character.created", "character", id, null, input.profile, `Created character ${input.name}`);
    return id;
  }

  createObligation(input: ObligationInput): string {
    const id = randomUUID(); const timestamp = now();
    atomic(this.db, () => {
      this.db.prepare("INSERT INTO obligations (id,book_id,kind,title,description,owner_character_id,target_chapter,hard,status,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)")
        .run(id, input.bookId, input.kind, input.title, input.description, input.ownerCharacterId ?? null, input.targetChapter ?? null, input.hard ? 1 : 0, timestamp, timestamp);
      const dep = this.db.prepare("INSERT INTO obligation_dependencies VALUES (?, ?)");
      for (const dependency of input.dependencies) dep.run(id, dependency);
      this.recordEvent(input.bookId, "author", "obligation.created", "obligation", id, null, input, `Created ${input.kind} obligation`);
    });
    return id;
  }

  setReaderPanel(bookId: string, personas: ReadonlyArray<ReaderPersona>): void {
    atomic(this.db, () => {
      this.db.prepare("DELETE FROM reader_personas WHERE book_id = ?").run(bookId);
      const insert = this.db.prepare("INSERT INTO reader_personas VALUES (?, ?, ?, ?, ?, ?, ?)");
      for (const persona of personas) insert.run(persona.id, bookId, persona.name, persona.role, persona.weight, persona.blocksApproval ? 1 : 0, persona.prompt);
    });
  }

  recordReaderFeedback(input: { bookId: string; chapterId: string; personaId: string; reaction: string; confusion?: string; expectation?: string; evidence: string; severity: "info" | "warning" | "critical"; recommendation: string }): string {
    const value = ReaderFeedbackSchema.parse(input); const id = randomUUID();
    this.db.prepare("INSERT INTO reader_feedback VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)").run(id, value.bookId, value.chapterId, value.personaId, value.reaction, value.confusion, value.expectation, value.evidence, value.severity, value.recommendation, now());
    return id;
  }

  configureMonthlyBudget(bookId: string, monthlyBudgetCents: number): void {
    if (!Number.isInteger(monthlyBudgetCents) || monthlyBudgetCents < 0) throw new Error("Monthly budget must be a non-negative integer number of cents");
    this.db.prepare("INSERT INTO budget_settings VALUES (?, ?, ?) ON CONFLICT(book_id) DO UPDATE SET monthly_budget_cents = excluded.monthly_budget_cents, updated_at = excluded.updated_at").run(bookId, monthlyBudgetCents, now());
  }

  recordEvent(bookId: string, actor: string, eventType: string, subjectType: string, subjectId: string, before: unknown, after: unknown, rationale: string, approvalId?: string, sourceChapterId?: string): string {
    const id = randomUUID();
    this.db.prepare("INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, bookId, actor, eventType, subjectType, subjectId, before === null ? null : json(before), after === null ? null : json(after), rationale, approvalId ?? null, sourceChapterId ?? null, now());
    return id;
  }

  requestApproval(bookId: string, kind: string, subjectId: string, rationale: string): string {
    const id = randomUUID();
    this.db.prepare("INSERT INTO approvals VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL)").run(id, bookId, kind, subjectId, rationale, now());
    return id;
  }

  resolveApproval(id: string, approved: boolean): void {
    this.db.prepare("UPDATE approvals SET status = ?, resolved_at = ? WHERE id = ?").run(approved ? "approved" : "rejected", now(), id);
  }

  saveRevision(bookId: string, chapterId: string | null, content: string, reason: string, appliedBy: string): string {
    const id = randomUUID();
    this.db.prepare("INSERT INTO revisions VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, bookId, chapterId, content, reason, appliedBy, now());
    return id;
  }

  restoreRevision(revisionId: string): void {
    const revision = this.db.prepare("SELECT * FROM revisions WHERE id = ?").get(revisionId) as { book_id: string; chapter_id: string | null; content_markdown: string } | undefined;
    if (!revision?.chapter_id) throw new Error("Revision has no chapter to restore");
    this.db.prepare("UPDATE chapters SET content_markdown = ?, updated_at = ? WHERE id = ?").run(revision.content_markdown, now(), revision.chapter_id);
    this.recordEvent(revision.book_id, "author", "revision.restored", "revision", revisionId, null, { chapterId: revision.chapter_id }, "Restored revision");
  }

  createJob(bookId: string, idempotencyKey: string, budgetCents: number): string {
    const existing = this.db.prepare("SELECT id FROM jobs WHERE idempotency_key = ?").get(idempotencyKey) as { id: string } | undefined;
    if (existing) return existing.id;
    const id = randomUUID(); const timestamp = now();
    this.db.prepare("INSERT INTO jobs VALUES (?, ?, ?, 'queued', ?, 0, 0, ?, ?)").run(id, bookId, idempotencyKey, budgetCents, timestamp, timestamp);
    return id;
  }

  updateJobStatus(id: string, status: JobStatus): void { this.db.prepare("UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id); }
  chargeJob(id: string, cents: number): void {
    const job = this.db.prepare("SELECT book_id, budget_cents, used_cents FROM jobs WHERE id = ?").get(id) as { book_id: string; budget_cents: number; used_cents: number } | undefined;
    if (!job) throw new Error("Job not found");
    if (job.used_cents + cents > job.budget_cents) throw new Error("Job budget exceeded");
    const setting = this.db.prepare("SELECT monthly_budget_cents FROM budget_settings WHERE book_id = ?").get(job.book_id) as { monthly_budget_cents: number } | undefined;
    if (setting && setting.monthly_budget_cents > 0) {
      const usedThisMonth = this.db.prepare("SELECT COALESCE(SUM(used_cents), 0) AS total FROM jobs WHERE book_id = ? AND created_at >= ?").get(job.book_id, new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()) as { total: number };
      if (usedThisMonth.total + cents > setting.monthly_budget_cents) throw new Error("Monthly project budget exceeded");
    }
    this.db.prepare("UPDATE jobs SET used_cents = used_cents + ?, updated_at = ? WHERE id = ?").run(cents, now(), id);
  }

  closureReport(bookId: string): ClosureReport {
    const findings: ClosureReport["findings"][number][] = [];
    const obligations = this.db.prepare("SELECT id, title, status, hard, target_chapter, waiver_reason FROM obligations WHERE book_id = ?").all(bookId) as Array<{ id: string; title: string; status: string; hard: number; target_chapter: number | null; waiver_reason: string | null }>;
    for (const obligation of obligations) {
      if (obligation.hard && !["resolved", "deferred", "waived"].includes(obligation.status)) findings.push({ code: "OPEN_HARD_OBLIGATION", severity: "critical", entityId: obligation.id, message: `Hard obligation remains open: ${obligation.title}` });
      if (obligation.status === "waived" && !obligation.waiver_reason) findings.push({ code: "UNJUSTIFIED_WAIVER", severity: "critical", entityId: obligation.id, message: `Waiver lacks author rationale: ${obligation.title}` });
    }
    const blockedFeedback = this.db.prepare("SELECT f.id, p.name FROM reader_feedback f JOIN reader_personas p ON p.id = f.persona_id WHERE f.book_id = ? AND f.severity = 'critical' AND p.blocks_approval = 1 AND f.resolved_at IS NULL").all(bookId) as Array<{ id: string; name: string }>;
    for (const feedback of blockedFeedback) findings.push({ code: "READER_PANEL_BLOCK", severity: "critical", entityId: feedback.id, message: `Blocking reader persona feedback from ${feedback.name} remains unresolved.` });
    const mystery = this.db.prepare("SELECT * FROM mystery_cases WHERE book_id = ?").get(bookId) as { solution_locked: number } | undefined;
    if (mystery) {
      if (!mystery.solution_locked) findings.push({ code: "MYSTERY_SOLUTION_UNLOCKED", severity: "critical", message: "Mystery solution is not locked." });
      const clues = this.db.prepare("SELECT id, title, status, payoff_chapter FROM clues WHERE book_id = ?").all(bookId) as Array<{ id: string; title: string; status: string; payoff_chapter: number | null }>;
      if (!clues.some((clue) => clue.status === "resolved" && clue.payoff_chapter !== null)) findings.push({ code: "MYSTERY_NO_PAYOFF_EVIDENCE", severity: "critical", message: "Mystery has no resolved clue with a documented payoff." });
      for (const clue of clues.filter((item) => item.status === "open")) findings.push({ code: "MYSTERY_OPEN_CLUE", severity: "warning", entityId: clue.id, message: `Clue remains open: ${clue.title}` });
    }
    return { publishable: findings.every((finding) => finding.severity !== "critical"), findings, generatedAt: now() };
  }

  async exportBook(bookId: string, outputDirectory: string): Promise<void> {
    const book = this.db.prepare("SELECT title FROM books WHERE id = ?").get(bookId) as { title: string } | undefined;
    if (!book) throw new Error("Book not found");
    const chapters = this.db.prepare("SELECT number, title, content_markdown FROM chapters WHERE book_id = ? ORDER BY number").all(bookId) as Array<{ number: number; title: string; content_markdown: string }>;
    await mkdir(outputDirectory, { recursive: true });
    const manuscript = chapters.map((chapter) => `# Chapter ${chapter.number}: ${chapter.title}\n\n${chapter.content_markdown}`).join("\n\n");
    await writeFile(join(outputDirectory, "manuscript.md"), manuscript, "utf8");
    await writeFile(join(outputDirectory, "closure-report.json"), JSON.stringify(this.closureReport(bookId), null, 2), "utf8");
    await writeFile(join(outputDirectory, "book.json"), JSON.stringify({ title: book.title, exportedAt: now() }, null, 2), "utf8");
  }
}

export function openStudioStore(workspaceDirectory: string): StudioStore {
  const filename = join(workspaceDirectory, ".inkos", "studio.sqlite");
  mkdirSync(dirname(filename), { recursive: true });
  return new StudioStore(filename);
}
