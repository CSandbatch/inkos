import { z } from "zod";

export const PublicationTargetSchema = z.enum(["general", "kindle-direct-publishing", "direct-sales"]);
export const ReaderPathwaySchema = z.enum(["balanced", "commercial", "literary"]);
export const ObligationStatusSchema = z.enum(["open", "progressing", "resolved", "deferred", "waived"]);
export const ObligationKindSchema = z.enum(["setup", "clue", "promise", "dependency", "commitment", "reveal"]);
export const ApprovalKindSchema = z.enum(["canon-retcon", "outline-change", "character-major-change", "research-admission", "gate-waiver"]);
export const JobStatusSchema = z.enum(["queued", "running", "blocked", "completed", "failed", "cancelled"]);
export const JobNodeStatusSchema = z.enum(["pending", "running", "completed", "failed", "skipped", "blocked"]);

export type PublicationTarget = z.infer<typeof PublicationTargetSchema>;
export type ReaderPathway = z.infer<typeof ReaderPathwaySchema>;
export type ObligationStatus = z.infer<typeof ObligationStatusSchema>;
export type ObligationKind = z.infer<typeof ObligationKindSchema>;
export type ApprovalKind = z.infer<typeof ApprovalKindSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type JobNodeStatus = z.infer<typeof JobNodeStatusSchema>;

export const SeriesInputSchema = z.object({ title: z.string().min(1), premise: z.string().default(""), publicationTarget: PublicationTargetSchema.default("general") });
export const BookInputSchema = z.object({ seriesId: z.string().uuid(), title: z.string().min(1), premise: z.string().default(""), genrePack: z.string().min(1).default("general"), plannedOrder: z.number().int().min(1).default(1) });
export const CharacterInputSchema = z.object({ bookId: z.string().uuid(), name: z.string().min(1), role: z.string().default("supporting"), profile: z.record(z.unknown()).default({}) });
export const ObligationInputSchema = z.object({ bookId: z.string().uuid(), kind: ObligationKindSchema, title: z.string().min(1), description: z.string().default(""), ownerCharacterId: z.string().uuid().optional(), targetChapter: z.number().int().positive().optional(), hard: z.boolean().default(true), dependencies: z.array(z.string().uuid()).default([]) });
export const MysteryCaseInputSchema = z.object({ bookId: z.string().uuid(), culprit: z.string().min(1), motive: z.string().min(1), means: z.string().min(1), opportunity: z.string().min(1), solutionLocked: z.boolean().default(true) });
export const ChapterInputSchema = z.object({ bookId: z.string().uuid(), number: z.number().int().positive(), title: z.string().min(1), contentMarkdown: z.string().default("") });
export const ChapterUpdateSchema = z.object({ title: z.string().min(1).optional(), contentMarkdown: z.string().optional(), reason: z.string().min(1).default("Author edit") });
export const ApprovalResolutionSchema = z.object({ approved: z.boolean(), rationale: z.string().min(1) });

export type SeriesInput = z.infer<typeof SeriesInputSchema>;
export type BookInput = z.infer<typeof BookInputSchema>;
export type CharacterInput = z.infer<typeof CharacterInputSchema>;
export type ObligationInput = z.infer<typeof ObligationInputSchema>;
export type ChapterInput = z.infer<typeof ChapterInputSchema>;
export type ChapterUpdate = z.infer<typeof ChapterUpdateSchema>;

export interface ReaderPersona {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly weight: number;
  readonly blocksApproval: boolean;
  readonly prompt: string;
}

export const ReaderFeedbackSchema = z.object({
  bookId: z.string().uuid(), chapterId: z.string().uuid(), personaId: z.string().min(1),
  reaction: z.string().min(1), confusion: z.string().default(""), expectation: z.string().default(""), evidence: z.string().min(1),
  severity: z.enum(["info", "warning", "critical"]), recommendation: z.string().min(1),
});
export type ReaderFeedback = z.infer<typeof ReaderFeedbackSchema>;

export interface ClosureFinding { readonly code: string; readonly severity: "critical" | "warning"; readonly message: string; readonly entityId?: string; }
export interface ClosureReport { readonly publishable: boolean; readonly findings: ReadonlyArray<ClosureFinding>; readonly generatedAt: string; }
export interface WorkflowNode { readonly id: string; readonly kind: "research" | "outline" | "scene-plan" | "draft" | "validate" | "graph-update" | "audit" | "reader-panel" | "revise" | "approval"; readonly dependsOn: ReadonlyArray<string>; readonly capability: "research" | "write" | "canon" | "publish"; }

export const BALANCED_READER_PANEL: ReadonlyArray<ReaderPersona> = [
  { id: "genre-fan", name: "Genre Fan", role: "Tests genre promises and delight", weight: 1, blocksApproval: true, prompt: "Evaluate whether the chapter delivers the selected genre's promises." },
  { id: "continuity-hawk", name: "Continuity Hawk", role: "Tracks facts and causality", weight: 1, blocksApproval: true, prompt: "Identify unsupported facts, causal breaks, and knowledge leaks." },
  { id: "emotional-reader", name: "Emotional Reader", role: "Tests character resonance", weight: 1, blocksApproval: false, prompt: "Report emotional connection, motivation clarity, and development." },
  { id: "pacing-reader", name: "Pacing and Clarity Reader", role: "Tests momentum and comprehension", weight: 1, blocksApproval: false, prompt: "Report confusion, pacing drag, and unmet scene expectations." },
  { id: "skeptical-critic", name: "Skeptical Critic", role: "Tests plausibility and payoff", weight: 1, blocksApproval: true, prompt: "Challenge convenience, weak evidence, and unearned resolution." },
];

export const STANDARD_WORKFLOW: ReadonlyArray<WorkflowNode> = [
  { id: "research", kind: "research", dependsOn: [], capability: "research" },
  { id: "outline", kind: "outline", dependsOn: ["research"], capability: "canon" },
  { id: "scene-plan", kind: "scene-plan", dependsOn: ["outline"], capability: "canon" },
  { id: "draft", kind: "draft", dependsOn: ["scene-plan"], capability: "write" },
  { id: "validate", kind: "validate", dependsOn: ["draft"], capability: "write" },
  { id: "graph-update", kind: "graph-update", dependsOn: ["validate"], capability: "canon" },
  { id: "audit", kind: "audit", dependsOn: ["graph-update"], capability: "write" },
  { id: "reader-panel", kind: "reader-panel", dependsOn: ["audit"], capability: "write" },
  { id: "revise", kind: "revise", dependsOn: ["reader-panel"], capability: "write" },
  { id: "approval", kind: "approval", dependsOn: ["revise"], capability: "publish" },
];
