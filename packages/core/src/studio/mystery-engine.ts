import { randomUUID } from "node:crypto";
import type { StudioStore } from "./store.js";
import {
  AccessRecordSchema, DeductionSchema, FAIR_PLAY_RULE_PACK, HypothesisSchema, KnowledgeRecordSchema,
  MODE_POLICIES, MysteryEvidenceSchema, MysteryPolicySchema, MysterySolutionSchema, MysterySuspectSchema,
  RuleFindingSchema, TimelineEventSchema,
  type ArtifactVisibility, type MysteryCapability, type MysteryEvidence, type MysteryPolicy, type MysterySolution, type RuleFinding,
} from "./mystery-spec.js";

const timestamp = () => new Date().toISOString();
const json = (value: unknown) => JSON.stringify(value);
type StoredJson = { id: string; content_json: string };

export interface ReaderProjection {
  readonly policy: Omit<MysteryPolicy, "bookId">;
  readonly suspects: ReadonlyArray<Record<string, unknown>>;
  readonly evidence: ReadonlyArray<Record<string, unknown>>;
  readonly timeline: ReadonlyArray<Record<string, unknown>>;
  readonly knowledge: ReadonlyArray<Record<string, unknown>>;
}

/** Canonical fair-play state and capability-filtered projections. */
export class MysteryEngine {
  constructor(private readonly store: StudioStore) {}

