import { serve, type ServerType } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import {
  AgentCapabilitySchema, ApprovalResolutionSchema, BookInputSchema, ChapterInputSchema, ChapterUpdateSchema,
  ObligationInputSchema, openStudioStore,
  ResearchService, seedCuratedKnowledge, SeriesInputSchema, WorkflowHarness, KnowledgeBase,
  AccessRecordSchema, analyzeEnglishProsePatterns, DeductionSchema, HypothesisSchema, KnowledgeRecordSchema,
  MYSTERY_WORKFLOW, MysteryCapabilitySchema, MysteryEngine, MysteryEvidenceSchema, MysteryPolicySchema,
  MysterySolutionSchema, MysterySuspectSchema, TimelineEventSchema, DiscoveryEngine,
  DiscoveryTurnInputSchema, ScratchpadEntryInputSchema, StoryThrustCandidateInputSchema,
  StoryCharterInputSchema, KnowledgeClaimInputSchema, AgentRoleSchema,
  beginLogin, logout as logoutProvider, statusAll, describeStorage, loadProvider, saveProviderConfig,
  MissingClientIdError, OAuthError, type DeviceAuthorization, type StoredCredential,
} from "@actalk/novelgraph-core";

export interface StartStudioOptions {
  projectRoot: string;
  port?: number;
  host?: string;
  openBrowser?: boolean;
}

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const productionStaticRoot = join(moduleDirectory, "..", "client");
const staticRoot = existsSync(productionStaticRoot) ? productionStaticRoot : join(moduleDirectory, "client");
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
  const fairPlay = new MysteryEngine(store);
  const knowledge = new KnowledgeBase(store);
  const research = new ResearchService(store);
  const discovery = new DiscoveryEngine(store);
  const app = new Hono();
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
    const body = await c.req.json<{ seriesTitle: string; bookTitle: string; premise: string; genrePack: string; seedMystery?: boolean; mysteryMode?: "strict-golden-age" | "contemporary" | "hybrid" | "rule-breaking" }>();
    const seriesId = store.createSeries(SeriesInputSchema.parse({ title: body.seriesTitle, premise: body.premise, publicationTarget: "general" }));
    const bookId = store.createBook(BookInputSchema.parse({ seriesId, title: body.bookTitle, premise: body.premise, genrePack: body.genrePack, plannedOrder: 1 }));
    const sessionId = discovery.start(bookId);
    const seed = body.premise.trim() || `A ${body.genrePack} novel whose governing pressure remains to be discovered.`;
    discovery.addTurn(sessionId, { role: "sol", content: "What experience should remain with the reader after the final page?", observations: [] });
    discovery.proposeThrust(sessionId, { kind: "core", title: "The stated pressure", mainThrust: seed, readerPromise: ["The opening notion develops through traceable consequences"], characterEngine: "The protagonist's pursuit exposes a private contradiction.", centralConflict: "The stated premise meets sustained opposition.", thematicPressure: "What does the pursuit cost?", genreObligations: [body.genrePack], endingShape: "The central pressure receives a legible consequence.", risks: ["The initial notion may not yet sustain a full book."], forecloses: [] });
    discovery.proposeThrust(sessionId, { kind: "stretch", title: "The costly interpretation", mainThrust: `${seed} The protagonist must also sacrifice the belief that made the pursuit possible.`, readerPromise: ["External resolution and character consequence converge"], characterEngine: "Success threatens the protagonist's self-conception.", centralConflict: "The solution and the protagonist's preferred identity cannot both survive unchanged.", thematicPressure: "Which belief deserves to fail?", genreObligations: [body.genrePack], endingShape: "Resolution forces a chosen loss.", risks: ["The character pressure may overpower the genre engine."], forecloses: ["A consequence-free resolution"] });
    discovery.proposeThrust(sessionId, { kind: "wild", title: "The unstable account", mainThrust: `${seed} Every major participant understands that premise differently, and the plot tests which account can survive evidence.`, readerPromise: ["Competing accounts produce distinct causal consequences"], characterEngine: "Characters act from incompatible models of the same event.", centralConflict: "No shared account of the story's central fact remains stable.", thematicPressure: "Who controls an event after it becomes a story?", genreObligations: [body.genrePack], endingShape: "One account wins factually while another retains emotional force.", risks: ["Multiple accounts may diffuse the main line."], forecloses: ["A single uncontested interpretation"] });
    if (body.seedMystery) {
      fairPlay.configurePolicy(MysteryPolicySchema.parse({ bookId, mode: body.mysteryMode ?? "contemporary", centralCrime: "A consequential hidden event", period: "contemporary", technologyLevel: "contemporary", investigatorStructure: "principal", responsibilityModel: body.mysteryMode === "strict-golden-age" ? "single" : "multiple-traceable", prosePatternsEnabled: true }));
      store.createObligation(ObligationInputSchema.parse({ bookId, kind: "clue", title: "Establish the decisive clue", description: "Plant fair evidence before drafting the reveal.", hard: true, dependencies: [] }));
    }
    return c.json({ bookId }, 201);
  });
  app.post("/api/v1/books/:bookId/discovery", (c) => c.json({ sessionId: discovery.start(c.req.param("bookId")) }, 201));
  app.get("/api/v1/books/:bookId/discovery", (c) => c.json(discovery.view(c.req.param("bookId"))));
  app.post("/api/v1/discovery/:sessionId/turns", async (c) => c.json({ id: discovery.addTurn(c.req.param("sessionId"), DiscoveryTurnInputSchema.parse(await c.req.json())) }, 201));
  app.post("/api/v1/discovery/:sessionId/scratchpad", async (c) => c.json({ id: discovery.addScratchpad(c.req.param("sessionId"), ScratchpadEntryInputSchema.parse(await c.req.json())) }, 201));
  app.post("/api/v1/discovery/:sessionId/thrusts", async (c) => c.json({ id: discovery.proposeThrust(c.req.param("sessionId"), StoryThrustCandidateInputSchema.parse(await c.req.json())) }, 201));
  app.post("/api/v1/books/:bookId/charters", async (c) => c.json(discovery.proposeCharter(c.req.param("bookId"), StoryCharterInputSchema.parse(await c.req.json())), 201));
  app.post("/api/v1/charters/:charterId/resolve", async (c) => { const body = await c.req.json<{ approved: boolean; rationale: string }>(); discovery.resolveCharter(c.req.param("charterId"), body.approved, body.rationale); return c.json({ ok: true }); });
  app.post("/api/v1/knowledge/claims", async (c) => c.json({ id: discovery.addClaim(KnowledgeClaimInputSchema.parse(await c.req.json())) }, 201));
  app.post("/api/v1/books/:bookId/knowledge/claims/:claimId/promote", async (c) => { const body = await c.req.json<{ rationale: string }>(); return c.json({ approvalId: discovery.promoteClaim(c.req.param("claimId"), c.req.param("bookId"), body.rationale) }); });
  app.get("/api/v1/books/:bookId/dossiers/:agentRole", (c) => c.json(discovery.dossier(c.req.param("bookId"), AgentRoleSchema.parse(c.req.param("agentRole")))));
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
  app.post("/api/v1/books/:bookId/reviews/:reviewId/resolve", async (c) => {
    const body = await c.req.json<{ approved: boolean; rationale: string }>();
    if (!body.rationale?.trim()) return c.json({ error: "A rationale is required" }, 400);
    const bookId = c.req.param("bookId"); const reviewId = c.req.param("reviewId");
    const reader = store.db.prepare("SELECT id FROM reader_feedback WHERE id = ? AND book_id = ? AND resolved_at IS NULL").get(reviewId, bookId);
    const approval = store.db.prepare("SELECT id FROM approvals WHERE id = ? AND book_id = ? AND status = 'pending'").get(reviewId, bookId);
    if (!reader && !approval) return c.json({ error: "Open review not found" }, 404);
    if (reader) {
      store.db.prepare("UPDATE reader_feedback SET resolved_at = ? WHERE id = ? AND book_id = ?").run(new Date().toISOString(), reviewId, bookId);
      store.recordEvent(bookId, "author", body.approved ? "review.approved" : "review.rejected", "reader-feedback", reviewId, null, { approved: body.approved }, body.rationale);
    } else {
      store.resolveApproval(reviewId, body.approved);
      store.recordEvent(bookId, "author", body.approved ? "approval.approved" : "approval.rejected", "approval", reviewId, null, { approved: body.approved }, body.rationale);
    }
    return c.json({ ok: true });
  });
  app.post("/api/v1/books/:bookId/mystery", (c) => c.json({ error: "Deprecated endpoint. Use /api/v1/books/:bookId/mystery/solution with solution:write capability." }, 410));
  app.get("/api/v1/books/:bookId/mystery/workbench", (c) => c.json(fairPlay.workbench(c.req.param("bookId"))));
  app.get("/api/v1/books/:bookId/mystery/policy", (c) => { const policy = fairPlay.getPolicy(c.req.param("bookId")); return policy ? c.json(policy) : c.json({ error: "Mystery policy not configured" }, 404); });
  app.put("/api/v1/books/:bookId/mystery/policy", async (c) => { fairPlay.configurePolicy(MysteryPolicySchema.parse({ ...(await c.req.json()), bookId: c.req.param("bookId") })); return c.json({ ok: true }); });
  app.get("/api/v1/books/:bookId/mystery/solution", (c) => { const capability = MysteryCapabilitySchema.parse(c.req.header("x-novelgraph-capability")); return c.json({ solution: fairPlay.getSolution(c.req.param("bookId"), capability, "studio-author") }); });
  app.put("/api/v1/books/:bookId/mystery/solution", async (c) => { const capability = MysteryCapabilitySchema.parse(c.req.header("x-novelgraph-capability")); fairPlay.saveSolution(MysterySolutionSchema.parse({ ...(await c.req.json()), bookId: c.req.param("bookId") }), capability); return c.json({ ok: true }); });
  const mysteryResources = {
    suspects: [MysterySuspectSchema, (value: unknown) => fairPlay.addSuspect(value)],
    evidence: [MysteryEvidenceSchema, (value: unknown) => fairPlay.addEvidence(value)],
    timeline: [TimelineEventSchema, (value: unknown) => fairPlay.addTimelineEvent(value)],
    access: [AccessRecordSchema, (value: unknown) => fairPlay.addAccess(value)],
    knowledge: [KnowledgeRecordSchema, (value: unknown) => fairPlay.addKnowledge(value)],
    hypotheses: [HypothesisSchema, (value: unknown) => fairPlay.addHypothesis(value)],
    deductions: [DeductionSchema, (value: unknown) => fairPlay.addDeduction(value)],
  } as const;
  for (const [resource, [schema, create]] of Object.entries(mysteryResources)) app.post(`/api/v1/books/:bookId/mystery/${resource}`, async (c) => { const value = schema.parse({ ...(await c.req.json()), bookId: c.req.param("bookId") }); return c.json({ id: create(value) }, 201); });
  app.get("/api/v1/books/:bookId/mystery/reader-projection", (c) => c.json(fairPlay.readerProjection(c.req.param("bookId"), Number(c.req.query("throughChapter") ?? Number.MAX_SAFE_INTEGER))));
  app.post("/api/v1/books/:bookId/mystery/validate", (c) => c.json(fairPlay.validate(c.req.param("bookId"))));
  app.post("/api/v1/books/:bookId/mystery/findings/:findingId/waive", async (c) => { const body = await c.req.json<{ rationale: string }>(); return c.json({ id: fairPlay.waiveFinding(c.req.param("bookId"), c.req.param("findingId"), body.rationale) }, 201); });
  app.post("/api/v1/prose-patterns/analyze", async (c) => { const body = await c.req.json<{ content: string }>(); return c.json({ findings: analyzeEnglishProsePatterns(body.content) }); });
  app.post("/api/v1/books/:bookId/jobs", async (c) => { const body = await c.req.json<{ idempotencyKey: string; budgetCents: number }>(); const bookId = c.req.param("bookId"); const nodes = fairPlay.getPolicy(bookId) ? MYSTERY_WORKFLOW : undefined; const capabilities = new Set(["research", "write", "canon", "publish", "story:read", "reader-view:read", "solution:read", "solution:write", "research:web", "draft:write", "canon:propose", "approval:request", "publish:export"] as const); const id = harness.start(bookId, { idempotencyKey: body.idempotencyKey, budgetCents: body.budgetCents, capabilities, nodes }); return c.json({ id }, 201); });
  app.get("/api/v1/jobs/:jobId", (c) => { const id = c.req.param("jobId"); const job = store.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id); if (!job) return c.json({ error: "Job not found" }, 404); return c.json({ job, nodes: store.db.prepare("SELECT * FROM job_nodes WHERE job_id = ? ORDER BY rowid").all(id), events: store.db.prepare("SELECT * FROM job_events WHERE job_id = ? ORDER BY created_at").all(id), artifacts: store.db.prepare("SELECT id, kind, visibility, rule_pack_version, created_at FROM workflow_artifacts WHERE job_id = ? ORDER BY created_at").all(id), solutionAccess: store.db.prepare("SELECT actor, capability, allowed, reason, created_at FROM solution_access_events WHERE job_id = ? ORDER BY created_at").all(id) }); });
  app.get("/api/v1/jobs/:jobId/ready", (c) => c.json({ nodes: harness.readyNodes(c.req.param("jobId"), requestCapabilities(c.req.header("x-novelgraph-capabilities"))) }));
  app.post("/api/v1/jobs/:jobId/nodes/:nodeId/begin", async (c) => { const body = await c.req.json<{ input?: unknown }>(); harness.beginNode(c.req.param("jobId"), c.req.param("nodeId"), body.input, requestCapabilities(c.req.header("x-novelgraph-capabilities"))); return c.json({ ok: true }); });
  app.post("/api/v1/jobs/:jobId/nodes/:nodeId/complete", async (c) => { const body = await c.req.json<{ output?: unknown; costCents?: number }>(); harness.completeNode(c.req.param("jobId"), c.req.param("nodeId"), body.output, requestCapabilities(c.req.header("x-novelgraph-capabilities")), body.costCents ?? 0); return c.json({ ok: true }); });
  app.post("/api/v1/jobs/:jobId/nodes/:nodeId/fail", async (c) => { const body = await c.req.json<{ error?: unknown; retryable?: boolean }>(); harness.failNode(c.req.param("jobId"), c.req.param("nodeId"), body.error, requestCapabilities(c.req.header("x-novelgraph-capabilities")), body.retryable ?? false); return c.json({ ok: true }); });
  app.post("/api/v1/jobs/:jobId/cancel", (c) => { harness.requestCancellation(c.req.param("jobId")); return c.json({ ok: true }); });
  app.post("/api/v1/jobs/:jobId/resume", (c) => { harness.resume(c.req.param("jobId")); return c.json({ ok: true }); });
  app.post("/api/v1/approvals/:approvalId/resolve", async (c) => { const body = ApprovalResolutionSchema.parse(await c.req.json()); store.resolveApproval(c.req.param("approvalId"), body.approved); return c.json({ ok: true, rationale: body.rationale }); });
  app.post("/api/v1/obligations/:obligationId/resolve", async (c) => { const body = await c.req.json<{ status: "resolved" | "deferred" | "waived"; rationale: string }>(); store.resolveObligation(c.req.param("obligationId"), body.status, body.rationale); return c.json({ ok: true }); });
  app.post("/api/v1/books/:bookId/research", async (c) => { const body = await c.req.json<{ url: string; claim: string }>(); return c.json({ id: await research.collect(c.req.param("bookId"), body.url, body.claim) }, 201); });
  app.post("/api/v1/books/:bookId/research/:researchId/approve", async (c) => { const body = await c.req.json<{ rationale: string }>(); return c.json({ approvalId: research.approve(c.req.param("bookId"), c.req.param("researchId"), body.rationale) }); });
  app.get("/api/v1/knowledge/search", (c) => c.json({ matches: knowledge.search(c.req.query("q") ?? "") }));
  app.post("/api/v1/books/:bookId/export", async (c) => { const id = c.req.param("bookId"); const outputDirectory = join(projectRoot, ".novelgraph", "exports", id); await store.exportBook(id, outputDirectory); return c.json({ outputDirectory, files: readdirSync(outputDirectory) }); });

  // ── Authentication (OAuth 2.0 device flow, RFC 8628) ──────────────────────
  // The token exchange stays on the server. The browser only ever sees the user
  // code and verification URI, never the device code, refresh token, or access
  // token — so a Studio tab cannot leak a credential.
  interface PendingLogin {
    authorization: DeviceAuthorization;
    startedAt: number;
    state: "pending" | "complete" | "failed";
    error?: string;
    credentialExpiresAt?: number;
  }
  const pendingLogins = new Map<string, PendingLogin>();

  app.get("/api/v1/auth/status", async (c) => c.json({
    storage: await describeStorage(),
    providers: await statusAll(),
  }));

  app.post("/api/v1/auth/:providerId/configure", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const allowed = ["clientId", "clientSecret", "issuer", "deviceAuthorizationEndpoint",
      "tokenEndpoint", "revocationEndpoint", "apiBaseUrl", "defaultModel"] as const;
    const patch: Record<string, unknown> = {};
    for (const key of allowed) if (typeof body[key] === "string" && body[key]) patch[key] = body[key];
    if (Array.isArray(body.scopes)) patch.scopes = body.scopes.filter((s): s is string => typeof s === "string");
    await saveProviderConfig(c.req.param("providerId"), patch);
    const provider = await loadProvider(c.req.param("providerId"));
    return c.json({ configured: Boolean(provider.clientId), providerId: provider.id });
  });

  app.post("/api/v1/auth/:providerId/login", async (c) => {
    const providerId = c.req.param("providerId");
    try {
      const handle = await beginLogin(providerId);
      pendingLogins.set(providerId, { authorization: handle.authorization, startedAt: Date.now(), state: "pending" });
      // Resolve in the background; the browser polls the status route.
      void handle.completed.then(
        (credential: StoredCredential) => {
          const entry = pendingLogins.get(providerId);
          if (entry) { entry.state = "complete"; entry.credentialExpiresAt = credential.expiresAt; }
        },
        (error: unknown) => {
          const entry = pendingLogins.get(providerId);
          if (entry) { entry.state = "failed"; entry.error = error instanceof Error ? error.message : String(error); }
        },
      );
      return c.json({
        userCode: handle.authorization.user_code,
        verificationUri: handle.authorization.verification_uri,
        verificationUriComplete: handle.authorization.verification_uri_complete,
        expiresIn: handle.authorization.expires_in,
        interval: handle.authorization.interval,
      }, 201);
    } catch (error) {
      if (error instanceof MissingClientIdError) return c.json({ error: error.message, code: "no_client_id" }, 409);
      if (error instanceof OAuthError) return c.json({ error: error.message, code: error.code }, 502);
      throw error;
    }
  });

  app.get("/api/v1/auth/:providerId/login", (c) => {
    const pending = pendingLogins.get(c.req.param("providerId"));
    if (!pending) return c.json({ state: "idle" });
    return c.json({
      state: pending.state,
      error: pending.error,
      userCode: pending.authorization.user_code,
      verificationUri: pending.authorization.verification_uri,
      elapsedSeconds: Math.round((Date.now() - pending.startedAt) / 1000),
      expiresIn: pending.authorization.expires_in,
      credentialExpiresAt: pending.credentialExpiresAt,
    });
  });

  app.post("/api/v1/auth/:providerId/logout", async (c) => {
    const providerId = c.req.param("providerId");
    pendingLogins.delete(providerId);
    return c.json(await logoutProvider(providerId));
  });

  app.onError((error, c) => c.json({ error: error.message }, 400));
  app.use("/*", serveStatic({ root: staticRoot }));
  app.get("/*", serveStatic({ root: staticRoot, path: "index.html" }));
  appCleanup.set(app, () => store.close());
  return app;
}

