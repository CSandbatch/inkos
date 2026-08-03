import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
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

/** Transactional source of truth for a local NovelGraph Studio workspace. */
export class StudioStore {
  readonly db: DatabaseSync;

  constructor(readonly filename: string, options: { failMigrationVersion?: number } = {}) {
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    try { this.migrate(options); } catch (error) { this.db.close(); throw error; }
  }

  close(): void { this.db.close(); }

  private migrate(options: { failMigrationVersion?: number }): void {
    const hadProjectSchema = Boolean(this.db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'books'").get());
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
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
      CREATE TABLE IF NOT EXISTS research_items (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, url TEXT NOT NULL, title TEXT NOT NULL, excerpt TEXT NOT NULL, source_snapshot TEXT NOT NULL, claim TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', citation TEXT NOT NULL, created_at TEXT NOT NULL, approved_at TEXT);
    `);
    this.db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES (1, 'studio-foundation', ?)").run(now());
    const fairPlayMigration = this.db.prepare("SELECT 1 FROM schema_migrations WHERE version = 2").get();
    if (!fairPlayMigration) {
      if (hadProjectSchema) this.backupBeforeMigration(2);
      const jobNodeColumns = this.db.prepare("PRAGMA table_info(job_nodes)").all() as Array<{ name: string }>;
      atomic(this.db, () => {
        if (!jobNodeColumns.some((column) => column.name === "artifact_visibility")) this.db.exec("ALTER TABLE job_nodes ADD COLUMN artifact_visibility TEXT NOT NULL DEFAULT 'author-only'");
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS mystery_policies (
            book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
            mode TEXT NOT NULL, central_crime TEXT NOT NULL, period TEXT NOT NULL, technology_level TEXT NOT NULL,
            investigator_structure TEXT NOT NULL, responsibility_model TEXT NOT NULL, prose_patterns_enabled INTEGER NOT NULL,
            rule_pack_version TEXT NOT NULL, audit_generation INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS mystery_solutions (
            book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
            content_json TEXT NOT NULL, locked INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
            approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS mystery_suspects (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, name TEXT NOT NULL, introduced_chapter INTEGER, prominent INTEGER NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS mystery_evidence (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, title TEXT NOT NULL, kind TEXT NOT NULL, reliability TEXT NOT NULL, visibility TEXT NOT NULL, first_appearance_chapter INTEGER, reveal_chapter INTEGER, required INTEGER NOT NULL, red_herring INTEGER NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS mystery_timeline (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, label TEXT NOT NULL, earliest TEXT NOT NULL, latest TEXT NOT NULL, reliability TEXT NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS mystery_access (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, character_id TEXT NOT NULL, access_kind TEXT NOT NULL, resource TEXT NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS mystery_knowledge (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, character_id TEXT NOT NULL, state TEXT NOT NULL, chapter INTEGER, content_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS mystery_hypotheses (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, kind TEXT NOT NULL, status TEXT NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS mystery_deductions (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, sequence INTEGER NOT NULL, visibility TEXT NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS validation_runs (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, rule_pack_version TEXT NOT NULL, audit_generation INTEGER NOT NULL, status TEXT NOT NULL, summary_json TEXT NOT NULL, created_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS rule_findings (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, rule_code TEXT NOT NULL, rule_pack_version TEXT NOT NULL, suite TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL, evidence_ids_json TEXT NOT NULL, entity_type TEXT, entity_id TEXT, permitted_actions_json TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT);
          CREATE TABLE IF NOT EXISTS rule_waivers (id TEXT PRIMARY KEY, finding_id TEXT NOT NULL UNIQUE REFERENCES rule_findings(id) ON DELETE CASCADE, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, rationale TEXT NOT NULL, approved_by TEXT NOT NULL, created_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS workflow_artifacts (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, node_id TEXT REFERENCES job_nodes(id) ON DELETE SET NULL, kind TEXT NOT NULL, visibility TEXT NOT NULL, rule_pack_version TEXT NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS solution_access_events (id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, job_id TEXT, node_id TEXT, actor TEXT NOT NULL, capability TEXT NOT NULL, allowed INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS idx_mystery_evidence_book ON mystery_evidence(book_id, first_appearance_chapter);
          CREATE INDEX IF NOT EXISTS idx_rule_findings_book ON rule_findings(book_id, status, severity);
          CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_job ON workflow_artifacts(job_id, visibility);
        `);
        const legacyCases = this.db.prepare("SELECT m.*, b.genre_pack FROM mystery_cases m JOIN books b ON b.id = m.book_id").all() as Array<{ book_id: string; culprit: string; motive: string; means: string; opportunity: string; solution_locked: number; genre_pack: string }>;
        const insertPolicy = this.db.prepare("INSERT OR IGNORE INTO mystery_policies VALUES (?, 'contemporary', 'Legacy mystery requiring review', 'unspecified', 'unspecified', 'principal', 'single', 1, 'fair-play-detective-2026@1', 1, ?, ?)");
        const insertSolution = this.db.prepare("INSERT OR IGNORE INTO mystery_solutions VALUES (?, ?, 0, 1, NULL, ?, ?)");
        for (const legacy of legacyCases) {
          const migratedAt = now();
          insertPolicy.run(legacy.book_id, migratedAt, migratedAt);
          insertSolution.run(legacy.book_id, json({ bookId: legacy.book_id, victimOrTarget: "Unspecified legacy target", responsibleParties: [legacy.culprit], actualEvent: `Legacy method: ${legacy.means}`, apparentEvent: "Not represented by the legacy schema", motive: { actual: legacy.motive, selfJustification: "", publicExplanation: "", investigatorInterpretation: "" }, method: legacy.means, opportunity: legacy.opportunity, concealment: "Not represented by the legacy schema", reconstruction: ["Review and complete this migrated solution before locking it."], uncertainty: "unresolved", locked: false }), migratedAt, migratedAt);
        }
        const legacyClues = this.db.prepare("SELECT * FROM clues").all() as Array<{ id: string; book_id: string; title: string; evidence: string; discovered_chapter: number | null; interpretation: string; visibility: string; payoff_chapter: number | null; red_herring: number; status: string; created_at: string; updated_at: string }>;
        const insertEvidence = this.db.prepare("INSERT OR IGNORE INTO mystery_evidence VALUES (?, ?, ?, 'physical', 'unresolved', ?, ?, ?, ?, ?, ?, ?, ?)");
        for (const clue of legacyClues) {
          const visibility = clue.visibility === "reader-visible" ? "reader-visible" : "solution-authorized";
          const content = { id: clue.id, bookId: clue.book_id, title: clue.title, kind: "physical", source: "Legacy clue ledger", reliability: "unresolved", visibility, firstAppearanceChapter: clue.discovered_chapter ?? undefined, revealChapter: clue.payoff_chapter ?? undefined, apparentMeaning: clue.evidence, trueMeaning: clue.interpretation || clue.evidence, required: clue.status === "resolved", redHerring: Boolean(clue.red_herring), corroborates: [], contradicts: [], extensions: { legacyStatus: clue.status } };
          insertEvidence.run(clue.id, clue.book_id, clue.title, visibility, clue.discovered_chapter, clue.payoff_chapter, clue.status === "resolved" ? 1 : 0, clue.red_herring, json(content), clue.created_at, clue.updated_at);
        }
        if (options.failMigrationVersion === 2) throw new Error("Injected fair-play migration failure");
        this.db.prepare("INSERT INTO schema_migrations VALUES (2, 'fair-play-detective-2026', ?)").run(now());
      });
    }
    const discoveryMigration = this.db.prepare("SELECT 1 FROM schema_migrations WHERE version = 3").get();
    if (!discoveryMigration) {
      if (hadProjectSchema) this.backupBeforeMigration(3);
      atomic(this.db, () => {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS knowledge_bases (
            id TEXT PRIMARY KEY, scope TEXT NOT NULL, owner_id TEXT, title TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
            UNIQUE(scope, owner_id)
          );
          CREATE TABLE IF NOT EXISTS knowledge_claims (
            id TEXT PRIMARY KEY, knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
            subject TEXT NOT NULL, predicate TEXT NOT NULL, value_json TEXT NOT NULL, provenance TEXT NOT NULL,
            status TEXT NOT NULL, source_refs_json TEXT NOT NULL, approval_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS knowledge_links (
            id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            target_knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
            relation TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(book_id, target_knowledge_base_id, relation)
          );
          CREATE TABLE IF NOT EXISTS discovery_sessions (
            id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            status TEXT NOT NULL, current_question TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS discovery_turns (
            id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
            ordinal INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL,
            UNIQUE(session_id, ordinal)
          );
          CREATE TABLE IF NOT EXISTS discovery_observations (
            id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
            turn_id TEXT REFERENCES discovery_turns(id) ON DELETE SET NULL, key TEXT NOT NULL, value_json TEXT NOT NULL,
            provenance TEXT NOT NULL, confidence REAL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS story_thrust_candidates (
            id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
            kind TEXT NOT NULL, content_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS story_charters (
            id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            version INTEGER NOT NULL, content_json TEXT NOT NULL, status TEXT NOT NULL,
            approval_id TEXT, created_at TEXT NOT NULL, approved_at TEXT, UNIQUE(book_id, version)
          );
          CREATE TABLE IF NOT EXISTS scratchpad_entries (
            id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
            agent_role TEXT NOT NULL, kind TEXT NOT NULL, content TEXT NOT NULL, confidence REAL,
            source_refs_json TEXT NOT NULL, created_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS context_dossiers (
            id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            session_id TEXT REFERENCES discovery_sessions(id) ON DELETE SET NULL, agent_role TEXT NOT NULL,
            content_json TEXT NOT NULL, created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_claims_kb_status ON knowledge_claims(knowledge_base_id, status);
          CREATE INDEX IF NOT EXISTS idx_discovery_book ON discovery_sessions(book_id, updated_at);
          CREATE INDEX IF NOT EXISTS idx_scratchpad_session ON scratchpad_entries(session_id, created_at);
        `);
        const literaryId = randomUUID(); const createdAt = now();
        this.db.prepare("INSERT OR IGNORE INTO knowledge_bases VALUES (?, 'literary', NULL, 'NovelGraph Literary Library', 1, ?, ?)").run(literaryId, createdAt, createdAt);
        const tableColumns = (table: string) => new Set((this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name));
        const seriesColumns = tableColumns("series"); const bookColumns = tableColumns("books");
        const seriesTitle = seriesColumns.has("title") ? "title" : "id";
        const bookTitle = bookColumns.has("title") ? "title" : "id";
        const bookSeries = bookColumns.has("series_id") ? "series_id" : "NULL AS series_id";
        const seriesRows = this.db.prepare(`SELECT id, ${seriesTitle} AS title FROM series`).all() as Array<{ id: string; title: string }>;
        const bookRows = this.db.prepare(`SELECT id, ${bookTitle} AS title, ${bookSeries} FROM books`).all() as Array<{ id: string; title: string; series_id: string | null }>;
        const insertBase = this.db.prepare("INSERT OR IGNORE INTO knowledge_bases VALUES (?, ?, ?, ?, 1, ?, ?)");
        const insertLink = this.db.prepare("INSERT OR IGNORE INTO knowledge_links VALUES (?, ?, ?, ?, ?)");
        const seriesBases = new Map<string, string>();
        for (const series of seriesRows) { const id = randomUUID(); insertBase.run(id, "series", series.id, `${series.title} series canon`, createdAt, createdAt); seriesBases.set(series.id, id); }
        for (const book of bookRows) {
          insertBase.run(randomUUID(), "book", book.id, `${book.title} book canon`, createdAt, createdAt);
          const seriesBase = book.series_id ? seriesBases.get(book.series_id) : undefined; if (seriesBase) insertLink.run(randomUUID(), book.id, seriesBase, "series-canon", createdAt);
          insertLink.run(randomUUID(), book.id, literaryId, "literary-guidance", createdAt);
        }
        if (options.failMigrationVersion === 3) throw new Error("Injected discovery migration failure");
        this.db.prepare("INSERT INTO schema_migrations VALUES (3, 'novelgraph-discovery-knowledge', ?)").run(now());
      });
    }
    // FTS5 is optional in SQLite builds shipped by some supported Node runtimes.
    // knowledge_chunks remains canonical and KnowledgeBase falls back to LIKE search.
    try {
      this.db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(chunk_id UNINDEXED, content, topics)");
    } catch {
      // A missing FTS5 extension must not prevent Studio from opening a project.
    }
  }

  private backupBeforeMigration(version: number): void {
    if (this.filename === ":memory:" || !existsSync(this.filename)) return;
    this.db.exec("PRAGMA wal_checkpoint(FULL)");
    const backupDirectory = join(dirname(this.filename), "backups");
    mkdirSync(backupDirectory, { recursive: true });
    const timestamp = now().replaceAll(":", "-");
    copyFileSync(this.filename, join(backupDirectory, `studio-pre-v${version}-${timestamp}.sqlite`));
  }

  supportsKnowledgeFts(): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'knowledge_fts'").get());
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
    const hasFairPlayPolicy = Boolean(this.db.prepare("SELECT 1 FROM mystery_policies WHERE book_id = ?").get(bookId));
    const mystery = this.db.prepare("SELECT * FROM mystery_cases WHERE book_id = ?").get(bookId) as { solution_locked: number } | undefined;
    if (mystery && !hasFairPlayPolicy) {
      if (!mystery.solution_locked) findings.push({ code: "MYSTERY_SOLUTION_UNLOCKED", severity: "critical", message: "Mystery solution is not locked." });
      const clues = this.db.prepare("SELECT id, title, status, payoff_chapter FROM clues WHERE book_id = ?").all(bookId) as Array<{ id: string; title: string; status: string; payoff_chapter: number | null }>;
      if (!clues.some((clue) => clue.status === "resolved" && clue.payoff_chapter !== null)) findings.push({ code: "MYSTERY_NO_PAYOFF_EVIDENCE", severity: "critical", message: "Mystery has no resolved clue with a documented payoff." });
      for (const clue of clues.filter((item) => item.status === "open")) findings.push({ code: "MYSTERY_OPEN_CLUE", severity: "warning", entityId: clue.id, message: `Clue remains open: ${clue.title}` });
    }
    const policy = this.db.prepare("SELECT audit_generation, mode FROM mystery_policies WHERE book_id = ?").get(bookId) as { audit_generation: number; mode: string } | undefined;
    if (policy) {
      const latestRun = this.db.prepare("SELECT id, status FROM validation_runs WHERE book_id = ? AND audit_generation = ? ORDER BY created_at DESC LIMIT 1").get(bookId, policy.audit_generation) as { id: string; status: string } | undefined;
      if (!latestRun || latestRun.status === "stale") findings.push({ code: "MYSTERY_AUDIT_REQUIRED", severity: "critical", message: "The current fair-play policy and canon require a fresh validation run." });
      if (latestRun) {
        const ruleFindings = this.db.prepare("SELECT id, rule_code, severity, status, message FROM rule_findings WHERE run_id = ? AND status = 'open'").all(latestRun.id) as Array<{ id: string; rule_code: string; severity: string; status: string; message: string }>;
        for (const item of ruleFindings) findings.push({ code: item.rule_code, severity: item.severity === "blocker" || item.severity === "major" ? "critical" : "warning", entityId: item.id, message: item.message });
      }
      const waivers = this.db.prepare("SELECT w.finding_id, w.rationale, f.rule_code FROM rule_waivers w JOIN rule_findings f ON f.id = w.finding_id WHERE w.book_id = ?").all(bookId) as Array<{ finding_id: string; rationale: string; rule_code: string }>;
      for (const waiver of waivers) findings.push({ code: `${waiver.rule_code}_WAIVED`, severity: "warning", entityId: waiver.finding_id, message: `Author waiver: ${waiver.rationale}` });
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
  const filename = join(workspaceDirectory, ".novelgraph", "studio.sqlite");
  mkdirSync(dirname(filename), { recursive: true });
  return new StudioStore(filename);
}
