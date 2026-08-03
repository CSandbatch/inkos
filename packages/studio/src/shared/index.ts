export type StatusTone = "neutral" | "active" | "attention" | "blocked" | "verified";

export interface SeriesRecord { id: string; title: string; premise: string; publication_target: string; }
export interface BookRecord { id: string; series_id: string; series_title: string; title: string; premise: string; genre_pack: string; planned_order: number; }
export interface ChapterRecord { id: string; book_id: string; number: number; title: string; content_markdown: string; status: string; updated_at: string; }
export interface ObligationRecord { id: string; book_id: string; kind: string; title: string; description: string; hard: number; status: string; target_chapter: number | null; waiver_reason?: string | null; }
export interface JobRecord { id: string; book_id: string; status: string; used_cents: number; budget_cents: number; updated_at: string; }
export interface JobNodeRecord { id: string; node_key: string; kind: string; status: string; capability: string; depends_on_json: string; artifact_visibility?: string; }
export interface GraphEntityRecord { id: string; type: string; name: string; data_json: string; }
export interface GraphEdgeRecord { id: string; from_id: string; to_id: string; type: string; data_json: string; }
export interface ReviewRecord { id: string; source: "reader" | "approval"; title: string; detail: string; severity: string; status: string; }
export interface ClosureReport { publishable: boolean; findings: Array<{ code: string; severity: string; message: string; entityId?: string }>; generatedAt: string; }
export interface DashboardData { books: BookRecord[]; jobs: JobRecord[]; obligations: ObligationRecord[]; recentEvents: Array<{ id: string; event_type: string; rationale: string; created_at: string }>; }
export interface BookWorkspace { book: BookRecord; chapters: ChapterRecord[]; revisions: Array<{ id: string; chapter_id: string | null; reason: string; applied_by: string; created_at: string }>; }
export interface GraphData { entities: GraphEntityRecord[]; edges: GraphEdgeRecord[]; obligations: ObligationRecord[]; clues: Array<Record<string, unknown>>; }
export interface JobDetail { job: JobRecord; nodes: JobNodeRecord[]; events: Array<{ id: string; level: string; message: string; created_at: string }>; artifacts?: Array<{ id: string; kind: string; visibility: string; rule_pack_version: string; created_at: string }>; solutionAccess?: Array<{ actor: string; capability: string; allowed: number; reason: string; created_at: string }>; }
export type MysteryMode = "strict-golden-age" | "contemporary" | "hybrid" | "rule-breaking";
export interface MysteryPolicyRecord { bookId: string; mode: MysteryMode; centralCrime: string; period: string; technologyLevel: string; investigatorStructure: "principal" | "ensemble"; responsibilityModel: "single" | "multiple-traceable"; prosePatternsEnabled: boolean; rulePackVersion: string; }
export interface MysteryFindingRecord { id?: string; ruleCode: string; suite: string; severity: string; status: string; message: string; evidenceIds: string[]; permittedActions: string[]; }
export interface MysteryWorkbenchData { policy: MysteryPolicyRecord | null; suspects: Array<Record<string, unknown>>; evidence: Array<Record<string, unknown>>; timeline: Array<Record<string, unknown>>; access: Array<Record<string, unknown>>; knowledge: Array<Record<string, unknown>>; hypotheses: Array<Record<string, unknown>>; deductions: Array<Record<string, unknown>>; findings: MysteryFindingRecord[]; }
export interface ReaderProjectionData { policy: Omit<MysteryPolicyRecord, "bookId">; suspects: Array<Record<string, unknown>>; evidence: Array<Record<string, unknown>>; timeline: Array<Record<string, unknown>>; knowledge: Array<Record<string, unknown>>; }
export interface ProsePatternRecord { category: string; pattern: string; line: number; column: number; context: string; excerpt: string; suggestion: string; severity: "advisory"; }
export type AgentRole = "sol-orchestrator" | "terra-specialist" | "luna-worker";
export interface DiscoveryData { session: null | { id: string; book_id: string; status: string; current_question: string | null }; turns: Array<{ id: string; ordinal: number; role: "author" | "sol"; content: string; created_at: string }>; observations: Array<Record<string, unknown>>; candidates: Array<{ id: string; kind: "core" | "stretch" | "wild"; content_json: Record<string, unknown>; status: string }>; scratchpad: Array<Record<string, unknown>>; charters: Array<{ id: string; version: number; status: string; content_json: Record<string, unknown> }>; knowledgeBases: Array<{ id: string; scope: "literary" | "series" | "book" | "run"; title: string; relation?: string }> }

