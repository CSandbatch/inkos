import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import cytoscape from "cytoscape";
import type { BookRecord, GraphData, MysteryMode, ReviewRecord, StudioDataSource } from "../shared/index.js";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 2_000, retry: 1 } } });
const nav = [
  ["/", "Overview", "01"], ["/setup", "New book", "02"], ["/discovery", "Discovery", "03"], ["/editor", "Manuscript", "04"],
  ["/graph", "Story graph", "05"], ["/mystery", "Mystery", "06"], ["/workflow", "DAG control", "07"], ["/reviews", "Review center", "08"], ["/exports", "Exports", "09"],
  ["/access", "Model access", "10"],
] as const;

const RouterContext = createContext<{ path: string; embedded: boolean; navigate: (path: string, replace?: boolean) => void } | null>(null);
function useRouter() { const value = useContext(RouterContext); if (!value) throw new Error("Router is unavailable"); return value; }
function RouterHost({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  const [path, setPath] = useState(embedded ? "/" : window.location.pathname);
  useEffect(() => { if (embedded) return; const update = () => setPath(window.location.pathname); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, [embedded]);
  const navigate = (next: string, replace = false) => { if (!embedded) window.history[replace ? "replaceState" : "pushState"]({}, "", next); setPath(next); };
  return <RouterContext.Provider value={{ path, embedded, navigate }}>{children}</RouterContext.Provider>;
}
function NavLink({ to, end = false, className = "", children }: { to: string; end?: boolean; className?: string; children: React.ReactNode }) {
  const { path, embedded, navigate } = useRouter(); const active = end ? path === to : path === to || (to !== "/" && path.startsWith(`${to}/`));
  return <a className={`${className}${active ? " active" : ""}`.trim()} href={embedded ? `#${to}` : to} onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) { event.preventDefault(); navigate(to); } }}>{children}</a>;
}

function Icon({ name }: { name: string }) { return <span className="icon" aria-hidden="true">{name}</span>; }

function Frame({ source }: { source: StudioDataSource }) {
  const { path, embedded, navigate } = useRouter();
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => source.dashboard() });
  const firstBook = dashboard.data?.books[0];
  const [palette, setPalette] = useState(false);
  useEffect(() => { const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette((value) => !value); } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
  useEffect(() => { if (dashboard.isSuccess && path === "/editor") navigate(firstBook ? `/editor/${firstBook.id}` : "/setup", true); }, [dashboard.isSuccess, firstBook?.id, path]);
  const page = path === "/" ? <Dashboard source={source} />
    : path === "/setup" ? <Setup source={source} />
    : path === "/discovery" ? (firstBook ? <DiscoveryRoom source={source} book={firstBook} /> : <Empty />)
    : path.startsWith("/editor/") ? <Editor source={source} bookId={path.slice("/editor/".length)} />
    : path === "/graph" ? (firstBook ? <GraphView source={source} book={firstBook} /> : <Empty />)
    : path === "/mystery" ? (firstBook ? <MysteryWorkbench source={source} book={firstBook} /> : <Empty />)
    : path === "/workflow" ? (firstBook ? <Workflow source={source} book={firstBook} /> : <Empty />)
    : path === "/reviews" ? (firstBook ? <Reviews source={source} book={firstBook} /> : <Empty />)
    : path === "/exports" ? (firstBook ? <Exports source={source} book={firstBook} /> : <Empty />)
    : path === "/access" ? <Access source={source} />
    : <Empty />;
  return <div className="studio-shell">
    <aside className="rail">
      <NavLink className="brand" to="/" end><span className="brand-mark">N/G</span><span><b>NovelGraph</b><small>STUDIO / ALPHA</small></span></NavLink>
      <nav aria-label="Studio navigation">{nav.map(([to, label, number]) => <NavLink key={to} end={to === "/"} to={to}><span>{number}</span>{label}</NavLink>)}</nav>
      <div className="rail-status"><span className="signal verified" />LOCAL ONLY<small>{source.mode === "demo" ? "Fixture mode" : "SQLite connected"}</small></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div className="breadcrumbs"><span>NOVELGRAPH</span><i>/</i><b>{firstBook?.title ?? "UNCONFIGURED"}</b></div><button className="command" onClick={() => setPalette(true)}>Search or command <kbd>⌘ K</kbd></button><span className="privacy"><span className="signal verified" /> PRIVATE WORKSPACE</span></header>
      {page}
    </main>
    {palette && <div className="modal-backdrop" onClick={() => setPalette(false)}><div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(event) => event.stopPropagation()}><input autoFocus placeholder="Type a command…"/><p>JUMP TO</p>{nav.map(([to, label]) => <a href={embedded ? `#${to}` : to} onClick={(event) => { event.preventDefault(); navigate(to); setPalette(false); }} key={to}>{label}<span>↵</span></a>)}</div></div>}
  </div>;
}

function PageHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) { return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{detail}</p></div>{action}</div>; }
function Empty() { return <section className="page"><PageHeader eyebrow="NO PROJECT" title="Create a project first." detail="A series and book establish the graph, revision history, and workflow boundaries."/><NavLink className="button primary" to="/setup">Configure project</NavLink></section>; }

