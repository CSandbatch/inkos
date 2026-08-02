import { BaseAgent, type AgentContext } from "./base.js";
import { FAIR_PLAY_RULE_PACK, MysteryPolicySchema, MysterySolutionSchema, type MysteryPolicy, type MysterySolution } from "../studio/mystery-spec.js";
import type { ReaderProjection } from "../studio/mystery-engine.js";

export interface MysteryAgentResult<T = Record<string, unknown>> { readonly artifact: T; readonly tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number }; }

abstract class StructuredMysteryAgent<TInput, TOutput extends Record<string, unknown>> extends BaseAgent {
  protected abstract readonly directive: string;
  async run(input: TInput): Promise<MysteryAgentResult<TOutput>> {
    const response = await this.chat([
      { role: "system", content: `${this.directive}\n\nOperate under ${FAIR_PLAY_RULE_PACK}. Return one JSON object and no prose outside it. Never introduce evidence, technology, access, or motive solely in the final explanation.` },
      { role: "user", content: JSON.stringify(input) },
    ], { temperature: 0.2, maxTokens: 8192 });
    return { artifact: parseObject<TOutput>(response.content), tokenUsage: response.usage };
  }
}

export interface SolutionArchitectInput { readonly policy: MysteryPolicy; readonly premise: string; readonly approvedResearch: ReadonlyArray<{ citation: string; claim: string }>; readonly authorConstraints: ReadonlyArray<string>; }
export class SolutionArchitectAgent extends StructuredMysteryAgent<SolutionArchitectInput, Record<string, unknown>> {
  readonly name = "mystery-solution-architect";
  protected readonly directive = "Fix the true event before drafting. Return victimOrTarget, responsibleParties, actualEvent, apparentEvent, motive layers, method, opportunity, concealment, reconstruction, uncertainty, and locked=false. Make every causal step physically possible and traceable.";
  override async run(input: SolutionArchitectInput): Promise<MysteryAgentResult<Record<string, unknown>>> { MysteryPolicySchema.parse(input.policy); return super.run(input); }
}

export interface EvidenceArchitectInput { readonly policy: MysteryPolicy; readonly solution: MysterySolution; readonly approvedResearch: ReadonlyArray<{ citation: string; claim: string }>; }
export class EvidenceArchitectAgent extends StructuredMysteryAgent<EvidenceArchitectInput, Record<string, unknown>> {
  readonly name = "mystery-evidence-architect";
  protected readonly directive = "Build suspects, decisive and supporting evidence, red herrings, deductions, and false and alternative hypotheses. Every deduction must cite evidence. Separate apparent from true meaning and state reader visibility and first appearance.";
  override async run(input: EvidenceArchitectInput): Promise<MysteryAgentResult<Record<string, unknown>>> { MysterySolutionSchema.parse(input.solution); return super.run(input); }
}

export interface TimelineAccessInput { readonly policy: MysteryPolicy; readonly solution: MysterySolution; readonly evidence: ReadonlyArray<Record<string, unknown>>; }
export class TimelineAccessBuilderAgent extends StructuredMysteryAgent<TimelineAccessInput, Record<string, unknown>> {
  readonly name = "mystery-timeline-access-builder";
  protected readonly directive = "Build normalized event ranges, physical and digital access, character knowledge, account control, camera limitations, custody, and contradictions. Distinguish device or account evidence from bodily presence.";
}

/** Intentionally has no solution field: the solver competes using reader-visible evidence only. */
export interface AdversarialSolverInput { readonly policy: Omit<MysteryPolicy, "bookId">; readonly readerProjection: ReaderProjection; readonly manuscriptThroughChapter: string; }
export class AdversarialSolverAgent extends StructuredMysteryAgent<AdversarialSolverInput, Record<string, unknown>> {
  readonly name = "mystery-adversarial-solver";
  protected readonly directive = "Act as an attentive reader. Attempt a primary solution and the strongest alternative using only the supplied reader projection. List supporting and falsifying evidence, missing information, unresolved ambiguity, and whether the case is presently solvable.";
}

export interface FairnessAuditInput { readonly policy: MysteryPolicy; readonly solution: MysterySolution; readonly readerProjection: ReaderProjection; readonly adversarialResult: Record<string, unknown>; }
export class FairnessAuditorAgent extends StructuredMysteryAgent<FairnessAuditInput, Record<string, unknown>> {
  readonly name = "mystery-fairness-auditor";
  protected readonly directive = "Compare the sealed solution with the reader projection and adversarial result. Audit fair disclosure, causal completeness, alternative solutions, retrospective coherence, stereotypes, oracle shortcuts, and reader trust. Return stable rule codes, severity, evidence references, and repairs.";
}

export interface RealismAuditInput { readonly policy: MysteryPolicy; readonly evidence: ReadonlyArray<Record<string, unknown>>; readonly timeline: ReadonlyArray<Record<string, unknown>>; readonly access: ReadonlyArray<Record<string, unknown>>; readonly approvedResearch: ReadonlyArray<{ citation: string; claim: string }>; }
export class RealismAuditorAgent extends StructuredMysteryAgent<RealismAuditInput, Record<string, unknown>> {
  readonly name = "mystery-realism-auditor";
  protected readonly directive = "Audit digital provenance, timestamps, location, surveillance, biometrics, forensic methods, custody, documents, witnesses, and procedural delay. Treat model output and detectors as claims or leads, never oracles. Identify unsupported mechanisms requiring cited research.";
}

export interface MysteryRevisionInput { readonly readerProjection: ReaderProjection; readonly findings: ReadonlyArray<Record<string, unknown>>; readonly lockedCanonSummary: ReadonlyArray<string>; readonly chapter: string; }
export class MysteryReviserAgent extends StructuredMysteryAgent<MysteryRevisionInput, Record<string, unknown>> {
  readonly name = "mystery-reviser";
  protected readonly directive = "Propose a revised chapter and explicit state changes that repair findings without changing locked canon. Return any unavoidable canon change separately as a retcon proposal; never plant decisive evidence retroactively or expose sealed information early.";
}

export type MysterySpecialistKind = "solution-architect" | "evidence-architect" | "timeline-access-builder" | "adversarial-solver" | "fairness-auditor" | "realism-auditor" | "mystery-reviser";
export function createMysterySpecialist(kind: MysterySpecialistKind, context: AgentContext): BaseAgent {
  switch (kind) {
    case "solution-architect": return new SolutionArchitectAgent(context);
    case "evidence-architect": return new EvidenceArchitectAgent(context);
    case "timeline-access-builder": return new TimelineAccessBuilderAgent(context);
    case "adversarial-solver": return new AdversarialSolverAgent(context);
    case "fairness-auditor": return new FairnessAuditorAgent(context);
    case "realism-auditor": return new RealismAuditorAgent(context);
    case "mystery-reviser": return new MysteryReviserAgent(context);
  }
}

function parseObject<T extends Record<string, unknown>>(content: string): T {
  const match = content.match(/\{[\s\S]*\}/u); if (!match) throw new Error("Mystery specialist returned no JSON object");
  const value = JSON.parse(match[0]) as unknown; if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Mystery specialist returned an invalid artifact");
  return value as T;
}
