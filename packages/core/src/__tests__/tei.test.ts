import { describe, expect, it } from "vitest";
import { createRevisionFromMarkdown, manuscriptToMarkdown, manuscriptToTei, teiToManuscript } from "../studio/index.js";

describe("immutable TEI manuscript revisions", () => {
  it("round-trips the supported Markdown surface deterministically", () => {
    const markdown = "# A Clock Without Hands\n\nThe clock stopped at 11:43.\n\nThe room stayed silent.";
    const revision = createRevisionFromMarkdown(markdown);
    expect(manuscriptToMarkdown(teiToManuscript(revision.tei))).toBe(`${markdown}\n`);
    expect(revision.id).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(revision.tei).toBe(manuscriptToTei(revision.manuscript));
  });

  it("assigns stable paragraph identifiers and changes identity when content changes", () => {
    const first = createRevisionFromMarkdown("# Book\n\nOne paragraph.");
    const second = createRevisionFromMarkdown("# Book\n\nA changed paragraph.");
    expect(first.manuscript.blocks[0]?.id).toBe("p-0001");
    expect(second.manuscript.blocks[0]?.id).toBe("p-0001");
    expect(first.id).not.toBe(second.id);
  });

  it("rejects malformed TEI blocks instead of creating a revision", () => {
    expect(() => teiToManuscript("<TEI><text><body><p>missing id</p></body></text></TEI>")).toThrow();
  });
});
