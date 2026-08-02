import { PROSE_PATTERN_RULE_PACK } from "./mystery-spec.js";

export type ProseContext = "narration" | "dialogue" | "quotation" | "documentation";
export interface ProsePatternFinding {
  readonly rulePackVersion: typeof PROSE_PATTERN_RULE_PACK;
  readonly category: string;
  readonly pattern: string;
  readonly line: number;
  readonly column: number;
  readonly context: ProseContext;
  readonly excerpt: string;
  readonly suggestion: string;
  readonly severity: "advisory";
}

const PHRASE_GROUPS: ReadonlyArray<{ category: string; phrases: ReadonlyArray<string>; suggestion: string }> = [
  { category: "contrast-machine", phrases: ["this is not", "it's not about", "isn't just", "more than just", "not merely", "less about", "not because", "the question is not whether", "the real issue is not", "rather, it means", "at once", "both things can be true", "on the one hand", "on the other hand"], suggestion: "Check whether the contrast states a real distinction instead of manufacturing one." },
  { category: "significance-claim", phrases: ["what matters", "why it matters", "matters more than ever", "the stakes are", "at its core", "at the heart of", "the broader significance", "a reminder that", "underscores the importance", "highlights the need"], suggestion: "Name the concrete consequence instead of asserting significance." },
  { category: "canned-opening", phrases: ["in today's", "in an era of", "in a world where", "as we navigate", "throughout history", "since the dawn of", "it is no secret", "there is no denying", "few things are as", "when it comes to"], suggestion: "Begin with the particular event, claim, or image." },
  { category: "canned-transition", phrases: ["with that in mind", "that being said", "having said that", "it is worth noting", "it is important to note", "on a deeper level", "more broadly", "in other words", "put simply", "by contrast", "in the same vein", "moving forward"], suggestion: "Let the logical relation or scene action perform the transition." },
  { category: "canned-conclusion", phrases: ["in conclusion", "to sum up", "ultimately", "at the end of the day", "the path forward", "the future of", "only time will tell", "one thing is clear", "the possibilities are endless", "the journey is just beginning"], suggestion: "End on the final concrete implication rather than a stock summary." },
  { category: "inflated-abstraction", phrases: ["landscape", "ecosystem", "paradigm", "framework", "intersection", "space", "realm", "dimension", "journey", "conversation", "narrative", "discourse", "complexities", "implications", "challenges", "opportunities"], suggestion: "Replace the abstraction with the specific system, action, or conflict." },
  { category: "inflated-adjective", phrases: ["nuanced", "multifaceted", "robust", "holistic", "seamless", "meaningful", "intentional", "impactful", "transformative", "dynamic", "vibrant", "compelling", "innovative", "groundbreaking", "pivotal", "crucial", "vital", "unique", "authentic", "inclusive", "sustainable", "scalable", "actionable", "immersive", "human-centered"], suggestion: "Supply the observable property or measurement the adjective stands for." },
  { category: "corporate-verb", phrases: ["leverage", "utilize", "optimize", "streamline", "enhance", "elevate", "empower", "enable", "unlock", "foster", "cultivate", "facilitate", "drive engagement", "drive impact", "navigate", "reimagine", "revolutionize", "amplify", "harness", "maximize", "align", "operationalize", "future-proof", "resonate", "showcase", "deliver value", "position for success"], suggestion: "Use the exact action and identify who performs it." },
  { category: "academic-template", phrases: ["interrogate", "problematize", "foreground", "situate", "complicate", "unpack", "illuminate", "gesture toward", "speak to", "engage with", "a lens through which", "operate at the intersection", "reflect broader tensions", "raise important questions", "invite us to reconsider", "challenge traditional notions", "destabilize the boundary", "reframe our understanding"], suggestion: "State the textual evidence and the inference it supports." },
  { category: "synthetic-lyricism", phrases: ["deeply human", "haunting", "poignant", "evocative", "liminal", "visceral", "unflinching", "timeless", "universal", "the space between", "the silence between", "the echoes of", "threads of", "a tapestry woven", "shadows of the past", "the weight of memory", "the contours of", "a meditation on", "a love letter to", "a haunting reminder", "there is something profoundly", "in the end, perhaps", "what remains is", "still, something lingers", "the city breathes", "the archive remembers", "bears witness"], suggestion: "Keep lyricism only when a particular image, perception, or rhythm earns it." },
  { category: "modal-fog", phrases: ["can help", "can allow", "can enable", "can make it easier", "has the potential to", "may offer", "could lead to", "can play an important role", "can be a powerful tool"], suggestion: "Commit to a bounded causal claim or remove the sentence." },
  { category: "hedge-stack", phrases: ["may potentially", "could possibly", "might sometimes", "can often help", "tends to generally", "in many cases", "to some extent", "it seems that", "it is possible that", "depending on the context", "results may vary", "there are no guarantees", "not necessarily", "this is not always the case"], suggestion: "Retain only the qualification justified by the evidence." },
  { category: "fake-precision", phrases: ["several key factors", "a few important considerations", "three main reasons", "step-by-step guide", "best practices", "research shows", "experts agree", "studies suggest", "many people believe", "widely recognized", "in recent years", "increasingly", "a growing number", "significant improvement", "at scale", "real-time"], suggestion: "Add the source, date, baseline, quantity, or actual sequence." },
  { category: "redundant-explanation", phrases: ["goals and objectives", "challenges and obstacles", "methods and approaches", "completely comprehensive", "truly authentic", "in other words", "put another way"], suggestion: "Remove the duplicate term or restatement unless it changes the meaning." },
  { category: "artificial-balance", phrases: ["valid arguments on both sides", "truth likely lies somewhere in the middle", "both approaches have strengths and weaknesses", "neither approach is inherently better", "depends on your goals", "a balanced approach is often best", "combines elements of both"], suggestion: "Rank the alternatives using the evidence already available." },
  { category: "generic-humanism", phrases: ["at the heart of", "ultimately about people", "behind every data point", "human element", "human experience remains central", "human connection matters", "what it means to be human", "future should be human-centered", "empathy is key", "feel seen and heard"], suggestion: "Name the people, institution, conflict, or material consequence." },
  { category: "generic-inclusivity", phrases: ["all walks of life", "diverse range of perspectives", "historically been overlooked", "create space for", "seat at the table", "meet people where they are", "sense of belonging", "inclusive future", "center lived experience", "amplify marginalized voices"], suggestion: "Identify the affected group and the concrete mechanism or conflict." },
  { category: "marketing-sludge", phrases: ["game-changing", "next-generation", "next-level", "world-class", "industry-leading", "best-in-class", "state-of-the-art", "cutting-edge", "revolutionary", "disruptive", "frictionless", "effortless", "powerful yet intuitive", "designed with you in mind", "unlock your potential", "take it to the next level", "supercharge", "work smarter", "everything you need", "built for the future", "reimagine what is possible", "turn insights into action", "stay ahead of the curve"], suggestion: "Replace promotion with a verifiable capability or result." },
  { category: "technical-sludge", phrases: ["production-ready", "enterprise-grade", "modular architecture", "clean architecture", "follows best practices", "handles edge cases", "comprehensive error handling", "ensures data integrity", "seamless developer experience", "easy to extend", "secure by design", "optimized for performance", "wide range of use cases", "intentionally simple", "real-world production environment"], suggestion: "Name the boundary, test, threat model, measurement, or dependency rule." },
  { category: "assistant-voice", phrases: ["absolutely!", "certainly!", "great question", "of course", "i'd be happy to", "let's dive", "hope this helps", "feel free to", "let me know if", "i can also", "would you like me to", "here are some options to consider", "you're on the right track"], suggestion: "Remove assistant framing and begin with the material." },
];

