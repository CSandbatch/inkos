export type StatusTone = "neutral" | "active" | "attention" | "blocked" | "verified";

export interface SeriesRecord { id: string; title: string; premise: string; publication_target: string; }
export interface BookRecord { id: string; series_id: string; series_title: string; title: string; premise: string; genre_pack: string; planned_order: number; }
export interface ChapterRecord { id: string; book_id: string; number: number; title: string; content_markdown: string; status: string; updated_at: string; }
export interface ObligationRecord { id: string; book_id: string; kind: string; title: string; description: string; hard: number; status: string; target_chapter: number | null; waiver_reason?: string | null; }
export interface JobRecord { id: string; book_id: string; status: string; used_cents: number; budget_cents: number; updated_at: string; }
export interface JobNodeRecord { id: string; node_key: string; kind: string; status: string; capability: string; depends_on_json: string; }
export interface GraphEntityRecord { id: string; type: string; name: string; data_json: string; }
export interface GraphEdgeRecord { id: string; from_id: string; to_id: string; type: string; data_json: string; }
export interface ReviewRecord { id: string; source: "reader" | "approval"; title: string; detail: string; severity: string; status: string; }
export interface ClosureReport { publishable: boolean; findings: Array<{ code: string; severity: string; message: string; entityId?: string }>; generatedAt: string; }
export interface DashboardData { books: BookRecord[]; jobs: JobRecord[]; obligations: ObligationRecord[]; recentEvents: Array<{ id: string; event_type: string; rationale: string; created_at: string }>; }
export interface BookWorkspace { book: BookRecord; chapters: ChapterRecord[]; revisions: Array<{ id: string; chapter_id: string | null; reason: string; applied_by: string; created_at: string }>; }
export interface GraphData { entities: GraphEntityRecord[]; edges: GraphEdgeRecord[]; obligations: ObligationRecord[]; clues: Array<Record<string, unknown>>; }
export interface JobDetail { job: JobRecord; nodes: JobNodeRecord[]; events: Array<{ id: string; level: string; message: string; created_at: string }>; }

export interface StudioDataSource {
  readonly mode: "local" | "demo";
  bootstrap(): Promise<{ configured: boolean; workspace: string }>;
  dashboard(): Promise<DashboardData>;
  createProject(input: { seriesTitle: string; bookTitle: string; premise: string; genrePack: string; seedMystery: boolean }): Promise<{ bookId: string }>;
  book(bookId: string): Promise<BookWorkspace>;
  saveChapter(chapterId: string, input: { title?: string; contentMarkdown?: string; reason: string }): Promise<void>;
  graph(bookId: string): Promise<GraphData>;
  startJob(bookId: string, budgetCents: number): Promise<{ id: string }>;
  job(jobId: string): Promise<JobDetail>;
  reviews(bookId: string): Promise<ReviewRecord[]>;
  closure(bookId: string): Promise<ClosureReport>;
  exportBook(bookId: string): Promise<{ outputDirectory: string; files: string[] }>;
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
  createProject = (input: { seriesTitle: string; bookTitle: string; premise: string; genrePack: string; seedMystery: boolean }) => request<{ bookId: string }>("/projects", { method: "POST", body: JSON.stringify(input) });
  book = (bookId: string) => request<BookWorkspace>(`/books/${bookId}`);
  saveChapter = async (chapterId: string, input: { title?: string; contentMarkdown?: string; reason: string }) => { await request(`/chapters/${chapterId}`, { method: "PATCH", body: JSON.stringify(input) }); };
  graph = (bookId: string) => request<GraphData>(`/books/${bookId}/graph`);
  startJob = (bookId: string, budgetCents: number) => request<{ id: string }>(`/books/${bookId}/jobs`, { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), budgetCents }) });
  job = (jobId: string) => request<JobDetail>(`/jobs/${jobId}`);
  reviews = (bookId: string) => request<ReviewRecord[]>(`/books/${bookId}/reviews`);
  closure = (bookId: string) => request<ClosureReport>(`/books/${bookId}/closure`);
  exportBook = (bookId: string) => request<{ outputDirectory: string; files: string[] }>(`/books/${bookId}/export`, { method: "POST" });
}

const chapterText = `The clock in Calder House had stopped at 11:43. Mara found the brass key beneath the victim's untouched teacup, where anyone entering from the hall could have seen it.\n\nElias claimed he heard the clock strike midnight from the garden. Mara wrote the statement down twice. A stopped clock could not testify, but a liar often volunteered a witness.`;
const demoBook: BookRecord = { id: "demo-book", series_id: "demo-series", series_title: "The Calder House Files", title: "A Clock Without Hands", premise: "A locked-room death is solved through what the witnesses could not have heard.", genre_pack: "mystery", planned_order: 1 };
const demoChapter: ChapterRecord = { id: "demo-chapter", book_id: demoBook.id, number: 1, title: "The Silent Chime", content_markdown: chapterText, status: "draft", updated_at: new Date().toISOString() };
const demoObligations: ObligationRecord[] = [
  { id: "ob-clock", book_id: demoBook.id, kind: "clue", title: "Explain the stopped clock", description: "Resolve why Elias reports a midnight chime.", hard: 1, status: "open", target_chapter: 8 },
  { id: "ob-key", book_id: demoBook.id, kind: "setup", title: "Pay off the brass key", description: "Connect the key to cellar access.", hard: 1, status: "progressing", target_chapter: 5 }
];

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
  job = async (_jobId?: string) => ({ job: { id: "demo-job", book_id: demoBook.id, status: "blocked", used_cents: 18, budget_cents: 75, updated_at: new Date().toISOString() }, nodes: ["research", "outline", "scene-plan", "draft", "validate", "graph-update", "audit", "reader-panel", "revise", "approval"].map((key, index) => ({ id: key, node_key: key, kind: key, status: index < 6 ? "completed" : index === 6 ? "blocked" : "pending", capability: index < 3 ? "canon" : "write", depends_on_json: "[]" })), events: [{ id: "j1", level: "warning", message: "Continuity audit blocked: impossible auditory evidence", created_at: new Date().toISOString() }] });
  reviews = async (_bookId?: string): Promise<ReviewRecord[]> => [{ id: "review-1", source: "reader", title: "Impossible auditory evidence", detail: "Elias says he heard midnight strike, but the clock stopped at 11:43.", severity: "critical", status: "open" }, { id: "review-2", source: "approval", title: "Canon change requires approval", detail: "Moving the clock failure later would alter the locked solution.", severity: "warning", status: "pending" }];
  closure = async (_bookId?: string) => ({ publishable: false, findings: [{ code: "OPEN_HARD_OBLIGATION", severity: "critical", message: "Hard obligation remains open: Explain the stopped clock", entityId: "ob-clock" }], generatedAt: new Date().toISOString() });
  exportBook = async (_bookId?: string) => ({ outputDirectory: "Demo exports are not written", files: ["manuscript.md", "closure-report.json", "book.json"] });
}
