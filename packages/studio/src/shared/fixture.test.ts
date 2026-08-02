import { describe, expect, it } from "vitest";
import { FixtureStudioDataSource } from "./index.js";

describe("public demo fixture", () => {
  it("supports the promoted workflow without network access", async () => {
    const source = new FixtureStudioDataSource();
    const dashboard = await source.dashboard();
    const book = dashboard.books[0]!;
    expect((await source.book(book.id)).chapters).toHaveLength(1);
    expect((await source.graph(book.id)).obligations).not.toHaveLength(0);
    expect((await source.job((await source.startJob(book.id, 75)).id)).nodes).toHaveLength(10);
    expect((await source.closure(book.id)).publishable).toBe(false);
    expect((await source.exportBook(book.id)).files).toContain("manuscript.md");
  });

  it("keeps edits in memory", async () => {
    const source = new FixtureStudioDataSource();
    await source.saveChapter("demo-chapter", { contentMarkdown: "Revised fixture", reason: "test" });
    expect((await source.book("demo-book")).chapters[0]!.content_markdown).toBe("Revised fixture");
  });
});