export function analyzeEnglishProsePatterns(content: string): ReadonlyArray<ProsePatternFinding> {
  const findings: ProsePatternFinding[] = [];
  for (const group of PHRASE_GROUPS) for (const phrase of group.phrases) {
    const expression = new RegExp(escapeRegex(phrase), "giu"); let match: RegExpExecArray | null;
    while ((match = expression.exec(content))) findings.push(toFinding(content, match.index, match[0], group.category, group.suggestion));
  }
  findings.push(...structuralFindings(content));
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

function structuralFindings(content: string): ProsePatternFinding[] {
  const output: ProsePatternFinding[] = [];
  const sentences = [...content.matchAll(/[^.!?\n]+[.!?]?/g)].filter((match) => match[0].trim().length > 3);
  for (let index = 2; index < sentences.length; index++) {
    const run = sentences.slice(index - 2, index + 1); const starts = run.map((item) => item[0].trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase());
    if (new Set(starts).size === 1) output.push(toFinding(content, run[0].index ?? 0, starts[0] ?? "repeated opening", "repetitive-sentence-engineering", "Vary grammatical actors and sentence movement where repetition is not deliberate."));
  }
  const lines = content.split(/\r?\n/); let offset = 0;
  for (const line of lines) {
    const clauses = line.split(/[,;:—]/).map((item) => item.trim()).filter(Boolean);
    if (clauses.length === 3) output.push(toFinding(content, offset, line.slice(0, 80), "triadic-compulsion", "Check whether three items are necessary rather than a default completeness pattern."));
    if (/^(why|how|what)\b.*\?\s*(because|the answer|it is)/iu.test(line)) output.push(toFinding(content, offset, line.slice(0, 80), "self-answered-question", "State the answer directly unless the question creates genuine inquiry."));
    if (/^(and yet|the result|key takeaway|why it matters)[:?!.]?$/iu.test(line.trim())) output.push(toFinding(content, offset, line.trim(), "formatting-tell", "Use continuous prose unless the fragment carries necessary dramatic force."));
    offset += line.length + 1;
  }
  const paragraphs = content.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  if (paragraphs.length >= 4) {
    const lengths = paragraphs.map((value) => value.length); const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length; const variance = lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / lengths.length;
    if (mean && Math.sqrt(variance) / mean < 0.15) output.push(toFinding(content, 0, "uniform paragraph lengths", "document-regularity", "Inspect whether paragraph boundaries follow thought and rhythm rather than a template."));
  }
  return output;
}

function toFinding(content: string, index: number, matched: string, category: string, suggestion: string): ProsePatternFinding {
  const before = content.slice(0, index); const line = before.split(/\r?\n/).length; const lineStart = Math.max(before.lastIndexOf("\n") + 1, 0); const column = index - lineStart + 1;
  const excerpt = content.slice(Math.max(0, index - 45), Math.min(content.length, index + matched.length + 75)).replace(/\s+/g, " ").trim();
  return { rulePackVersion: PROSE_PATTERN_RULE_PACK, category, pattern: matched, line, column, context: detectContext(content, index), excerpt, suggestion, severity: "advisory" };
}

function detectContext(content: string, index: number): ProseContext {
  const line = content.slice(content.lastIndexOf("\n", index) + 1, content.indexOf("\n", index) === -1 ? content.length : content.indexOf("\n", index));
  if (/^\s{0,3}(#|[-*]\s|\d+\.\s|```)/u.test(line)) return "documentation";
  const before = line.slice(0, Math.max(0, index - (content.lastIndexOf("\n", index) + 1))); const quotes = (before.match(/[“”"]/gu) ?? []).length;
  if (quotes % 2 === 1) return "dialogue";
  if (/^\s*>/u.test(line)) return "quotation";
  return "narration";
}

function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