export function closeStudioApp(app: Hono): void { appCleanup.get(app)?.(); }

function requestCapabilities(header: string | undefined): Set<ReturnType<typeof AgentCapabilitySchema.parse>> {
  return new Set((header ?? "").split(",").map((value) => value.trim()).filter(Boolean).map((value) => AgentCapabilitySchema.parse(value)));
}

export async function startStudio(options: StartStudioOptions): Promise<{ server: ServerType; url: string }> {
  const host = options.host ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") process.stderr.write("Warning: NovelGraph Studio is being exposed beyond this device.\n");
  mkdirSync(join(options.projectRoot, ".novelgraph"), { recursive: true });
  const app = createStudioApp(options.projectRoot);
  const server = serve({ fetch: app.fetch, hostname: host, port: options.port ?? 0 });
  server.once("close", () => appCleanup.get(app)?.());
  if (!server.listening) await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? 0;
  const url = `http://${host === "::1" ? "[::1]" : host}:${port}`;
  if (options.openBrowser !== false) setTimeout(() => openUrl(url), 250);
  return { server, url };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const projectRoot = process.env.NOVELGRAPH_PROJECT_ROOT ?? process.cwd();
  void startStudio({ projectRoot, port: Number(process.env.NOVELGRAPH_STUDIO_PORT ?? 4567), host: process.env.NOVELGRAPH_STUDIO_HOST }).then(({ url }) => process.stdout.write(`NovelGraph Studio: ${url}\n`));
}