const AUTH_TONE: Record<string, string> = {
  "authenticated": "verified", "refreshable": "active", "expired": "attention",
  "not-configured": "", "no-client-id": "attention",
};

/**
 * Model provider sign-in via the OAuth device flow.
 *
 * The browser never touches a token: it POSTs to start the flow, shows the user
 * code, and polls a status route. The device code, access token, and refresh
 * token stay in the local server process and the OS credential store.
 */
function Access({ source }: { source: StudioDataSource }) {
  const client = useQueryClient();
  const status = useQuery({ queryKey: ["auth-status"], queryFn: () => source.authStatus() });
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progress = useQuery({
    queryKey: ["auth-login", active],
    queryFn: () => source.pollAuthLogin(active as string),
    enabled: Boolean(active),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "pending" ? 2_000 : false;
    },
  });

  useEffect(() => {
    if (progress.data?.state === "complete") {
      setActive(null);
      void client.invalidateQueries({ queryKey: ["auth-status"] });
    }
    if (progress.data?.state === "failed") {
      setError(progress.data.error ?? "Sign-in failed.");
      setActive(null);
    }
  }, [progress.data?.state]);

  const login = useMutation({
    mutationFn: (providerId: string) => source.beginAuthLogin(providerId),
    onMutate: () => setError(null),
    onSuccess: (_prompt, providerId) => setActive(providerId),
    onError: (e: Error) => setError(e.message),
  });
  const signOut = useMutation({
    mutationFn: (providerId: string) => source.authLogout(providerId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["auth-status"] }),
  });

  const prompt = login.data;
  const storage = status.data?.storage;

  return <section className="page">
    <PageHeader
      eyebrow="MODEL ACCESS"
      title="Provider sign-in"
      detail="NovelGraph signs in with the OAuth 2.0 device flow. Tokens are held by this local process and the operating system credential store — never in project files."
    />

    {storage && <div className={`notice${storage.protected ? "" : " attention"}`}>
      <b>Credential storage</b>
      <p>{storage.description}</p>
      {!storage.protected && <p>No operating-system credential store was available. Tokens on this machine are readable by your user account.</p>}
    </div>}

    {error && <div className="notice attention"><b>Sign-in failed</b><p>{error}</p></div>}

    {prompt && active && <div className="notice">
      <b>Finish signing in</b>
      <p>Open <a href={prompt.verificationUri} target="_blank" rel="noreferrer">{prompt.verificationUri}</a> and enter this code:</p>
      <p className="device-code"><code>{prompt.userCode}</code></p>
      <p>Waiting for approval… {progress.data?.elapsedSeconds ? `${progress.data.elapsedSeconds}s` : ""}</p>
      <button className="button" onClick={() => { setActive(null); }}>Cancel</button>
    </div>}

    <table className="grid">
      <thead><tr><th>Provider</th><th>State</th><th>Detail</th><th /></tr></thead>
      <tbody>
        {(status.data?.providers ?? []).map((provider) => <tr key={provider.providerId}>
          <td><b>{provider.displayName}</b><br /><small>{provider.providerId}</small></td>
          <td><span className={`signal ${AUTH_TONE[provider.state] ?? ""}`.trim()} />{provider.state.replace(/-/gu, " ")}</td>
          <td>{provider.detail}{provider.scopes?.length ? <><br /><small>scopes: {provider.scopes.join(" ")}</small></> : null}</td>
          <td>
            {provider.state === "authenticated" || provider.state === "refreshable" || provider.state === "expired"
              ? <button className="button" disabled={signOut.isPending} onClick={() => signOut.mutate(provider.providerId)}>Sign out</button>
              : <button className="button primary" disabled={login.isPending || provider.state === "no-client-id"} onClick={() => login.mutate(provider.providerId)}>Sign in</button>}
          </td>
        </tr>)}
      </tbody>
    </table>

    <div className="notice">
      <b>Before the first sign-in</b>
      <p>
        NovelGraph does not ship an OAuth client ID. Register a device-flow client with the
        provider, then record it from a terminal:
      </p>
      <p><code>novelgraph auth configure --provider chatgpt --client-id &lt;id&gt; --issuer &lt;url&gt;</code></p>
      <p>
        Using a provider account through NovelGraph is subject to that provider's terms. Confirm
        your client registration permits it.
      </p>
    </div>
  </section>;
}

