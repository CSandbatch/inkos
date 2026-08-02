import { describe, expect, it } from "vitest";
import { analyzeEnglishProsePatterns } from "../studio/index.js";

describe("English prose-pattern analyzer", () => {
  it("reports isolated supplied constructions aggressively without authorship claims", () => {
    const findings = analyzeEnglishProsePatterns("At its core, this robust framework can help unlock your potential.");
    expect(findings.map((item) => item.category)).toEqual(expect.arrayContaining(["significance-claim", "inflated-adjective", "modal-fog", "marketing-sludge"]));
    expect(JSON.stringify(findings).toLowerCase()).not.toContain("ai-generated");
    expect(findings.every((item) => item.severity === "advisory")).toBe(true);
  });

  it("labels dialogue, quotation, documentation, and narration contexts", () => {
    const text = `At its core, the clock mattered.\n\n“Ultimately, it can help,” she said.\n\n> Research shows the file was altered.\n\n# Why it matters`;
    const contexts = new Set(analyzeEnglishProsePatterns(text).map((item) => item.context));
    expect(contexts).toEqual(new Set(["narration", "dialogue", "quotation", "documentation"]));
  });

  it("detects structural regularity independently of vocabulary", () => {
    const findings = analyzeEnglishProsePatterns("This creates doubt. This creates delay. This creates pressure.");
    expect(findings.some((item) => item.category === "repetitive-sentence-engineering")).toBe(true);
  });
});
