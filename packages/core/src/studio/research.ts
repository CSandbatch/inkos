import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import type { StudioStore } from "./store.js";

function privateAddress(address: string): boolean {
  if (address === "::1" || address === "0.0.0.0") return true;
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:" )) return true;
  const p = address.split(".").map(Number);
  return p.length === 4 && (p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168));
}

/** Fetches a public research source while preventing private-network access. */
export class ResearchService {
  constructor(private readonly store: StudioStore) {}

  async collect(bookId: string, rawUrl: string, claim: string): Promise<string> {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) research URLs are allowed");
    if (url.username || url.password || url.hostname === "localhost") throw new Error("Local research targets are not allowed");
    const address = isIP(url.hostname) ? url.hostname : (await lookup(url.hostname)).address;
    if (privateAddress(address)) throw new Error("Private-network research targets are not allowed");
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "NovelGraph-Research/1.0" } });
    if (!response.ok) throw new Error(`Research fetch failed: HTTP ${response.status}`);
    const snapshot = (await response.text()).slice(0, 100_000);
    const title = snapshot.match(/<title[^>]*>([^<]{1,240})<\/title>/i)?.[1]?.trim() ?? url.hostname;
    const excerpt = snapshot.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").replace(/\s+/g, " ").slice(0, 2_000);
    const id = randomUUID(); const timestamp = new Date().toISOString();
    this.store.db.prepare("INSERT INTO research_items VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NULL)").run(id, bookId, url.toString(), title, excerpt, snapshot, claim, `${title} — ${url.toString()}`, timestamp);
    this.store.recordEvent(bookId, "research-agent", "research.collected", "research", id, null, { url: url.toString(), claim }, "Research requires author approval before canon admission");
    return id;
  }

  approve(bookId: string, researchId: string, rationale: string): string {
    const item = this.store.db.prepare("SELECT * FROM research_items WHERE id = ? AND book_id = ?").get(researchId, bookId) as { claim: string; citation: string } | undefined;
    if (!item) throw new Error("Research item not found");
    const approvalId = this.store.requestApproval(bookId, "research-admission", researchId, rationale);
    this.store.resolveApproval(approvalId, true);
    this.store.db.prepare("UPDATE research_items SET status = 'approved', approved_at = ? WHERE id = ?").run(new Date().toISOString(), researchId);
    this.store.recordEvent(bookId, "author", "research.approved", "research", researchId, null, item, rationale, approvalId);
    return approvalId;
  }
}