function Dashboard({ source }: { source: StudioDataSource }) {
  const data = useQuery({ queryKey: ["dashboard"], queryFn: () => source.dashboard() });
  if (data.isLoading) return <section className="page"><p className="eyebrow">SYNCHRONIZING LOCAL STATE…</p></section>;
  if (data.error) return <section className="page"><div className="notice blocked">Could not load Studio: {data.error.message}</div></section>;
  const d = data.data!; const spend = d.jobs.reduce((total, job) => total + job.used_cents, 0);
  return <section className="page"><PageHeader eyebrow="AUTHORING CONTROL ROOM" title="Production overview" detail="Every draft, state transition, review, and gate remains inspectable." action={<NavLink className="button primary" to="/setup">+ New project</NavLink>}/>
    {source.mode === "demo" && <div className="notice attention"><b>INTERACTIVE FIXTURE</b> Changes remain in this browser session. No model calls, credentials, or manuscript data are used.</div>}
    <div className="metric-grid"><Metric label="BOOKS" value={String(d.books.length).padStart(2,"0")} note="Active production"/><Metric label="OPEN HARD GATES" value={String(d.obligations.filter((o) => o.hard).length).padStart(2,"0")} note="Must resolve or waive" tone="attention"/><Metric label="ACTIVE JOBS" value={String(d.jobs.filter((j) => ["running","blocked"].includes(j.status)).length).padStart(2,"0")} note="Durable and resumable"/><Metric label="RUN COST" value={`$${(spend/100).toFixed(2)}`} note="Current local ledger"/></div>
    <div className="dashboard-grid"><article className="panel span-2"><PanelTitle index="A" title="PRODUCTION QUEUE"/><div className="table-head"><span>BOOK / SERIES</span><span>GENRE</span><span>STATUS</span><span /></div>{d.books.map((book) => <NavLink className="table-row" to={`/editor/${book.id}`} key={book.id}><span><b>{book.title}</b><small>{book.series_title}</small></span><code>{book.genre_pack}</code><span className="status"><i className="signal active"/>DRAFTING</span><span>OPEN →</span></NavLink>)}{!d.books.length && <p className="empty-copy">No books yet. Configure the first production project.</p>}</article>
      <article className="panel"><PanelTitle index="B" title="HARD OBLIGATIONS"/><div className="obligation-list">{d.obligations.slice(0,5).map((item) => <div key={item.id}><span className={`signal ${item.status === "open" ? "blocked" : "attention"}`}/><span><b>{item.title}</b><small>{item.kind} · {item.status}</small></span></div>)}{!d.obligations.length && <p className="empty-copy">No unresolved hard gates.</p>}</div></article>
      <article className="panel span-3"><PanelTitle index="C" title="RECENT ATTRIBUTABLE EVENTS"/><div className="event-strip">{d.recentEvents.map((event) => <div key={event.id}><code>{event.event_type}</code><p>{event.rationale}</p><time>{new Date(event.created_at).toLocaleString()}</time></div>)}{!d.recentEvents.length && <p className="empty-copy">Events appear as authors and agents modify the project.</p>}</div></article></div>
  </section>;
}
function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) { return <article className={`metric ${tone ?? ""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function PanelTitle({ index, title }: { index: string; title: string }) { return <h2 className="panel-title"><span>{index}</span>{title}</h2>; }

function Setup({ source }: { source: StudioDataSource }) {
  const { navigate } = useRouter(); const qc = useQueryClient(); const [telemetry, setTelemetry] = useState(false);
  const mutation = useMutation({ mutationFn: (form: FormData) => source.createProject({ seriesTitle: String(form.get("seriesTitle")), bookTitle: String(form.get("bookTitle")), premise: String(form.get("premise")), genrePack: String(form.get("genrePack")), seedMystery: form.get("seedMystery") === "on", mysteryMode: String(form.get("mysteryMode")) as MysteryMode }), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["dashboard"] }); navigate("/discovery"); } });
  return <section className="page narrow"><PageHeader eyebrow="PROJECT INITIALIZATION" title="Establish production boundaries" detail="NovelGraph records these choices as the first attributable canon event."/><form className="setup-grid" onSubmit={(event) => { event.preventDefault(); mutation.mutate(new FormData(event.currentTarget)); }}><label>SERIES TITLE<input name="seriesTitle" required defaultValue="The Calder House Files"/></label><label>BOOK TITLE<input name="bookTitle" required defaultValue="A Clock Without Hands"/></label><label className="wide">PREMISE<textarea name="premise" required defaultValue="A detective discovers that the most reliable witness in a locked-room death is the one thing that made no sound."/></label><label>GENRE PACK<select name="genrePack" defaultValue="mystery"><option value="mystery">Mystery</option><option value="general">General fiction</option><option value="science-fiction">Science fiction</option><option value="romantasy">Romantasy</option></select></label><label>FAIR-PLAY MODE<select name="mysteryMode" defaultValue="contemporary"><option value="strict-golden-age">Strict Golden Age</option><option value="contemporary">Contemporary Fair-Play</option><option value="hybrid">Hybrid</option><option value="rule-breaking">Rule-Breaking</option></select></label><label className="toggle wide"><input name="seedMystery" type="checkbox" defaultChecked/><span>Seed the mystery fairness ledger and require a locked solution before drafting</span></label><label className="toggle wide"><input type="checkbox" checked={telemetry} onChange={(e) => setTelemetry(e.target.checked)}/><span>Share anonymous diagnostics. Never includes manuscript text, prompts, paths, or credentials. <a href="https://csandbatch.github.io/novelgraph/docs/operations/privacy/">Preview fields.</a></span></label><div className="form-actions wide"><button className="button primary" disabled={mutation.isPending}>{mutation.isPending ? "CREATING…" : "CREATE LOCAL PROJECT"}</button>{mutation.error && <span className="error">{mutation.error.message}</span>}</div></form></section>;
}

const discoveryQuestions = [
  "What experience should remain with the reader after the final page?",
  "Which promise must this genre keep, even if the book breaks other conventions?",
  "What does the protagonist want, and what private contradiction makes that pursuit costly?",
  "Which pressure can keep producing scenes after the premise stops being new?",
  "What should the ending settle, and what may remain productively unresolved?",
];

function DiscoveryRoom({ source, book }: { source: StudioDataSource; book: BookRecord }) {
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["discovery", book.id], queryFn: () => source.discovery(book.id) });
  const [reply, setReply] = useState(""); const [selected, setSelected] = useState<Record<string, unknown>>(); const [dossier, setDossier] = useState<Record<string, unknown>>();
  const send = useMutation({ mutationFn: async () => {
    if (!data.data?.session || !reply.trim()) return;
    const sessionId = data.data.session.id; const turnNumber = data.data.turns.length;
    await source.addDiscoveryTurn(sessionId, { role: "author", content: reply, observations: [{ key: `author-response-${turnNumber}`, value: reply, provenance: "author-stated", confidence: 1, status: "working" }] });
    await source.addScratchpad(sessionId, { agentRole: "luna-worker", kind: "observation", content: `Extracted author commitment: ${reply}`, confidence: 0.8, sourceRefs: [`turn:${turnNumber + 1}`] });
    await source.addDiscoveryTurn(sessionId, { role: "sol", content: discoveryQuestions[Math.min(Math.floor(turnNumber / 2) + 1, discoveryQuestions.length - 1)]! });
  }, onSuccess: async () => { setReply(""); await qc.invalidateQueries({ queryKey: ["discovery", book.id] }); } });
  const approve = useMutation({ mutationFn: async () => {
    if (!selected) throw new Error("Select a story thrust first");
    const proposed = await source.proposeCharter(book.id, { mainThrust: String(selected.mainThrust), readerPromise: selected.readerPromise ?? ["A legible causal resolution"], protagonist: { engine: selected.characterEngine ?? "Unresolved" }, centralConflict: String(selected.centralConflict), genreContract: selected.genreObligations ?? [], thematicQuestions: selected.thematicPressure ? [String(selected.thematicPressure)] : [], narrativeForm: {}, endingHorizon: String(selected.endingShape ?? ""), constraints: [], productiveUnknowns: [], rejectedDirections: [] });
    await source.resolveCharter(proposed.id, true, "Author selected and approved this Story Charter in Discovery");
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ["discovery", book.id] }) });
  const inspect = useMutation({ mutationFn: () => source.dossier(book.id, "sol-orchestrator"), onSuccess: setDossier });
  if (!data.data?.session) return <section className="page"><p className="eyebrow">OPENING DISCOVERY</p></section>;
  const approved = data.data.charters.some((charter) => charter.status === "approved");
  return <section className="page"><PageHeader eyebrow="SOL / CONVERSATIONAL DISCOVERY" title="Find the book before producing it" detail="The conversation remains working material. Only an approved Story Charter governs downstream agents." action={approved ? <NavLink className="button primary" to={`/editor/${book.id}`}>OPEN MANUSCRIPT</NavLink> : undefined}/>
    <div className="discovery-layout"><article className="panel discovery-thread"><PanelTitle index="01" title="AUTHOR + SOL"/>{data.data.turns.map((turn) => <div className={`discovery-turn ${turn.role}`} key={turn.id}><b>{turn.role === "author" ? "AUTHOR" : "SOL"}</b><p>{turn.content}</p></div>)}<form onSubmit={(event) => { event.preventDefault(); send.mutate(); }}><label htmlFor="discovery-reply">YOUR RESPONSE</label><textarea id="discovery-reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Answer, object, redirect, or preserve an uncertainty."/><button className="button primary" disabled={!reply.trim() || send.isPending}>SEND TO SOL</button></form></article>
    <aside className="discovery-side"><article className="panel"><PanelTitle index="02" title="CURRENT UNDERSTANDING"/>{data.data.observations.map((item, index) => <div className="knowledge-row" key={String(item.id ?? index)}><b>{String(item.key)}</b><span>{String(item.provenance)} / {String(item.status)}</span><p>{String(item.value_json)}</p></div>)}</article><article className="panel"><PanelTitle index="03" title="KNOWLEDGE BOUNDARIES"/>{data.data.knowledgeBases.map((base) => <div className="knowledge-row" key={base.id}><b>{base.scope.toUpperCase()}</b><p>{base.title}</p><span>{base.relation ?? "authoritative"}</span></div>)}</article></aside></div>
    <PageHeader eyebrow="TERRA / STORY SYNTHESIS" title="Candidate thrusts" detail="Core follows the stated direction. Stretch intensifies a pressure. Wild tests the edge of the book's identity."/>
    <div className="thrust-grid">{data.data.candidates.map((candidate) => { const content = candidate.content_json; return <button className={`thrust-card ${selected === content ? "selected" : ""}`} onClick={() => setSelected(content)} key={candidate.id}><code>{candidate.kind.toUpperCase()}</code><h2>{String(content.title)}</h2><p>{String(content.mainThrust)}</p><small>{String(content.centralConflict)}</small></button>; })}</div>
    <div className="discovery-actions"><button className="button" onClick={() => inspect.mutate()}>INSPECT SOL HANDOFF</button><button className="button primary" disabled={!selected || approve.isPending} onClick={() => approve.mutate()}>APPROVE STORY CHARTER</button></div>{(send.error || approve.error) && <div className="notice blocked">{(send.error ?? approve.error)?.message}</div>}{dossier && <pre className="panel data-preview">{JSON.stringify(dossier, null, 2)}</pre>}
    <article className="panel"><PanelTitle index="04" title="AGENT SCRATCHPAD"/>{data.data.scratchpad.map((entry, index) => <div className="knowledge-row" key={String(entry.id ?? index)}><b>{String(entry.agent_role)} / {String(entry.kind)}</b><p>{String(entry.content)}</p><span>Noncanonical working memory</span></div>)}</article>
  </section>;
}

function MysteryWorkbench({ source, book }: { source: StudioDataSource; book: BookRecord }) {
  const qc = useQueryClient(); const data = useQuery({ queryKey: ["mystery", book.id], queryFn: () => source.mysteryWorkbench(book.id) }); const projection = useQuery({ queryKey: ["reader-projection", book.id], queryFn: () => source.readerProjection(book.id, 8) });
  const [section, setSection] = useState<"evidence" | "timeline" | "access" | "knowledge" | "hypotheses" | "audit">("evidence"); const [mode, setMode] = useState<MysteryMode>("contemporary"); const [solution, setSolution] = useState<Record<string, unknown> | null>();
  const [recordType, setRecordType] = useState<"suspects" | "evidence" | "timeline" | "access" | "knowledge" | "hypotheses" | "deductions">("evidence"); const [recordJson, setRecordJson] = useState("{}");
  const [solutionJson, setSolutionJson] = useState(JSON.stringify({ victimOrTarget: "", responsibleParties: [""], actualEvent: "", apparentEvent: "", motive: { actual: "" }, method: "", opportunity: "", concealment: "", reconstruction: [""], uncertainty: "established", locked: false }, null, 2));
  useEffect(() => { if (data.data?.policy) setMode(data.data.policy.mode); }, [data.data?.policy?.mode]);
  const validate = useMutation({ mutationFn: () => source.validateMystery(book.id), onSuccess: () => qc.invalidateQueries({ queryKey: ["mystery", book.id] }) });
  const configure = useMutation({ mutationFn: () => { const policy = data.data?.policy; if (!policy) throw new Error("Mystery policy is missing"); return source.configureMystery({ ...policy, mode }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["mystery", book.id] }) });
  const reveal = useMutation({ mutationFn: () => source.revealMysterySolution(book.id), onSuccess: (result) => setSolution(result.solution) });
  const saveSolution = useMutation({ mutationFn: () => source.saveMysterySolution(book.id, JSON.parse(solutionJson) as Record<string, unknown>), onSuccess: () => qc.invalidateQueries({ queryKey: ["mystery", book.id] }) });
  const addRecord = useMutation({ mutationFn: () => source.addMysteryRecord(book.id, recordType, JSON.parse(recordJson) as Record<string, unknown>), onSuccess: () => { setRecordJson("{}"); void qc.invalidateQueries({ queryKey: ["mystery", book.id] }); } });
  const waive = useMutation({ mutationFn: ({ id, rationale }: { id: string; rationale: string }) => source.waiveMysteryFinding(book.id, id, rationale), onSuccess: () => qc.invalidateQueries({ queryKey: ["mystery", book.id] }) });
  if (!data.data) return <section className="page"><p className="eyebrow">LOADING FAIR-PLAY STATE…</p></section>;
  const sections = { evidence: data.data.evidence, timeline: data.data.timeline, access: data.data.access, knowledge: data.data.knowledge, hypotheses: data.data.hypotheses, audit: data.data.findings } as const; const visible = sections[section];
  return <section className="page"><PageHeader eyebrow="FAIR-PLAY DETECTIVE 2026" title="Mystery workbench" detail="The sealed solution, reader-visible evidence, chronology, access, and deductions remain separate and inspectable." action={<button className="button primary" onClick={() => validate.mutate()}>RUN VALIDATION</button>}/>
    <div className="mystery-policy panel"><div><span>RULE PACK</span><b>{data.data.policy?.rulePackVersion ?? "NOT CONFIGURED"}</b></div><label>MODE<select value={mode} onChange={(event) => setMode(event.target.value as MysteryMode)}><option value="strict-golden-age">Strict Golden Age</option><option value="contemporary">Contemporary</option><option value="hybrid">Hybrid</option><option value="rule-breaking">Rule-Breaking</option></select></label><button className="button" onClick={() => configure.mutate()} disabled={mode === data.data.policy?.mode}>APPLY + RE-AUDIT</button><button className="button" onClick={() => reveal.mutate()}>REVEAL SEALED SOLUTION</button></div>
    {(configure.error || reveal.error) && <div className="notice attention">{(configure.error ?? reveal.error)?.message}</div>}
    {solution && <article className="sealed-panel"><header><b>AUTHOR-ONLY SOLUTION</b><button onClick={() => setSolution(null)}>HIDE</button></header><pre>{JSON.stringify(solution, null, 2)}</pre></article>}
    <div className="mystery-grid"><details className="panel"><summary>AUTHOR SEALED-SOLUTION EDITOR</summary><p className="empty-copy">Saving a locked solution again creates a canon-retcon approval instead of silently replacing canon.</p><textarea className="json-editor" value={solutionJson} onChange={(event) => setSolutionJson(event.target.value)} aria-label="Sealed solution JSON"/><button className="button" onClick={() => saveSolution.mutate()}>SAVE SOLUTION</button>{saveSolution.error && <p className="error">{saveSolution.error.message}</p>}</details><details className="panel"><summary>ADD TYPED MYSTERY RECORD</summary><select value={recordType} onChange={(event) => setRecordType(event.target.value as typeof recordType)}>{["suspects","evidence","timeline","access","knowledge","hypotheses","deductions"].map((item) => <option key={item}>{item}</option>)}</select><textarea className="json-editor" value={recordJson} onChange={(event) => setRecordJson(event.target.value)} aria-label="Mystery record JSON"/><button className="button" onClick={() => addRecord.mutate()}>VALIDATE + ADD</button>{addRecord.error && <p className="error">{addRecord.error.message}</p>}</details></div>
    <div className="mystery-grid"><article className="panel"><PanelTitle index="R" title="READER PROJECTION / THROUGH CHAPTER 8"/><p className="empty-copy">This is the exact evidence surface available to drafting and armchair-solver nodes. True meanings and future deductions are omitted.</p><pre className="data-preview">{JSON.stringify(projection.data ?? {}, null, 2)}</pre></article><article className="panel"><PanelTitle index="G" title="CURRENT GATES"/><strong className="big-number">{data.data.findings.filter((item) => item.status === "open").length}</strong><small>open findings</small>{data.data.findings.slice(0,4).map((item) => <div className="mini-finding" key={item.id ?? item.ruleCode}><code>{item.ruleCode}</code><p>{item.message}</p>{data.data.policy?.mode === "rule-breaking" && item.severity === "blocker" && item.id && <button className="button" onClick={() => { const rationale = window.prompt("Author waiver rationale"); if (rationale) waive.mutate({ id: item.id!, rationale }); }}>WAIVE</button>}</div>)}</article></div>
    <div className="workbench-tabs" role="tablist">{(Object.keys(sections) as Array<keyof typeof sections>).map((key) => <button role="tab" aria-selected={section === key} className={section === key ? "active" : ""} key={key} onClick={() => setSection(key)}>{key.toUpperCase()} <span>{sections[key].length}</span></button>)}</div>
    <div className="record-grid">{visible.map((record, index) => <article className="panel" key={String((record as Record<string, unknown>).id ?? index)}><code>{section.toUpperCase()} / {String(index + 1).padStart(2,"0")}</code><h3>{String((record as Record<string, unknown>).title ?? (record as Record<string, unknown>).label ?? (record as Record<string, unknown>).name ?? (record as Record<string, unknown>).ruleCode ?? (record as Record<string, unknown>).kind ?? "Record")}</h3><pre>{JSON.stringify(record, null, 2)}</pre></article>)}</div>
  </section>;
}

function Editor({ source, bookId }: { source: StudioDataSource; bookId: string }) {
  const qc = useQueryClient(); const data = useQuery({ queryKey: ["book", bookId], queryFn: () => source.book(bookId), enabled: Boolean(bookId) }); const [selected, setSelected] = useState(0); const chapter = data.data?.chapters[selected]; const [saveState, setSaveState] = useState("SAVED");
  const prose = useMutation({ mutationFn: (content: string) => source.analyzeProse(content) });
  const editor = useEditor({ extensions: [StarterKit, Placeholder.configure({ placeholder: "Begin the scene…" })], content: chapter?.content_markdown ?? "", onUpdate: () => setSaveState("UNSAVED") }, [chapter?.id]);
  useEffect(() => { if (editor && chapter && editor.getText() !== chapter.content_markdown) editor.commands.setContent(chapter.content_markdown); }, [editor, chapter]);
  const save = async () => { if (!chapter || !editor) return; setSaveState("SAVING"); await source.saveChapter(chapter.id, { contentMarkdown: editor.getText(), reason: "Studio autosave" }); setSaveState("SAVED"); await qc.invalidateQueries({ queryKey: ["book", bookId] }); };
  useEffect(() => { if (saveState !== "UNSAVED") return; const timer = setTimeout(() => void save(), 1200); return () => clearTimeout(timer); }, [saveState]);
  if (!data.data) return <section className="page"><p className="eyebrow">LOADING MANUSCRIPT…</p></section>;
  return <section className="editor-layout"><aside className="chapter-list"><p className="eyebrow">MANUSCRIPT</p><h2>{data.data.book.title}</h2>{data.data.chapters.map((item, index) => <button className={index === selected ? "selected" : ""} onClick={() => setSelected(index)} key={item.id}><span>{String(item.number).padStart(2,"0")}</span><b>{item.title}</b><small>{item.status}</small></button>)}</aside><article className="manuscript"><div className="editor-toolbar"><button onClick={() => editor?.chain().focus().toggleBold().run()}><b>B</b></button><button onClick={() => editor?.chain().focus().toggleItalic().run()}><i>I</i></button><button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button><span/><code className={saveState.toLowerCase()}>{saveState}</code><button className="button" onClick={() => prose.mutate(editor?.getText() ?? "")}>INSPECT PROSE</button><button className="button" onClick={() => void save()}>SAVE REVISION</button></div><div className="chapter-heading"><p>CHAPTER {chapter?.number}</p><input aria-label="Chapter title" value={chapter?.title ?? ""} readOnly/></div><EditorContent editor={editor}/></article><aside className="diagnostics"><PanelTitle index="D" title="DIAGNOSTICS"/><div className="diagnostic blocked"><b>CAUSAL CONTRADICTION</b><p>A witness reports hearing a clock documented as stopped.</p><a href="https://csandbatch.github.io/novelgraph/docs/guides/review/">Understand this gate →</a></div>{prose.data?.findings.slice(0,8).map((finding, index) => <div className="diagnostic" key={`${finding.line}-${finding.column}-${index}`}><b>ADVISORY / {finding.category}</b><p>Line {finding.line}: “{finding.pattern}”</p><small>{finding.suggestion}</small></div>)}<PanelTitle index="R" title="REVISIONS"/>{data.data.revisions.slice(0,6).map((revision) => <div className="revision" key={revision.id}><b>{revision.reason}</b><small>{revision.applied_by} · {new Date(revision.created_at).toLocaleTimeString()}</small></div>)}</aside></section>;
}

function GraphCanvas({ graph }: { graph: GraphData }) { const ref = useRef<HTMLDivElement>(null); useEffect(() => { if (!ref.current) return; const instance = cytoscape({ container: ref.current, elements: [...graph.entities.map((entity) => ({ data: { id: entity.id, label: entity.name, type: entity.type } })), ...graph.edges.map((edge) => ({ data: { id: edge.id, source: edge.from_id, target: edge.to_id, label: edge.type } }))], style: [{ selector: "node", style: { "background-color": "#0d1014", "border-color": "#42d9ef", "border-width": 2, color: "#f3f4ef", label: "data(label)", "font-size": 11, width: 58, height: 58, "text-valign": "bottom", "text-margin-y": 10 } }, { selector: "edge", style: { width: 1, "line-color": "#53616b", "target-arrow-color": "#42d9ef", "target-arrow-shape": "triangle", label: "data(label)", color: "#8d9aa3", "font-size": 8, "curve-style": "bezier" } }], layout: { name: "circle" } }); return () => instance.destroy(); }, [graph]); return <div className="graph-canvas" ref={ref}/>; }
function GraphView({ source, book }: { source: StudioDataSource; book: BookRecord }) { const data = useQuery({ queryKey: ["graph", book.id], queryFn: () => source.graph(book.id) }); return <section className="page"><PageHeader eyebrow="TRANSACTIONAL STORY STATE" title="Story graph" detail="Inspect entities, causal relationships, knowledge boundaries, clues, and unresolved promises."/>{data.data && <div className="graph-layout"><article className="panel span-2"><GraphCanvas graph={data.data}/></article><article className="panel"><PanelTitle index="O" title="OBLIGATION LEDGER"/><div className="obligation-list">{data.data.obligations.map((item) => <div key={item.id}><span className={`signal ${item.status === "open" ? "blocked" : "attention"}`}/><span><b>{item.title}</b><small>{item.kind} · chapter {item.target_chapter ?? "—"}</small></span></div>)}</div><PanelTitle index="C" title="CLUE COVERAGE"/><strong className="big-number">{data.data.clues.length}</strong><small>documented evidence records</small></article></div>}</section>; }

function Workflow({ source, book }: { source: StudioDataSource; book: BookRecord }) { const [jobId, setJobId] = useState<string>(); const detail = useQuery({ queryKey: ["job", jobId], queryFn: () => source.job(jobId!), enabled: Boolean(jobId), refetchInterval: 2_000 }); const run = useMutation({ mutationFn: () => source.startJob(book.id, 100), onSuccess: ({ id }) => setJobId(id) }); const fallback = ["policy","research","solution","evidence","timeline","solution-approval","scene-plan","draft","validate","adversarial","fairness","realism","reader-panel","prose","revise","reaudit","approval"].map((node_key, index, all) => ({ id: node_key, node_key, kind: node_key, status: index === 0 ? "ready" : "pending", capability: node_key.includes("solution") ? "solution:read" : "reader-view:read", artifact_visibility: node_key === "draft" ? "reader-visible" : "author-only", depends_on_json: JSON.stringify(index ? [all[index - 1]] : []) })); const records = detail.data?.nodes ?? fallback; const nodes: Node[] = records.map((node, index) => ({ id: node.node_key, position: { x: (index % 6) * 190, y: Math.floor(index/6) * 150 }, data: { label: <div className="flow-node"><small>{String(index+1).padStart(2,"0")} / {node.artifact_visibility ?? "author-only"}</small><b>{node.kind.toUpperCase()}</b><span className={`node-status ${node.status}`}>{node.status} · {node.capability}</span></div> }, className: `flow-${node.status}` })); const edges: Edge[] = records.flatMap((node) => ((JSON.parse(node.depends_on_json) as string[]) ?? []).map((dependency) => ({ id: `${dependency}-${node.node_key}`, source: dependency, target: node.node_key, animated: node.status === "running" }))); return <section className="page"><PageHeader eyebrow="SUPERVISED EXECUTION" title="DAG control room" detail="Typed nodes, explicit capabilities, artifact visibility, durable state, and hard budget stops." action={<button className="button primary" onClick={() => run.mutate()} disabled={run.isPending}>RUN WORKFLOW</button>}/><div className="workflow-grid"><article className="panel flow-wrap"><ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}><Background color="#28333a" gap={22}/><Controls/></ReactFlow></article><article className="panel"><PanelTitle index="L" title="EVENT + ACCESS LOG"/>{detail.data?.events.map((event) => <div className="log-line" key={event.id}><span className={`signal ${event.level === "warning" ? "attention" : "active"}`}/><code>{event.message}</code></div>) ?? <p className="empty-copy">Start a run to create a durable workflow record.</p>}{detail.data?.solutionAccess?.map((event, index) => <div className="log-line" key={`${event.actor}-${index}`}><span className={`signal ${event.allowed ? "verified" : "blocked"}`}/><code>{event.actor} · {event.capability} · {event.allowed ? "ALLOWED" : "DENIED"}</code></div>)}{detail.data?.artifacts?.map((artifact) => <div className="log-line" key={artifact.id}><span className="signal active"/><code>{artifact.kind} · {artifact.visibility} · {artifact.rule_pack_version}</code></div>)}{detail.data && <div className="budget"><span>RUN BUDGET</span><b>${(detail.data.job.used_cents/100).toFixed(2)} / ${(detail.data.job.budget_cents/100).toFixed(2)}</b><progress value={detail.data.job.used_cents} max={detail.data.job.budget_cents}/></div>}</article></div></section>; }

function Reviews({ source, book }: { source: StudioDataSource; book: BookRecord }) {
  const client = useQueryClient(); const data = useQuery({ queryKey: ["reviews", book.id], queryFn: () => source.reviews(book.id) });
  const resolve = useMutation({ mutationFn: ({ review, approved }: { review: ReviewRecord; approved: boolean }) => { const rationale = window.prompt(approved ? "Approval rationale" : "Rejection rationale"); if (!rationale?.trim()) throw new Error("A rationale is required"); return source.resolveReview(book.id, review.id, approved, rationale); }, onSuccess: () => client.invalidateQueries({ queryKey: ["reviews", book.id] }) });
  return <section className="page"><PageHeader eyebrow="AUTHOR DECISION QUEUE" title="Review center" detail="Agent findings are proposals. Canon-changing work remains yours to approve."/><div className="review-grid">{data.data?.map((review) => <article className={`review-card ${review.severity}`} key={review.id}><div><code>{review.source.toUpperCase()}</code><span className={`status ${review.status}`}>{review.status}</span></div><h2>{review.title}</h2><p>{review.detail}</p><footer>{review.status === "open" || review.status === "pending" ? <><button className="button" disabled={resolve.isPending} onClick={() => resolve.mutate({ review, approved: false })}>REJECT</button><button className="button primary" disabled={resolve.isPending} onClick={() => resolve.mutate({ review, approved: true })}>APPROVE WITH RATIONALE</button></> : <small>Decision recorded</small>}</footer></article>)}{data.data?.length === 0 && <p>No pending reviews.</p>}{resolve.error && <div className="notice blocked">{resolve.error.message}</div>}</div></section>;
}
function Exports({ source, book }: { source: StudioDataSource; book: BookRecord }) { const closure = useQuery({ queryKey: ["closure", book.id], queryFn: () => source.closure(book.id) }); const run = useMutation({ mutationFn: () => source.exportBook(book.id) }); return <section className="page"><PageHeader eyebrow="PUBLISHING READINESS" title="Export center" detail="Generate portable manuscript files with an auditable closure and citation record."/><div className="export-grid"><article className={`closure ${closure.data?.publishable ? "verified" : "blocked"}`}><span className="seal">{closure.data?.publishable ? "✓" : "!"}</span><div><p>PUBLICATION GATE</p><h2>{closure.data?.publishable ? "READY" : "BLOCKED"}</h2><small>{closure.data?.findings.length ?? 0} active finding(s)</small></div></article><article className="panel"><PanelTitle index="F" title="EXPORT BUNDLE"/><ul><li>manuscript.md</li><li>closure-report.json</li><li>book.json</li></ul><button className="button primary" disabled={!closure.data?.publishable || run.isPending} onClick={() => run.mutate()}>GENERATE EXPORT</button>{!closure.data?.publishable && <p className="error">Resolve critical findings before export.</p>}{run.data && <code>{run.data.outputDirectory}</code>}</article></div><div className="finding-list">{closure.data?.findings.map((finding) => <article key={finding.code + finding.entityId}><code>{finding.code}</code><p>{finding.message}</p><span>{finding.severity}</span></article>)}</div></section>; }

export function StudioApp({ dataSource, embedded = false }: { dataSource: StudioDataSource; embedded?: boolean }) { return <QueryClientProvider client={queryClient}><RouterHost embedded={embedded}><Frame source={dataSource}/></RouterHost></QueryClientProvider>; }