  getPolicy(bookId: string): MysteryPolicy | null {
    const row = this.store.db.prepare("SELECT * FROM mystery_policies WHERE book_id = ?").get(bookId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return MysteryPolicySchema.parse({ bookId, mode: row.mode, centralCrime: row.central_crime, period: row.period, technologyLevel: row.technology_level, investigatorStructure: row.investigator_structure, responsibilityModel: row.responsibility_model, prosePatternsEnabled: Boolean(row.prose_patterns_enabled), rulePackVersion: row.rule_pack_version });
  }

  configurePolicy(input: unknown): void {
    const value = MysteryPolicySchema.parse(input); const existing = this.getPolicy(value.bookId); const now = timestamp();
    const policyChanged = Boolean(existing && JSON.stringify(existing) !== JSON.stringify(value));
    if (existing && existing.mode !== value.mode) {
      const subject = `mystery-mode:${existing.mode}->${value.mode}`;
      const approval = this.store.db.prepare("SELECT id FROM approvals WHERE book_id = ? AND kind = 'outline-change' AND subject_id = ? AND status = 'approved' ORDER BY resolved_at DESC LIMIT 1").get(value.bookId, subject) as { id: string } | undefined;
      if (!approval) {
        const pending = this.store.db.prepare("SELECT id FROM approvals WHERE book_id = ? AND kind = 'outline-change' AND subject_id = ? AND status = 'pending' LIMIT 1").get(value.bookId, subject) as { id: string } | undefined;
        const id = pending?.id ?? this.store.requestApproval(value.bookId, "outline-change", subject, `Changing fair-play mode from ${existing.mode} to ${value.mode} requires a complete re-audit.`);
        throw new Error(`Mystery mode change requires approved request ${id}`);
      }
    }
    this.store.db.prepare(`INSERT INTO mystery_policies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(book_id) DO UPDATE SET mode=excluded.mode, central_crime=excluded.central_crime, period=excluded.period, technology_level=excluded.technology_level,
      investigator_structure=excluded.investigator_structure, responsibility_model=excluded.responsibility_model, prose_patterns_enabled=excluded.prose_patterns_enabled,
      rule_pack_version=excluded.rule_pack_version, audit_generation=mystery_policies.audit_generation + CASE WHEN
        mystery_policies.mode <> excluded.mode OR mystery_policies.central_crime <> excluded.central_crime OR mystery_policies.period <> excluded.period OR
        mystery_policies.technology_level <> excluded.technology_level OR mystery_policies.investigator_structure <> excluded.investigator_structure OR
        mystery_policies.responsibility_model <> excluded.responsibility_model OR mystery_policies.prose_patterns_enabled <> excluded.prose_patterns_enabled OR
        mystery_policies.rule_pack_version <> excluded.rule_pack_version THEN 1 ELSE 0 END, updated_at=excluded.updated_at`)
      .run(value.bookId, value.mode, value.centralCrime, value.period, value.technologyLevel, value.investigatorStructure, value.responsibilityModel, value.prosePatternsEnabled ? 1 : 0, value.rulePackVersion, now, now);
    if (existing && existing.mode !== value.mode) {
      this.store.db.prepare("UPDATE approvals SET status = 'applied' WHERE book_id = ? AND kind = 'outline-change' AND subject_id = ? AND status = 'approved'").run(value.bookId, `mystery-mode:${existing.mode}->${value.mode}`);
    }
    if (policyChanged) this.invalidateAudits(value.bookId, "Mystery policy changed");
    this.store.recordEvent(value.bookId, "author", "mystery.policy.configured", "mystery-policy", value.bookId, existing, value, existing ? "Updated fair-play policy" : "Configured fair-play policy");
  }

  getSolution(bookId: string, capability: MysteryCapability, actor = "author", jobId?: string, nodeId?: string): MysterySolution | null {
    const allowed = capability === "solution:read";
    this.recordSolutionAccess(bookId, actor, capability, allowed, allowed ? "Capability granted" : "Capability denied", jobId, nodeId);
    if (!allowed) throw new Error("solution:read capability is required");
    const row = this.store.db.prepare("SELECT content_json FROM mystery_solutions WHERE book_id = ?").get(bookId) as { content_json: string } | undefined;
    return row ? MysterySolutionSchema.parse(JSON.parse(row.content_json)) : null;
  }

  saveSolution(input: unknown, capability: MysteryCapability = "solution:write"): void {
    if (capability !== "solution:write") throw new Error("solution:write capability is required");
    const value = MysterySolutionSchema.parse(input); const existing = this.store.db.prepare("SELECT content_json, locked, revision FROM mystery_solutions WHERE book_id = ?").get(value.bookId) as { content_json: string; locked: number; revision: number } | undefined;
    if (existing?.locked) {
      const approval = this.store.db.prepare("SELECT id FROM approvals WHERE book_id = ? AND kind = 'canon-retcon' AND subject_id = ? AND status = 'approved' ORDER BY resolved_at DESC LIMIT 1").get(value.bookId, "sealed-solution") as { id: string } | undefined;
      if (!approval) {
        const id = this.store.requestApproval(value.bookId, "canon-retcon", "sealed-solution", "Changing the locked sealed solution requires author approval and re-audit.");
        throw new Error(`Sealed solution is locked; approve retcon ${id}`);
      }
    }
    const now = timestamp();
    this.store.db.prepare(`INSERT INTO mystery_solutions VALUES (?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(book_id) DO UPDATE SET content_json=excluded.content_json, locked=excluded.locked, revision=mystery_solutions.revision + 1, approved_at=excluded.approved_at, updated_at=excluded.updated_at`)
      .run(value.bookId, json(value), value.locked ? 1 : 0, value.locked ? now : null, now, now);
    if (existing) {
      this.store.db.prepare("UPDATE approvals SET status = 'applied' WHERE book_id = ? AND kind = 'canon-retcon' AND subject_id = 'sealed-solution' AND status = 'approved'").run(value.bookId);
      this.invalidateAudits(value.bookId, "Sealed solution changed");
    }
    this.store.recordEvent(value.bookId, "author", value.locked ? "mystery.solution.locked" : "mystery.solution.saved", "sealed-solution", value.bookId, existing ? JSON.parse(existing.content_json) : null, { locked: value.locked }, "Updated sealed solution");
  }

  addSuspect(input: unknown): string { const value = MysterySuspectSchema.parse(input); return this.insertJson("mystery_suspects", value.bookId, value, ["name", "introduced_chapter", "prominent"], [value.name, value.introducedChapter ?? null, value.prominent ? 1 : 0]); }
  addEvidence(input: unknown): string { const value = MysteryEvidenceSchema.parse(input); return this.insertJson("mystery_evidence", value.bookId, value, ["title", "kind", "reliability", "visibility", "first_appearance_chapter", "reveal_chapter", "required", "red_herring"], [value.title, value.kind, value.reliability, value.visibility, value.firstAppearanceChapter ?? null, value.revealChapter ?? null, value.required ? 1 : 0, value.redHerring ? 1 : 0]); }
  addTimelineEvent(input: unknown): string { const value = TimelineEventSchema.parse(input); return this.insertJson("mystery_timeline", value.bookId, value, ["label", "earliest", "latest", "reliability"], [value.label, value.earliest, value.latest, value.reliability]); }
  addAccess(input: unknown): string { const value = AccessRecordSchema.parse(input); return this.insertJson("mystery_access", value.bookId, value, ["character_id", "access_kind", "resource"], [value.characterId, value.accessKind, value.resource]); }
  addKnowledge(input: unknown): string { const value = KnowledgeRecordSchema.parse(input); return this.insertJson("mystery_knowledge", value.bookId, value, ["character_id", "state", "chapter"], [value.characterId, value.state, value.chapter ?? null]); }
  addHypothesis(input: unknown): string { const value = HypothesisSchema.parse(input); return this.insertJson("mystery_hypotheses", value.bookId, value, ["kind", "status"], [value.kind, value.status]); }
  addDeduction(input: unknown): string { const value = DeductionSchema.parse(input); return this.insertJson("mystery_deductions", value.bookId, value, ["sequence", "visibility"], [value.sequence, value.visibility]); }

  workbench(bookId: string, solutionAuthorized = false): Record<string, unknown> {
    const suspects = this.rows("mystery_suspects", bookId);
    const evidence = this.rows("mystery_evidence", bookId);
    const timeline = this.rows("mystery_timeline", bookId);
    const access = this.rows("mystery_access", bookId);
    const knowledge = this.rows("mystery_knowledge", bookId);
    const hypotheses = this.rows("mystery_hypotheses", bookId);
    const deductions = this.rows("mystery_deductions", bookId);
    return {
      policy: this.getPolicy(bookId),
      suspects: solutionAuthorized ? suspects : suspects.map(stripPrivate),
      evidence: solutionAuthorized ? evidence : evidence.map(sanitizeReaderValue),
      timeline: solutionAuthorized ? timeline : timeline.filter(isReaderVisible).map(stripPrivate),
      access: solutionAuthorized ? access : [],
      knowledge: solutionAuthorized ? knowledge : knowledge.filter(isReaderVisible).map(stripPrivate),
      hypotheses: solutionAuthorized ? hypotheses : [],
      deductions: solutionAuthorized ? deductions : deductions.filter(isReaderVisible).map(sanitizeReaderValue),
      findings: this.currentFindings(bookId),
    };
  }

  readerProjection(bookId: string, throughChapter = Number.MAX_SAFE_INTEGER): ReaderProjection {
    const policy = this.getPolicy(bookId); if (!policy) throw new Error("Mystery policy not configured");
    const suspects = this.rows("mystery_suspects", bookId).filter((item) => !item.introducedChapter || Number(item.introducedChapter) <= throughChapter).map(stripPrivate);
    const visibleEvidenceIds = new Set(this.rows("mystery_evidence", bookId).filter((item) => item.visibility === "reader-visible" && (!item.firstAppearanceChapter || Number(item.firstAppearanceChapter) <= throughChapter)).map((item) => String(item.id)));
    const evidence = this.rows("mystery_evidence", bookId).filter((item) => visibleEvidenceIds.has(String(item.id))).map((item) => ({ ...sanitizeReaderValue(item), corroborates: ((item.corroborates as string[] | undefined) ?? []).filter((id) => visibleEvidenceIds.has(id)), contradicts: ((item.contradicts as string[] | undefined) ?? []).filter((id) => visibleEvidenceIds.has(id)) }));
    const timeline = this.rows("mystery_timeline", bookId).filter((item) => item.visibility === "reader-visible" && (!item.firstAppearanceChapter || Number(item.firstAppearanceChapter) <= throughChapter)).map(stripPrivate);
    const knowledge = this.rows("mystery_knowledge", bookId).filter((item) => item.visibility === "reader-visible" && (!item.chapter || Number(item.chapter) <= throughChapter)).map(stripPrivate);
    const { bookId: _bookId, ...publicPolicy } = policy;
    return { policy: publicPolicy, suspects, evidence, timeline, knowledge };
  }

  validate(bookId: string): { runId: string; passed: boolean; findings: RuleFinding[] } {
    const policy = this.getPolicy(bookId); const solutionRow = this.store.db.prepare("SELECT content_json, locked FROM mystery_solutions WHERE book_id = ?").get(bookId) as { content_json: string; locked: number } | undefined;
    const evidence = this.rows("mystery_evidence", bookId) as unknown as MysteryEvidence[]; const deductions = this.rows("mystery_deductions", bookId); const timeline = this.rows("mystery_timeline", bookId); const access = this.rows("mystery_access", bookId); const hypotheses = this.rows("mystery_hypotheses", bookId);
    const approvedResearch = new Set((this.store.db.prepare("SELECT id FROM research_items WHERE book_id = ? AND status = 'approved'").all(bookId) as Array<{ id: string }>).map((item) => item.id));
    const findings: RuleFinding[] = []; const finding = (value: Omit<RuleFinding, "id" | "bookId" | "rulePackVersion" | "status">) => findings.push(RuleFindingSchema.parse({ ...value, bookId, rulePackVersion: FAIR_PLAY_RULE_PACK, status: "open" }));
    if (!policy) finding({ ruleCode: "FP-POLICY-001", suite: "fair-disclosure", severity: "blocker", message: "Fair-play policy is not configured.", evidenceIds: [], permittedActions: ["revise"] });
    if (!solutionRow) finding({ ruleCode: "CAUSAL-SOLUTION-001", suite: "causal-completeness", severity: "blocker", message: "A sealed true event and apparent event are required.", evidenceIds: [], permittedActions: ["revise"] });
    if (solutionRow && !solutionRow.locked) finding({ ruleCode: "CAUSAL-SOLUTION-002", suite: "causal-completeness", severity: "blocker", message: "The solution must be author-approved and locked before closure.", evidenceIds: [], permittedActions: ["revise"] });
    if (policy) {
      const mode = MODE_POLICIES[policy.mode]; const solution = solutionRow ? MysterySolutionSchema.parse(JSON.parse(solutionRow.content_json)) : null;
      if (mode.murderRequired && !/murder|homicide|killing|death/i.test(policy.centralCrime)) finding({ ruleCode: "MODE-STRICT-001", suite: "fair-disclosure", severity: "blocker", message: "Strict Golden Age mode requires murder as the central crime.", evidenceIds: [], permittedActions: ["revise", "change-mode"] });
      if (mode.singleResponsiblePartyRequired && solution && solution.responsibleParties.length !== 1) finding({ ruleCode: "MODE-STRICT-002", suite: "causal-completeness", severity: "blocker", message: "Strict Golden Age mode requires one principal responsible party.", evidenceIds: [], permittedActions: ["revise", "change-mode"] });
    }
    for (const item of evidence) {
      const id = String(item.id ?? "");
      if (item.required && item.visibility !== "reader-visible") finding({ ruleCode: "FP-DISCLOSURE-001", suite: "fair-disclosure", severity: "blocker", message: `Required evidence is not reader-visible: ${item.title}`, evidenceIds: id ? [id] : [], permittedActions: ["revise"] });
      if (item.required && !item.firstAppearanceChapter) finding({ ruleCode: "FP-DISCLOSURE-002", suite: "fair-disclosure", severity: "blocker", message: `Required evidence has no first appearance: ${item.title}`, evidenceIds: id ? [id] : [], permittedActions: ["revise"] });
      if (item.firstAppearanceChapter && item.revealChapter && item.firstAppearanceChapter >= item.revealChapter) finding({ ruleCode: "FP-DISCLOSURE-003", suite: "fair-disclosure", severity: "blocker", message: `Evidence must appear before its reveal: ${item.title}`, evidenceIds: id ? [id] : [], permittedActions: ["revise"] });
      if (item.required && (item.kind === "digital" || item.kind === "forensic") && Object.keys(item.extensions).length === 0) finding({ ruleCode: item.kind === "digital" ? "DIGITAL-PROVENANCE-001" : "FORENSIC-METHOD-001", suite: item.kind === "digital" ? "digital-realism" : "forensic-realism", severity: "major", message: `${item.kind} evidence requires provenance, method, limitations, and corroboration metadata: ${item.title}`, evidenceIds: id ? [id] : [], permittedActions: ["review", "revise"] });
      if (item.required && (item.kind === "digital" || item.kind === "forensic")) { const researchIds = (item.extensions.researchIds as string[] | undefined) ?? []; if (!researchIds.length || researchIds.some((researchId) => !approvedResearch.has(researchId))) finding({ ruleCode: item.kind === "digital" ? "DIGITAL-RESEARCH-001" : "FORENSIC-RESEARCH-001", suite: item.kind === "digital" ? "digital-realism" : "forensic-realism", severity: "major", message: `Decisive ${item.kind} evidence requires author-admitted cited research: ${item.title}`, evidenceIds: id ? [id] : [], permittedActions: ["review", "revise"] }); }
      if (item.redHerring && hypotheses.every((candidate) => !(candidate.falsifyingEvidence as string[] | undefined)?.includes(id))) finding({ ruleCode: "FP-RED-HERRING-001", suite: "reader-trust", severity: "major", message: `Red herring lacks a documented reversal: ${item.title}`, evidenceIds: id ? [id] : [], permittedActions: ["review", "revise"] });
      if (item.extensions.establishesGuiltAlone === true || item.extensions.oracleSource === true) finding({ ruleCode: "ORACLE-001", suite: "anti-oracle", severity: "blocker", message: `An oracle-like result cannot independently establish guilt: ${item.title}`, evidenceIds: id ? [id] : [], permittedActions: ["revise"] });
      if (item.extensions.narratorFalseFact === true) finding({ ruleCode: "READER-TRUST-001", suite: "reader-trust", severity: "blocker", message: `Narration cannot state a false fact to protect the solution: ${item.title}`, evidenceIds: id ? [id] : [], permittedActions: ["revise"] });
    }
    const evidenceIds = new Set(evidence.map((item) => String(item.id)));
    for (const deduction of deductions) for (const id of deduction.evidenceIds as string[]) if (!evidenceIds.has(id)) finding({ ruleCode: "FP-DEDUCTION-001", suite: "fair-disclosure", severity: "blocker", message: `A deduction references absent evidence: ${deduction.conclusion}`, evidenceIds: [id], permittedActions: ["revise"] });
    for (const item of timeline) { const earliest = Date.parse(String(item.earliest)); const latest = Date.parse(String(item.latest)); if (Number.isFinite(earliest) && Number.isFinite(latest) && earliest > latest) finding({ ruleCode: "TIME-RANGE-001", suite: "causal-completeness", severity: "blocker", message: `Timeline range is impossible: ${item.label}`, evidenceIds: [], entityType: "timeline", entityId: String(item.id), permittedActions: ["revise"] }); }
    if (solutionRow && access.length === 0) finding({ ruleCode: "ACCESS-001", suite: "causal-completeness", severity: "blocker", message: "The responsible party has no documented physical, digital, or technical access.", evidenceIds: [], permittedActions: ["revise"] });
    if (!hypotheses.some((item) => item.kind === "alternative")) finding({ ruleCode: "ALT-SOLUTION-001", suite: "alternative-solution", severity: "major", message: "No alternative solution has been tested against the same evidence.", evidenceIds: [], permittedActions: ["review", "revise"] });
    if (hypotheses.some((item) => item.kind === "alternative" && item.equallySupported === true)) finding({ ruleCode: "ALT-SOLUTION-001", suite: "alternative-solution", severity: "blocker", message: "An alternative solution explains the evidence equally well.", evidenceIds: [], permittedActions: ["revise"] });
    const suspectRows = this.rows("mystery_suspects", bookId);
    for (const suspect of suspectRows) if (/identity|accent|occupation|class|disability|culture|ethnicity|nationality/i.test(String((suspect.extensions as Record<string, unknown> | undefined)?.suspicionBasis ?? ""))) finding({ ruleCode: "STEREOTYPE-001", suite: "anti-stereotype", severity: "blocker", message: `Suspicion of ${suspect.name} relies on identity or social shorthand rather than evidence.`, evidenceIds: [], entityType: "suspect", entityId: String(suspect.id), permittedActions: ["revise"] });
    const knowledgeRows = this.rows("mystery_knowledge", bookId); const evidenceById = new Map(evidence.map((item) => [String(item.id), item]));
    for (const record of knowledgeRows) for (const evidenceId of record.evidenceIds as string[]) { const source = evidenceById.get(evidenceId); if (record.chapter && source?.firstAppearanceChapter && Number(record.chapter) < source.firstAppearanceChapter) finding({ ruleCode: "READER-TRUST-001", suite: "reader-trust", severity: "blocker", message: `Character knowledge appears before its supporting evidence: ${record.fact}`, evidenceIds: [evidenceId], entityType: "knowledge", entityId: String(record.id), permittedActions: ["revise"] }); }
    const generation = (this.store.db.prepare("SELECT audit_generation FROM mystery_policies WHERE book_id = ?").get(bookId) as { audit_generation: number } | undefined)?.audit_generation ?? 1;
    const runId = randomUUID(); const passed = !findings.some((item) => item.severity === "blocker" || item.severity === "major");
    this.store.db.prepare("INSERT INTO validation_runs VALUES (?, ?, ?, ?, ?, ?, ?)").run(runId, bookId, FAIR_PLAY_RULE_PACK, generation, passed ? "passed" : "blocked", json({ count: findings.length }), timestamp());
    const insert = this.store.db.prepare("INSERT INTO rule_findings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)");
    for (const item of findings) { const id = randomUUID(); insert.run(id, runId, bookId, item.ruleCode, item.rulePackVersion, item.suite, item.severity, item.status, item.message, json(item.evidenceIds), item.entityType ?? null, item.entityId ?? null, json(item.permittedActions), timestamp()); }
    return { runId, passed, findings };
  }

  currentFindings(bookId: string): RuleFinding[] {
    const policy = this.store.db.prepare("SELECT audit_generation FROM mystery_policies WHERE book_id = ?").get(bookId) as { audit_generation: number } | undefined;
    const run = this.store.db.prepare("SELECT id FROM validation_runs WHERE book_id = ? AND audit_generation = ? ORDER BY created_at DESC, rowid DESC LIMIT 1").get(bookId, policy?.audit_generation ?? 1) as { id: string } | undefined;
    if (!run) return [];
    const rows = this.store.db.prepare("SELECT * FROM rule_findings WHERE run_id = ? ORDER BY created_at, rowid").all(run.id) as Array<Record<string, unknown>>;
    return rows.map((row) => RuleFindingSchema.parse({ id: row.id, bookId: row.book_id, ruleCode: row.rule_code, rulePackVersion: row.rule_pack_version, suite: row.suite, severity: row.severity, status: row.status, message: row.message, evidenceIds: JSON.parse(String(row.evidence_ids_json)), entityType: row.entity_type ?? undefined, entityId: row.entity_id ?? undefined, permittedActions: JSON.parse(String(row.permitted_actions_json)) }));
  }

  waiveFinding(bookId: string, findingId: string, rationale: string): string {
    const policy = this.getPolicy(bookId); if (policy?.mode !== "rule-breaking") throw new Error("Blocker waivers require rule-breaking mode");
    if (!rationale.trim()) throw new Error("A waiver requires author rationale");
    const finding = this.store.db.prepare("SELECT severity, status FROM rule_findings WHERE id = ? AND book_id = ?").get(findingId, bookId) as { severity: string; status: string } | undefined;
    if (!finding) throw new Error("Finding not found");
    if (finding.severity !== "blocker") throw new Error("Only blocker findings use fair-play waivers; review or resolve other findings");
    const id = randomUUID(); this.store.db.prepare("INSERT INTO rule_waivers VALUES (?, ?, ?, ?, 'author', ?)").run(id, findingId, bookId, rationale, timestamp());
    this.store.db.prepare("UPDATE rule_findings SET status = 'waived', resolved_at = ? WHERE id = ?").run(timestamp(), findingId);
    this.store.recordEvent(bookId, "author", "mystery.finding.waived", "rule-finding", findingId, finding, { rationale }, rationale);
    return id;
  }

  private insertJson(table: string, bookId: string, value: Record<string, unknown>, columns: string[], values: Array<string | number | null>): string {
    const id = typeof value.id === "string" ? value.id : randomUUID(); const now = timestamp(); const placeholders = ["?", "?", ...columns.map(() => "?"), "?", "?", "?"].join(", ");
    this.store.db.prepare(`INSERT INTO ${table} (id, book_id, ${columns.join(", ")}, content_json, created_at, updated_at) VALUES (${placeholders})`).run(id, bookId, ...values, json({ ...value, id }), now, now);
    this.invalidateAudits(bookId, `${table} changed`); return id;
  }

  private rows(table: string, bookId: string): Array<Record<string, unknown>> {
    return (this.store.db.prepare(`SELECT id, content_json FROM ${table} WHERE book_id = ? ORDER BY rowid`).all(bookId) as StoredJson[]).map((row) => ({ ...JSON.parse(row.content_json) as Record<string, unknown>, id: row.id }));
  }

  private invalidateAudits(bookId: string, reason: string): void {
    this.store.db.prepare("UPDATE validation_runs SET status = 'stale' WHERE book_id = ? AND status <> 'stale'").run(bookId);
    this.store.recordEvent(bookId, "system", "mystery.audit.invalidated", "book", bookId, null, null, reason);
  }

  private recordSolutionAccess(bookId: string, actor: string, capability: MysteryCapability, allowed: boolean, reason: string, jobId?: string, nodeId?: string): void {
    this.store.db.prepare("INSERT INTO solution_access_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(randomUUID(), bookId, jobId ?? null, nodeId ?? null, actor, capability, allowed ? 1 : 0, reason, timestamp());
  }
}

function stripPrivate(item: Record<string, unknown>): Record<string, unknown> {
  const { trueMeaning: _trueMeaning, reasonNotResponsible: _reason, hiddenPressure: _pressure, actualMovements: _movements, secretUnrelatedToCrime: _secret, extensions: _extensions, ...publicItem } = item;
  return publicItem;
}

function sanitizeReaderValue(item: Record<string, unknown>): Record<string, unknown> {
  const blocked = /^(trueMeaning|culprit|solution|secret|actualEvent|actualMovements|reasonNotResponsible|hiddenPressure|extensions)$/i;
  return Object.fromEntries(Object.entries(item).filter(([key]) => !blocked.test(key)).map(([key, value]) => [key, sanitizeReaderUnknown(value)]));
}

function sanitizeReaderUnknown(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeReaderUnknown);
  if (value && typeof value === "object") return sanitizeReaderValue(value as Record<string, unknown>);
  return value;
}

function isReaderVisible(item: Record<string, unknown>): boolean { return item.visibility === "reader-visible"; }