export interface StudioDataSource {
  readonly mode: "local" | "demo";
  bootstrap(): Promise<{ configured: boolean; workspace: string }>;
  dashboard(): Promise<DashboardData>;
  createProject(input: { seriesTitle: string; bookTitle: string; premise: string; genrePack: string; seedMystery: boolean; mysteryMode?: MysteryMode }): Promise<{ bookId: string }>;
  book(bookId: string): Promise<BookWorkspace>;
  saveChapter(chapterId: string, input: { title?: string; contentMarkdown?: string; reason: string }): Promise<void>;
  graph(bookId: string): Promise<GraphData>;
  startJob(bookId: string, budgetCents: number): Promise<{ id: string }>;
  job(jobId: string): Promise<JobDetail>;
  reviews(bookId: string): Promise<ReviewRecord[]>;
  closure(bookId: string): Promise<ClosureReport>;
  exportBook(bookId: string): Promise<{ outputDirectory: string; files: string[] }>;
  mysteryWorkbench(bookId: string): Promise<MysteryWorkbenchData>;
  configureMystery(input: MysteryPolicyRecord): Promise<void>;
  saveMysterySolution(bookId: string, input: Record<string, unknown>): Promise<void>;
  revealMysterySolution(bookId: string): Promise<{ solution: Record<string, unknown> | null }>;
  addMysteryRecord(bookId: string, resource: "suspects" | "evidence" | "timeline" | "access" | "knowledge" | "hypotheses" | "deductions", input: Record<string, unknown>): Promise<{ id: string }>;
  readerProjection(bookId: string, throughChapter?: number): Promise<ReaderProjectionData>;
  validateMystery(bookId: string): Promise<{ runId: string; passed: boolean; findings: MysteryFindingRecord[] }>;
  waiveMysteryFinding(bookId: string, findingId: string, rationale: string): Promise<{ id: string }>;
  analyzeProse(content: string): Promise<{ findings: ProsePatternRecord[] }>;
  discovery(bookId: string): Promise<DiscoveryData>;
  addDiscoveryTurn(sessionId: string, input: { role: "author" | "sol"; content: string; observations?: Array<Record<string, unknown>> }): Promise<{ id: string }>;
  addScratchpad(sessionId: string, input: { agentRole: AgentRole; kind: string; content: string; confidence?: number; sourceRefs?: string[] }): Promise<{ id: string }>;
  proposeThrust(sessionId: string, input: Record<string, unknown>): Promise<{ id: string }>;
  proposeCharter(bookId: string, input: Record<string, unknown>): Promise<{ id: string; version: number; approvalId: string }>;
  resolveCharter(charterId: string, approved: boolean, rationale: string): Promise<void>;
  dossier(bookId: string, role: AgentRole): Promise<Record<string, unknown>>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`);
  return body;
}

export class LocalStudioDataSource implements StudioDataSource {
  readonly mode = "local" as const;
  bootstrap = () => request<{ configured: boolean; workspace: string }>("/bootstrap");
  dashboard = () => request<DashboardData>("/dashboard");
  createProject = (input: { seriesTitle: string; bookTitle: string; premise: string; genrePack: string; seedMystery: boolean; mysteryMode?: MysteryMode }) => request<{ bookId: string }>("/projects", { method: "POST", body: JSON.stringify(input) });
  book = (bookId: string) => request<BookWorkspace>(`/books/${bookId}`);
  saveChapter = async (chapterId: string, input: { title?: string; contentMarkdown?: string; reason: string }) => { await request(`/chapters/${chapterId}`, { method: "PATCH", body: JSON.stringify(input) }); };
  graph = (bookId: string) => request<GraphData>(`/books/${bookId}/graph`);
  startJob = (bookId: string, budgetCents: number) => request<{ id: string }>(`/books/${bookId}/jobs`, { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), budgetCents }) });
  job = (jobId: string) => request<JobDetail>(`/jobs/${jobId}`);
  reviews = (bookId: string) => request<ReviewRecord[]>(`/books/${bookId}/reviews`);
  closure = (bookId: string) => request<ClosureReport>(`/books/${bookId}/closure`);
  exportBook = (bookId: string) => request<{ outputDirectory: string; files: string[] }>(`/books/${bookId}/export`, { method: "POST" });
  mysteryWorkbench = (bookId: string) => request<MysteryWorkbenchData>(`/books/${bookId}/mystery/workbench`);
  configureMystery = async (input: MysteryPolicyRecord) => { await request(`/books/${input.bookId}/mystery/policy`, { method: "PUT", body: JSON.stringify(input) }); };
  saveMysterySolution = async (bookId: string, input: Record<string, unknown>) => { await request(`/books/${bookId}/mystery/solution`, { method: "PUT", headers: { "x-novelgraph-capability": "solution:write" }, body: JSON.stringify(input) }); };
  revealMysterySolution = (bookId: string) => request<{ solution: Record<string, unknown> | null }>(`/books/${bookId}/mystery/solution`, { headers: { "x-novelgraph-capability": "solution:read" } });
  addMysteryRecord = (bookId: string, resource: "suspects" | "evidence" | "timeline" | "access" | "knowledge" | "hypotheses" | "deductions", input: Record<string, unknown>) => request<{ id: string }>(`/books/${bookId}/mystery/${resource}`, { method: "POST", body: JSON.stringify(input) });
  readerProjection = (bookId: string, throughChapter = 999999) => request<ReaderProjectionData>(`/books/${bookId}/mystery/reader-projection?throughChapter=${throughChapter}`);
  validateMystery = (bookId: string) => request<{ runId: string; passed: boolean; findings: MysteryFindingRecord[] }>(`/books/${bookId}/mystery/validate`, { method: "POST" });
  waiveMysteryFinding = (bookId: string, findingId: string, rationale: string) => request<{ id: string }>(`/books/${bookId}/mystery/findings/${findingId}/waive`, { method: "POST", body: JSON.stringify({ rationale }) });
  analyzeProse = (content: string) => request<{ findings: ProsePatternRecord[] }>("/prose-patterns/analyze", { method: "POST", body: JSON.stringify({ content }) });
  discovery = (bookId: string) => request<DiscoveryData>(`/books/${bookId}/discovery`);
  addDiscoveryTurn = (sessionId: string, input: { role: "author" | "sol"; content: string; observations?: Array<Record<string, unknown>> }) => request<{ id: string }>(`/discovery/${sessionId}/turns`, { method: "POST", body: JSON.stringify(input) });
  addScratchpad = (sessionId: string, input: { agentRole: AgentRole; kind: string; content: string; confidence?: number; sourceRefs?: string[] }) => request<{ id: string }>(`/discovery/${sessionId}/scratchpad`, { method: "POST", body: JSON.stringify(input) });
  proposeThrust = (sessionId: string, input: Record<string, unknown>) => request<{ id: string }>(`/discovery/${sessionId}/thrusts`, { method: "POST", body: JSON.stringify(input) });
  proposeCharter = (bookId: string, input: Record<string, unknown>) => request<{ id: string; version: number; approvalId: string }>(`/books/${bookId}/charters`, { method: "POST", body: JSON.stringify(input) });
  resolveCharter = async (charterId: string, approved: boolean, rationale: string) => { await request(`/charters/${charterId}/resolve`, { method: "POST", body: JSON.stringify({ approved, rationale }) }); };
  dossier = (bookId: string, role: AgentRole) => request<Record<string, unknown>>(`/books/${bookId}/dossiers/${role}`);
}

const chapterText = `The clock in Calder House had stopped at 11:43. Mara found the brass key beneath the victim's untouched teacup, where anyone entering from the hall could have seen it.\n\nElias claimed he heard the clock strike midnight from the garden. Mara wrote the statement down twice. A stopped clock could not testify, but a liar often volunteered a witness.`;
const demoBook: BookRecord = { id: "demo-book", series_id: "demo-series", series_title: "The Calder House Files", title: "A Clock Without Hands", premise: "A locked-room death is solved through what the witnesses could not have heard.", genre_pack: "mystery", planned_order: 1 };
const demoChapter: ChapterRecord = { id: "demo-chapter", book_id: demoBook.id, number: 1, title: "The Silent Chime", content_markdown: chapterText, status: "draft", updated_at: new Date().toISOString() };
const demoObligations: ObligationRecord[] = [
  { id: "ob-clock", book_id: demoBook.id, kind: "clue", title: "Explain the stopped clock", description: "Resolve why Elias reports a midnight chime.", hard: 1, status: "open", target_chapter: 8 },
  { id: "ob-key", book_id: demoBook.id, kind: "setup", title: "Pay off the brass key", description: "Connect the key to cellar access.", hard: 1, status: "progressing", target_chapter: 5 }
];
const demoPolicy: MysteryPolicyRecord = { bookId: demoBook.id, mode: "hybrid", centralCrime: "The staged locked-room murder of Lucian Calder", period: "2026", technologyLevel: "Contemporary domestic surveillance", investigatorStructure: "principal", responsibilityModel: "single", prosePatternsEnabled: true, rulePackVersion: "fair-play-detective-2026@1" };
const demoEvidence = [
  { id: "ev-clock", bookId: demoBook.id, title: "The silent clock", kind: "chronology", source: "Calder House clock", reliability: "established", visibility: "reader-visible", firstAppearanceChapter: 1, revealChapter: 8, apparentMeaning: "The clock marks the death", trueMeaning: "Elias could not have heard midnight", required: true, redHerring: false },
  { id: "ev-camera", bookId: demoBook.id, title: "Garden camera gap", kind: "digital", source: "Motion camera", reliability: "plausible", visibility: "reader-visible", firstAppearanceChapter: 3, apparentMeaning: "No one crossed the garden", trueMeaning: "Motion activation missed a slow crossing", required: false, redHerring: true, extensions: { activation: "motion", blindSpot: "north wall", clockAccuracy: "+43 seconds" } },
];
const demoFindings: MysteryFindingRecord[] = [{ id: "finding-clock", ruleCode: "FP-DISCLOSURE-003", suite: "fair-disclosure", severity: "blocker", status: "open", message: "The clock clue is not yet linked to the final deduction.", evidenceIds: ["ev-clock"], permittedActions: ["revise"] }];

export class FixtureStudioDataSource implements StudioDataSource {
  readonly mode = "demo" as const;
  private content = demoChapter.content_markdown;
  bootstrap = async () => ({ configured: true, workspace: "Read-only public demonstration" });
  dashboard = async (): Promise<DashboardData> => ({ books: [demoBook], jobs: [{ id: "demo-job", book_id: demoBook.id, status: "blocked", used_cents: 18, budget_cents: 75, updated_at: new Date().toISOString() }], obligations: demoObligations, recentEvents: [{ id: "e1", event_type: "audit.blocked", rationale: "A witness reports hearing a stopped clock.", created_at: new Date().toISOString() }] });
  createProject = async () => ({ bookId: demoBook.id });
  book = async (_bookId?: string) => ({ book: demoBook, chapters: [{ ...demoChapter, content_markdown: this.content }], revisions: [{ id: "rev-1", chapter_id: demoChapter.id, reason: "Initial draft", applied_by: "writer-agent", created_at: new Date().toISOString() }] });
  saveChapter = async (_id: string, input: { title?: string; contentMarkdown?: string; reason: string }) => { if (input.contentMarkdown !== undefined) this.content = input.contentMarkdown; };
  graph = async (_bookId?: string) => ({ entities: [{ id: "mara", type: "character", name: "Mara Voss", data_json: "{}" }, { id: "elias", type: "suspect", name: "Elias Calder", data_json: "{}" }, { id: "clock", type: "object", name: "Stopped clock", data_json: "{}" }], edges: [{ id: "edge-1", from_id: "elias", to_id: "clock", type: "contradicts", data_json: "{}" }, { id: "edge-2", from_id: "mara", to_id: "clock", type: "observed", data_json: "{}" }], obligations: demoObligations, clues: [{ id: "clue-clock", title: "The silent clock", status: "open", visibility: "reader-visible" }] });
  startJob = async (_bookId?: string, _budgetCents?: number) => ({ id: "demo-job" });
  job = async (_jobId?: string) => ({ job: { id: "demo-job", book_id: demoBook.id, status: "blocked", used_cents: 18, budget_cents: 75, updated_at: new Date().toISOString() }, nodes: ["policy", "research", "solution", "evidence", "timeline", "solution-approval", "scene-plan", "draft", "validate", "adversarial", "fairness", "realism", "reader-panel", "prose", "revise", "reaudit", "approval"].map((key, index) => ({ id: key, node_key: key, kind: key, status: index < 9 ? "completed" : index === 9 ? "blocked" : "pending", capability: index === 2 ? "solution:write" : index < 7 ? "solution:read" : "reader-view:read", depends_on_json: "[]" })), events: [{ id: "j1", level: "warning", message: "Adversarial solver found an unsupported alternative timeline", created_at: new Date().toISOString() }] });
  reviews = async (_bookId?: string): Promise<ReviewRecord[]> => [{ id: "review-1", source: "reader", title: "Impossible auditory evidence", detail: "Elias says he heard midnight strike, but the clock stopped at 11:43.", severity: "critical", status: "open" }, { id: "review-2", source: "approval", title: "Canon change requires approval", detail: "Moving the clock failure later would alter the locked solution.", severity: "warning", status: "pending" }];
  closure = async (_bookId?: string) => ({ publishable: false, findings: [{ code: "OPEN_HARD_OBLIGATION", severity: "critical", message: "Hard obligation remains open: Explain the stopped clock", entityId: "ob-clock" }], generatedAt: new Date().toISOString() });
  exportBook = async (_bookId?: string) => ({ outputDirectory: "Demo exports are not written", files: ["manuscript.md", "closure-report.json", "book.json"] });
  mysteryWorkbench = async (_bookId?: string): Promise<MysteryWorkbenchData> => ({ policy: demoPolicy, suspects: [{ id: "elias", bookId: demoBook.id, name: "Elias Calder", relationshipToTarget: "Nephew", visibleMotive: "Inheritance", introducedChapter: 1, prominent: true }], evidence: demoEvidence, timeline: [{ id: "time-death", bookId: demoBook.id, label: "Estimated death", earliest: "2026-10-14T23:35:00-05:00", latest: "2026-10-14T23:50:00-05:00", reliability: "highly-probable", timeKind: "estimated", source: "Medical examination" }], access: [{ id: "access-cellar", characterId: "elias", accessKind: "physical", resource: "Cellar stair", evidenceIds: ["ev-clock"] }], knowledge: [{ id: "know-clock", characterId: "elias", fact: "The clock had stopped", state: "conceals", chapter: 1 }], hypotheses: [{ id: "hyp-false", kind: "false", summary: "An intruder entered through the garden", status: "active", supportingEvidence: ["ev-camera"], falsifyingEvidence: ["ev-clock"] }], deductions: [{ id: "ded-clock", conclusion: "Elias fabricated the midnight time", evidenceIds: ["ev-clock"], sequence: 1, visibility: "solution-authorized" }], findings: demoFindings });
  configureMystery = async (_input: MysteryPolicyRecord) => undefined;
  saveMysterySolution = async (_bookId: string, _input: Record<string, unknown>) => undefined;
  revealMysterySolution = async (_bookId: string) => ({ solution: { victimOrTarget: "Lucian Calder", responsibleParties: ["Elias Calder"], actualEvent: "Elias staged the time of death around the stopped clock.", apparentEvent: "An intruder killed Lucian at midnight.", motive: { actual: "Exposure of forged accounts" }, method: "A prepared sedative and staged fall", opportunity: "Private tea service", concealment: "False midnight testimony", reconstruction: ["The clock was silent before Elias entered the garden"], uncertainty: "established", locked: true } });
  addMysteryRecord = async (_bookId: string, _resource: "suspects" | "evidence" | "timeline" | "access" | "knowledge" | "hypotheses" | "deductions", _input: Record<string, unknown>) => ({ id: "demo-record" });
  readerProjection = async (_bookId?: string, throughChapter = 999999): Promise<ReaderProjectionData> => { const { bookId: _id, ...policy } = demoPolicy; return { policy, suspects: [{ id: "elias", name: "Elias Calder", relationshipToTarget: "Nephew", introducedChapter: 1 }], evidence: demoEvidence.filter((item) => item.firstAppearanceChapter <= throughChapter).map(({ trueMeaning: _true, ...item }) => item), timeline: [], knowledge: [] }; };
  validateMystery = async (_bookId?: string) => ({ runId: "demo-validation", passed: false, findings: demoFindings });
  waiveMysteryFinding = async (_bookId: string, _findingId: string, _rationale: string) => ({ id: "demo-waiver" });
  analyzeProse = async (content: string) => ({ findings: content.toLowerCase().includes("at its core") ? [{ category: "significance-claim", pattern: "At its core", line: 1, column: 1, context: "narration", excerpt: content, suggestion: "Name the concrete consequence.", severity: "advisory" as const }] : [] });
  discovery = async (_bookId?: string): Promise<DiscoveryData> => ({
    session: { id: "demo-discovery", book_id: demoBook.id, status: "charter-proposed", current_question: "What must the final explanation force Mara to admit about her own method?" },
    turns: [
      { id: "turn-1", ordinal: 1, role: "sol", content: "What experience should remain after the final explanation?", created_at: new Date().toISOString() },
      { id: "turn-2", ordinal: 2, role: "author", content: "Recognition: the reader should realize the silent clock testified before anyone did.", created_at: new Date().toISOString() },
    ],
    observations: [{ key: "reader-effect", value_json: "retrospective recognition", provenance: "author-stated", confidence: 1, status: "working" }],
    candidates: [
      { id: "thrust-core", kind: "core", status: "proposed", content_json: { title: "The impossible witness", mainThrust: "A detective treats a stopped clock as the only witness that cannot revise its testimony.", readerPromise: ["Every decisive fact appears before the reveal"], characterEngine: "Mara trusts systems more than people until both fail differently.", centralConflict: "A polished family story conflicts with physical chronology." } },
      { id: "thrust-stretch", kind: "stretch", status: "proposed", content_json: { title: "The honest machine", mainThrust: "Every person lies about time while an unreliable device preserves one bounded truth.", readerPromise: ["Technology is evidence, never an oracle"], characterEngine: "Mara must distinguish error from deception.", centralConflict: "Human motive and technical uncertainty reinforce each other." } },
      { id: "thrust-wild", kind: "wild", status: "proposed", content_json: { title: "A house rehearses midnight", mainThrust: "The household coordinates a false midnight without sharing the same reason.", readerPromise: ["The collective deception still terminates in one traceable killer"], characterEngine: "Mara reconstructs private loyalties from incompatible lies.", centralConflict: "A shared alibi conceals separate betrayals." } },
    ],
    scratchpad: [{ agent_role: "terra-specialist", kind: "contradiction", content: "The clock must be fallible as a device but decisive as a limit on what Elias could hear.", confidence: 0.92 }],
    charters: [],
    knowledgeBases: [{ id: "kb-literary", scope: "literary", title: "NovelGraph Literary Library", relation: "literary-guidance" }, { id: "kb-series", scope: "series", title: "Calder House series canon", relation: "series-canon" }, { id: "kb-book", scope: "book", title: "A Clock Without Hands book canon" }],
  });
  addDiscoveryTurn = async () => ({ id: "demo-turn" });
  addScratchpad = async () => ({ id: "demo-scratchpad" });
  proposeThrust = async () => ({ id: "demo-thrust" });
  proposeCharter = async () => ({ id: "demo-charter", version: 1, approvalId: "demo-charter-approval" });
  resolveCharter = async () => undefined;
  dossier = async (_bookId: string, role: AgentRole) => ({ agentRole: role, charter: null, knowledgeBases: ["literary", "series", "book"], scratchpad: ["The stopped clock constrains the testimony."], unresolved: ["Mara's personal cost"], capabilities: role === "sol-orchestrator" ? ["charter:propose", "approval:request"] : ["scratchpad:write"] });
}
