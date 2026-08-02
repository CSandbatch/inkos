import { existsSync } from "node:fs";
import { join } from "node:path";
import { MysteryEngine } from "./mystery-engine.js";
import { StudioStore } from "./store.js";

/** Compile canonical Studio mystery state into a read-only legacy-agent prompt projection. */
export function compileLegacyMysteryContext(projectRoot: string, bookId: string | undefined, agent: string, throughChapter = Number.MAX_SAFE_INTEGER): string | undefined {
  if (!bookId) return undefined;
  const filename = join(projectRoot, ".inkos", "studio.sqlite"); if (!existsSync(filename)) return undefined;
  const store = new StudioStore(filename);
  try {
    const engine = new MysteryEngine(store); const policy = engine.getPolicy(bookId); if (!policy) return undefined;
    const reader = engine.readerProjection(bookId, throughChapter);
    const sealed = agent === "auditor" ? engine.getSolution(bookId, "solution:read", "legacy-continuity-auditor") : null;
    return [
      "INKOS FAIR-PLAY 2026 — COMPILED READ-ONLY CONTEXT",
      "This projection comes from canonical SQLite state. Never invent, alter, or persist mystery canon in Markdown.",
      `Mode: ${policy.mode}. Rule pack: ${policy.rulePackVersion}.`,
      `Reader-visible projection:\n${JSON.stringify(reader)}`,
      sealed ? `Authorized sealed solution for audit only:\n${JSON.stringify(sealed)}` : "The sealed solution is intentionally unavailable to this agent.",
    ].join("\n\n");
  } finally { store.close(); }
}
