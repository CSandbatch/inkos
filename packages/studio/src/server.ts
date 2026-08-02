import { serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import {
  ApprovalResolutionSchema, BookInputSchema, ChapterInputSchema, ChapterUpdateSchema,
  MysteryCaseInputSchema, MysteryLedger, ObligationInputSchema, openStudioStore,
  ResearchService, seedCuratedKnowledge, SeriesInputSchema, WorkflowHarness, KnowledgeBase,
} from "@actalk/inkos-core";

export interface StartStudioOptions {
  projectRoot: string;
  port?: number;
  host?: string;
  openBrowser?: boolean;
}

const staticRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "client");
const appCleanup = new WeakMap<object, () => void>();

function openUrl(url: string): void {
  const [command, args] = process.platform === "win32"
    ? ["cmd", ["/c", "start", "", url]]
    : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

export function createStudioApp(projectRoot: string): Hono {
  const store = openStudioStore(projectRoot);
  appCleanup.set(store, () => store.close());
  seedCuratedKnowledge(store);
  const harness = new WorkflowHarness(store);
  const mystery = new MysteryLedger(store);
  const knowledge = new KnowledgeBase(store);
  const research = new ResearchService(store);
  const app = new Hono();
  app.use("/api/*", cors());

  app.get("/api/v1/health", (c) => c.json({ ok: true }));
  app.get("/api/v1/bootstrap", (c) => {
    const count = store.db.prepare("SELECT COUNT(*) AS count FROM books").get() as { count: number };
    return c.json({ configured: count.count > 0, workspace: projectRoot });
  });
  app.get("/api/v1/dashboard", (c) => c.json({
    books: store.db.prepare("SELECT b.*, s.title AS series_title FROM books b JOIN series s ON s.id = b.series_id ORDER BY b.updated_at DESC").all(),
    jobs: store.db.prepare("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 10").all(),
    obligations: store.db.prepare("SELECT * FROM obligations WHERE status IN ('open', 'progressing') ORDER BY hard DESC, updated_at DESC").all(),
    recentEvents: store.db.prepare("SELECT id, event_type, rationale, created_at FROM events ORDER BY created_at DESC LIMIT 10").all(),
  }));
  app.post("/api/v1/projects", async (c) => {
    const body = await c.req.json<{ seriesTitle: string; bookTitle: string; premise: string; genrePack: string; seedMystery?: boolean }>();
    const seriesId = store.createSeries(SeriesInputSchema.parse({ title: body.seriesTitle, premise: body.premise, publicationTarget: "general" }));
    const bookId = store.createBook(BookInputSchema.parse({ seriesId, title: body.bookTitle, premise: body.premise, genrePack: body.genrePack, plannedOrder: 1 }));
    store.createChapter(ChapterInputSchema.parse({ bookId, number: 1, title: "Opening", contentMarkdown: "" }));
    if (body.seedMystery) {
      mystery.lockSolution(MysteryCaseInputSchema.parse({ bookId, culprit: "Undecided suspect", motive: "To be established", means: "To be established", opportunity: "To be established", solutionLocked: false }));
      store.createObligation(ObligationInputSchema.parse({ bookId, kind: "clue", title: "Establish the decisive clue", description: "Plant fair evidence before drafting the reveal.", hard: true, dependencies: [] }));
    }
    return c.json({ bookId }, 201);
  });
  app.get("/api/v1/books/:bookId", (c) => {
    const id = c.req.param("bookId");
    const book = store.db.prepare("SELECT b.*, s.title AS series_title FROM books b JOIN series s ON s.id = b.series_id WHERE b.id = ?").get(id);
    if (!book) return c.json({ error: "Book not found" }, 404);
    return c.json({ book, chapters: store.db.prepare("SELECT * FROM chapters WHERE book_id = ? ORDER BY number").all(id), revisions: store.db.prepare("SELECT id, chapter_id, reason, applied_by, created_at FROM revisions WHERE book_id = ? ORDER BY created_at DESC LIMIT 30").all(id) });
  });
  app.patch("/api/v1/chapters/:chapterId", async (c) => { store.updateChapter(c.req.param("chapterId"), ChapterUpdateSchema.parse(await c.req.json())); return c.json({ ok: true }); });
  app.get("/api/v1/books/:bookId/closure", (c) => c.json(store.closureReport(c.req.param("bookId"))));
  app.get("/api/v1/books/:bookId/graph", (c) => { const id = c.req.param("bookId"); return c.json({ entities: store.db.prepare("SELECT * FROM graph_entities WHERE book_id = ?").all(id), edges: store.db.prepare("SELECT * FROM graph_edges WHERE book_id = ?").all(id), obligations: store.db.prepare("SELECT * FROM obligations WHERE book_id = ?").all(id), clues: store.db.prepare("SELECT * FROM clues WHERE book_id = ?").all(id) }); });
  app.get("/api/v1/books/:bookId/reviews", (c) => {
    const id = c.req.param("bookId");
    const reader = store.db.prepare("SELECT f.id, 'reader' AS source, p.name || ' review' AS title, f.recommendation AS detail, f.severity, CASE WHEN f.resolved_at IS NULL THEN 'open' ELSE 'resolved' END AS status FROM reader_feedback f JOIN reader_personas p ON p.id = f.persona_id WHERE f.book_id = ?").all(id);
    const approvals = store.db.prepare("SELECT id, 'approval' AS source, kind AS title, rationale AS detail, 'warning' AS severity, status FROM approvals WHERE book_id = ?").all(id);
    return c.json([...reader, ...approvals]);
  });
  app.post("/api/v1/books/:bookId/mystery", async (c) => { mystery.lockSolution(MysteryCaseInputSchema.parse({ ...(await c.req.json()), bookId: c.req.param("bookId") })); return c.json({ ok: true }); });
  app.post("/api/v1/books/:bookId/jobs", async (c) => { const body = await c.req.json<{ idempotencyKey: string; budgetCents: number }>(); const id = harness.start(c.req.param("bookId"), { idempotencyKey: body.idempotencyKey, budgetCents: body.budgetCents, capabilities: new Set(["research", "write", "canon", "publish"]) }); return c.json({ id }, 201); });
  app.get("/api/v1/jobs/:jobId", (c) => { const id = c.req.param("jobId"); const job = store.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id); if (!job) return c.json({ error: "Job not found" }, 404); return c.json({ job, nodes: store.db.prepare("SELECT * FROM job_nodes WHERE job_id = ? ORDER BY rowid").all(id), events: store.db.prepare("SELECT * FROM job_events WHERE job_id = ? ORDER BY created_at").all(id) }); });
  app.post("/api/v1/jobs/:jobId/cancel", (c) => { harness.requestCancellation(c.req.param("jobId")); return c.json({ ok: true }); });
  app.post("/api/v1/jobs/:jobId/resume", (c) => { harness.resume(c.req.param("jobId")); return c.json({ ok: true }); });
  app.post("/api/v1/approvals/:approvalId/resolve", async (c) => { const body = ApprovalResolutionSchema.parse(await c.req.json()); store.resolveApproval(c.req.param("approvalId"), body.approved); return c.json({ ok: true, rationale: body.rationale }); });
  app.post("/api/v1/obligations/:obligationId/resolve", async (c) => { const body = await c.req.json<{ status: "resolved" | "deferred" | "waived"; rationale: string }>(); store.resolveObligation(c.req.param("obligationId"), body.status, body.rationale); return c.json({ ok: true }); });
  app.post("/api/v1/books/:bookId/research", async (c) => { const body = await c.req.json<{ url: string; claim: string }>(); return c.json({ id: await research.collect(c.req.param("bookId"), body.url, body.claim) }, 201); });
  app.get("/api/v1/knowledge/search", (c) => c.json({ matches: knowledge.search(c.req.query("q") ?? "") }));
  app.post("/api/v1/books/:bookId/export", async (c) => { const id = c.req.param("bookId"); const outputDirectory = join(projectRoot, ".inkos", "exports", id); await store.exportBook(id, outputDirectory); return c.json({ outputDirectory, files: readdirSync(outputDirectory) }); });

  app.onError((error, c) => c.json({ error: error.message }, 400));
  app.use("/*", serveStatic({ root: staticRoot }));
  app.get("/*", serveStatic({ root: staticRoot, path: "index.html" }));
  appCleanup.set(app, () => store.close());
  return app;
}

export async function startStudio(options: StartStudioOptions): Promise<{ server: ServerType; url: string }> {
  const host = options.host ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") process.stderr.write("Warning: InkOS Studio is being exposed beyond this device.\n");
  mkdirSync(join(options.projectRoot, ".inkos"), { recursive: true });
  const app = createStudioApp(options.projectRoot);
  const server = serve({ fetch: app.fetch, hostname: host, port: options.port ?? 4567 });
  server.once("close", () => appCleanup.get(app)?.());
  if (!server.listening) await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? 4567;
  const url = `http://${host === "::1" ? "[::1]" : host}:${port}`;
  if (options.openBrowser !== false) setTimeout(() => openUrl(url), 250);
  return { server, url };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const projectRoot = process.env.INKOS_PROJECT_ROOT ?? process.cwd();
  void startStudio({ projectRoot, port: Number(process.env.INKOS_STUDIO_PORT ?? 4567), host: process.env.INKOS_STUDIO_HOST }).then(({ url }) => process.stdout.write(`InkOS Studio: ${url}\n`));
}
