import { createHash } from "node:crypto";
import { z } from "zod";
import { RevisionIdSchema } from "./contracts.js";

const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const unescapeXml = (value: string) => value.replaceAll("&quot;", '"').replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&amp;", "&");

export const ManuscriptBlockSchema = z.object({ id: z.string().regex(/^p-[a-z0-9-]+$/), text: z.string() });
export const ManuscriptSchema = z.object({ title: z.string().min(1), blocks: z.array(ManuscriptBlockSchema) });
export type Manuscript = z.infer<typeof ManuscriptSchema>;

export interface ImmutableManuscriptRevision {
  readonly id: z.infer<typeof RevisionIdSchema>;
  readonly tei: string;
  readonly manuscript: Manuscript;
  readonly createdAt: string;
}

/** Converts the alpha Markdown surface into a deliberately small, deterministic manuscript model. */
export function markdownToManuscript(markdown: string, title = "Untitled"): Manuscript {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const heading = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() || title;
  const paragraphs = lines.filter((line) => line.trim() && !/^#\s+/.test(line));
  return ManuscriptSchema.parse({ title: heading, blocks: paragraphs.map((text, index) => ({ id: `p-${String(index + 1).padStart(4, "0")}`, text: text.trim() })) });
}

export function manuscriptToMarkdown(manuscript: Manuscript): string {
  const value = ManuscriptSchema.parse(manuscript);
  return [`# ${value.title}`, ...value.blocks.map((block) => block.text)].join("\n\n") + "\n";
}

export function manuscriptToTei(manuscript: Manuscript): string {
  const value = ManuscriptSchema.parse(manuscript);
  const paragraphs = value.blocks.map((block) => `      <p xml:id="${escapeXml(block.id)}">${escapeXml(block.text)}</p>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0">\n  <teiHeader>\n    <fileDesc><titleStmt><title>${escapeXml(value.title)}</title></titleStmt></fileDesc>\n  </teiHeader>\n  <text><body>\n${paragraphs}\n  </body></text>\n</TEI>\n`;
}

export function teiToManuscript(tei: string): Manuscript {
  const titleMatch = tei.match(/<title>([\s\S]*?)<\/title>/);
  const paragraphMatches = [...tei.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)];
  if (/<p\b/.test(tei) && paragraphMatches.length === 0) throw new Error("Malformed TEI paragraph");
  const blocks = paragraphMatches.map((match) => {
    const tag = match[0].match(/^<p\b([^>]*)>/)?.[1] ?? "";
    const id = tag.match(/\bxml:id="([^"]+)"/)?.[1];
    if (!id) throw new Error("Every TEI paragraph requires xml:id");
    return { id: unescapeXml(id), text: unescapeXml(match[1]!) };
  });
  return ManuscriptSchema.parse({ title: unescapeXml(titleMatch?.[1] ?? "Untitled"), blocks });
}

export function createManuscriptRevision(manuscript: Manuscript, createdAt = new Date().toISOString()): ImmutableManuscriptRevision {
  const value = ManuscriptSchema.parse(manuscript);
  const tei = manuscriptToTei(value);
  const id = RevisionIdSchema.parse(`sha256-${createHash("sha256").update(tei, "utf8").digest("hex")}`);
  return Object.freeze({ id, tei, manuscript: value, createdAt });
}

export function createRevisionFromMarkdown(markdown: string, title?: string, createdAt?: string): ImmutableManuscriptRevision {
  return createManuscriptRevision(markdownToManuscript(markdown, title), createdAt);
}
