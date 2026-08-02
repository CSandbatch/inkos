import { z } from "zod";

export const FAIR_PLAY_RULE_PACK = "fair-play-detective-2026@1" as const;
export const PROSE_PATTERN_RULE_PACK = "english-prose-patterns-2026@1" as const;

export const MysteryModeSchema = z.enum(["strict-golden-age", "contemporary", "hybrid", "rule-breaking"]);
export const ArtifactVisibilitySchema = z.enum(["reader-visible", "solution-authorized", "author-only"]);
export const EvidenceReliabilitySchema = z.enum(["established", "highly-probable", "plausible", "unresolved"]);
export const MysteryCapabilitySchema = z.enum([
  "story:read", "reader-view:read", "solution:read", "solution:write", "research:web",
  "draft:write", "canon:propose", "approval:request", "publish:export",
]);
export const ValidationSuiteSchema = z.enum([
  "fair-disclosure", "causal-completeness", "digital-realism", "forensic-realism",
  "character-logic", "alternative-solution", "retrospective", "anti-stereotype",
  "anti-oracle", "reader-trust", "prose-patterns",
]);
export const FindingSeveritySchema = z.enum(["blocker", "major", "moderate", "minor", "advisory"]);
export const FindingStatusSchema = z.enum(["open", "resolved", "dismissed", "waived"]);

export type MysteryMode = z.infer<typeof MysteryModeSchema>;
export type ArtifactVisibility = z.infer<typeof ArtifactVisibilitySchema>;
export type EvidenceReliability = z.infer<typeof EvidenceReliabilitySchema>;
export type MysteryCapability = z.infer<typeof MysteryCapabilitySchema>;
export type ValidationSuite = z.infer<typeof ValidationSuiteSchema>;
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const MysteryPolicySchema = z.object({
  bookId: z.string().uuid(),
  mode: MysteryModeSchema.default("contemporary"),
  centralCrime: z.string().min(1),
  period: z.string().default("contemporary"),
  technologyLevel: z.string().default("contemporary"),
  investigatorStructure: z.enum(["principal", "ensemble"]).default("principal"),
  responsibilityModel: z.enum(["single", "multiple-traceable"]).default("single"),
  prosePatternsEnabled: z.boolean().default(true),
  rulePackVersion: z.literal(FAIR_PLAY_RULE_PACK).default(FAIR_PLAY_RULE_PACK),
});

export const MysterySolutionSchema = z.object({
  bookId: z.string().uuid(),
  victimOrTarget: z.string().min(1),
  responsibleParties: z.array(z.string().min(1)).min(1),
  actualEvent: z.string().min(1),
  apparentEvent: z.string().min(1),
  motive: z.object({ actual: z.string().min(1), selfJustification: z.string().default(""), publicExplanation: z.string().default(""), investigatorInterpretation: z.string().default("") }),
  method: z.string().min(1),
  opportunity: z.string().min(1),
  concealment: z.string().min(1),
  reconstruction: z.array(z.string().min(1)).min(1),
  uncertainty: EvidenceReliabilitySchema.default("established"),
  locked: z.boolean().default(false),
});

export const MysterySuspectSchema = z.object({
  id: z.string().uuid().optional(), bookId: z.string().uuid(), name: z.string().min(1), relationshipToTarget: z.string().min(1),
  visibleMotive: z.string().default(""), hiddenPressure: z.string().default(""), apparentOpportunity: z.string().default(""),
  actualMovements: z.string().default(""), secretUnrelatedToCrime: z.string().default(""), reasonNotResponsible: z.string().default(""),
  introducedChapter: z.number().int().positive().optional(), prominent: z.boolean().default(true), extensions: z.record(z.unknown()).default({}),
});

export const DigitalEvidenceExtensionSchema = z.object({
  origin: z.string().optional(), device: z.string().optional(), account: z.string().optional(), platform: z.string().optional(),
  creationTime: z.string().optional(), modificationTime: z.string().optional(), uploadTime: z.string().optional(), accessHistory: z.array(z.string()).optional(),
  extractionMethod: z.string().optional(), chainOfCustody: z.array(z.string()).optional(), possibleManipulation: z.string().optional(),
  synchronizationLimits: z.string().optional(), accountSharing: z.string().optional(), automation: z.string().optional(), corroboration: z.array(z.string()).optional(),
  researchIds: z.array(z.string().uuid()).optional(),
  camera: z.object({ position: z.string(), fieldOfView: z.string(), frameRate: z.string().optional(), imageQuality: z.string(), audio: z.boolean().optional(), clockAccuracy: z.string(), activation: z.string(), retention: z.string().optional(), blindSpots: z.array(z.string()), ownership: z.string().optional(), accessPermissions: z.string().optional() }).optional(),
  oracleSource: z.boolean().optional(), establishesGuiltAlone: z.boolean().optional(), narratorFalseFact: z.boolean().optional(),
}).passthrough();
export const ForensicEvidenceExtensionSchema = z.object({
  sample: z.string().optional(), collectionMethod: z.string().optional(), test: z.string().optional(), result: z.string().optional(), interpretation: z.string().optional(),
  confidence: EvidenceReliabilitySchema.optional(), limitation: z.string().optional(), alternativeExplanations: z.array(z.string()).optional(),
  chainOfCustody: z.array(z.string()).optional(), contaminationRisk: z.string().optional(), delay: z.string().optional(),
  researchIds: z.array(z.string().uuid()).optional(),
  oracleSource: z.boolean().optional(), establishesGuiltAlone: z.boolean().optional(), narratorFalseFact: z.boolean().optional(),
}).passthrough();

export const MysteryEvidenceSchema = z.object({
  id: z.string().uuid().optional(), bookId: z.string().uuid(), title: z.string().min(1),
  kind: z.enum(["physical", "testimony", "digital", "forensic", "document", "chronology", "behavioral", "spatial", "linguistic", "social"]),
  source: z.string().min(1), reliability: EvidenceReliabilitySchema, visibility: ArtifactVisibilitySchema.default("reader-visible"),
  firstAppearanceChapter: z.number().int().positive().optional(), revealChapter: z.number().int().positive().optional(),
  apparentMeaning: z.string().default(""), trueMeaning: z.string().min(1), required: z.boolean().default(false), redHerring: z.boolean().default(false),
  corroborates: z.array(z.string().uuid()).default([]), contradicts: z.array(z.string().uuid()).default([]), extensions: z.record(z.unknown()).default({}),
}).superRefine((value, context) => {
  if (value.kind === "digital" && Object.keys(value.extensions).length) { const result = DigitalEvidenceExtensionSchema.safeParse(value.extensions); if (!result.success) context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid digital-evidence extension", path: ["extensions"] }); }
  if (value.kind === "forensic" && Object.keys(value.extensions).length) { const result = ForensicEvidenceExtensionSchema.safeParse(value.extensions); if (!result.success) context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid forensic-evidence extension", path: ["extensions"] }); }
});

export const TimelineEventSchema = z.object({
  id: z.string().uuid().optional(), bookId: z.string().uuid(), label: z.string().min(1), earliest: z.string().min(1), latest: z.string().min(1),
  timezone: z.string().default("local/unspecified"), timeKind: z.enum(["fixed", "estimated", "reported", "inferred", "falsified"]),
  source: z.string().min(1), reliability: EvidenceReliabilitySchema, visibility: ArtifactVisibilitySchema.default("solution-authorized"),
  firstAppearanceChapter: z.number().int().positive().optional(), conflicts: z.array(z.string().uuid()).default([]), extensions: z.record(z.unknown()).default({}),
});

export const AccessRecordSchema = z.object({
  id: z.string().uuid().optional(), bookId: z.string().uuid(), characterId: z.string().min(1),
  accessKind: z.enum(["physical", "digital", "technical"]), resource: z.string().min(1), availableFrom: z.string().optional(), availableTo: z.string().optional(),
  evidenceIds: z.array(z.string().uuid()).default([]), extensions: z.record(z.unknown()).default({}),
});

export const KnowledgeRecordSchema = z.object({
  id: z.string().uuid().optional(), bookId: z.string().uuid(), characterId: z.string().min(1), fact: z.string().min(1),
  state: z.enum(["knows", "believes", "conceals", "misunderstands", "learns"]), chapter: z.number().int().positive().optional(), visibility: ArtifactVisibilitySchema.default("solution-authorized"), evidenceIds: z.array(z.string().uuid()).default([]),
});

export const HypothesisSchema = z.object({
  id: z.string().uuid().optional(), bookId: z.string().uuid(), kind: z.enum(["initial", "alternative", "false", "true"]), summary: z.string().min(1),
  supportingEvidence: z.array(z.string().uuid()).default([]), falsifyingEvidence: z.array(z.string().uuid()).default([]), status: z.enum(["active", "falsified", "confirmed", "unresolved"]).default("active"), equallySupported: z.boolean().default(false),
});

export const DeductionSchema = z.object({
  id: z.string().uuid().optional(), bookId: z.string().uuid(), conclusion: z.string().min(1), evidenceIds: z.array(z.string().uuid()).min(1),
  sequence: z.number().int().nonnegative(), visibility: ArtifactVisibilitySchema.default("solution-authorized"),
});

export const RuleFindingSchema = z.object({
  id: z.string().uuid().optional(), bookId: z.string().uuid(), ruleCode: z.string().min(1), rulePackVersion: z.string().min(1),
  suite: ValidationSuiteSchema, severity: FindingSeveritySchema, status: FindingStatusSchema.default("open"), message: z.string().min(1),
  evidenceIds: z.array(z.string().uuid()).default([]), entityType: z.string().optional(), entityId: z.string().optional(), permittedActions: z.array(z.enum(["revise", "review", "dismiss", "waive", "change-mode"])).default(["revise"]),
});

export const WorkflowArtifactSchema = z.object({
  jobId: z.string().uuid(), nodeId: z.string().uuid().optional(), kind: z.string().min(1), visibility: ArtifactVisibilitySchema,
  rulePackVersion: z.string().min(1), content: z.unknown(),
});

export interface RulePackContract {
  readonly id: string;
  readonly version: string;
  readonly workflowTemplate: string;
  readonly stateExtensions: ReadonlyArray<string>;
  readonly validators: ReadonlyArray<z.infer<typeof ValidationSuiteSchema>>;
  readonly readerPersonas: ReadonlyArray<string>;
  readonly requiredCapabilities: ReadonlyArray<MysteryCapability>;
}

export const FAIR_PLAY_2026_CONTRACT: RulePackContract = {
  id: "fair-play-detective-2026", version: "1", workflowTemplate: "mystery-2026",
  stateExtensions: ["sealed-solution", "suspects", "evidence", "timeline", "access", "knowledge", "hypotheses", "deductions"],
  validators: ValidationSuiteSchema.options.filter((item) => item !== "prose-patterns"),
  readerPersonas: ["armchair-solver", "evidence-skeptic", "continuity-hawk"],
  requiredCapabilities: ["story:read", "reader-view:read", "solution:read", "solution:write", "research:web", "draft:write", "canon:propose", "approval:request"],
};

export const FAIR_PLAY_RULE_CATALOG = [
  { code: "FP-POLICY-001", suite: "fair-disclosure", defaultSeverity: "blocker", title: "Mystery policy required" },
  { code: "FP-DISCLOSURE-001", suite: "fair-disclosure", defaultSeverity: "blocker", title: "Decisive evidence must be reader-visible" },
  { code: "FP-DISCLOSURE-002", suite: "fair-disclosure", defaultSeverity: "blocker", title: "Decisive evidence needs a first appearance" },
  { code: "FP-DISCLOSURE-003", suite: "fair-disclosure", defaultSeverity: "blocker", title: "Evidence must precede its reveal" },
  { code: "FP-DEDUCTION-001", suite: "fair-disclosure", defaultSeverity: "blocker", title: "Every deduction must reference existing evidence" },
  { code: "CAUSAL-SOLUTION-001", suite: "causal-completeness", defaultSeverity: "blocker", title: "True and apparent events are required" },
  { code: "CAUSAL-SOLUTION-002", suite: "causal-completeness", defaultSeverity: "blocker", title: "The solution must be locked" },
  { code: "ACCESS-001", suite: "causal-completeness", defaultSeverity: "blocker", title: "Responsibility requires documented access" },
  { code: "TIME-RANGE-001", suite: "causal-completeness", defaultSeverity: "blocker", title: "Timeline ranges must be possible" },
  { code: "MODE-STRICT-001", suite: "fair-disclosure", defaultSeverity: "blocker", title: "Strict mode requires murder" },
  { code: "MODE-STRICT-002", suite: "causal-completeness", defaultSeverity: "blocker", title: "Strict mode requires one principal culprit" },
  { code: "DIGITAL-PROVENANCE-001", suite: "digital-realism", defaultSeverity: "major", title: "Digital evidence needs provenance and limitations" },
  { code: "DIGITAL-RESEARCH-001", suite: "digital-realism", defaultSeverity: "major", title: "Decisive digital mechanisms need admitted research" },
  { code: "FORENSIC-METHOD-001", suite: "forensic-realism", defaultSeverity: "major", title: "Forensic evidence needs method and limitations" },
  { code: "FORENSIC-RESEARCH-001", suite: "forensic-realism", defaultSeverity: "major", title: "Decisive forensic mechanisms need admitted research" },
  { code: "ALT-SOLUTION-001", suite: "alternative-solution", defaultSeverity: "major", title: "Test an alternative solution" },
  { code: "FP-RED-HERRING-001", suite: "reader-trust", defaultSeverity: "major", title: "Red herrings need documented reversals" },
  { code: "CHARACTER-LOGIC-001", suite: "character-logic", defaultSeverity: "major", title: "Conduct, motive, and pressure must cohere" },
  { code: "RETROSPECTIVE-001", suite: "retrospective", defaultSeverity: "major", title: "Earlier scenes must remain coherent after the reveal" },
  { code: "STEREOTYPE-001", suite: "anti-stereotype", defaultSeverity: "blocker", title: "Identity or marginality cannot substitute for evidence" },
  { code: "ORACLE-001", suite: "anti-oracle", defaultSeverity: "blocker", title: "Systems, experts, biometrics, and confessions cannot replace deduction" },
  { code: "READER-TRUST-001", suite: "reader-trust", defaultSeverity: "blocker", title: "Narration cannot conceal an indispensable fact" },
] as const satisfies ReadonlyArray<{ code: string; suite: z.infer<typeof ValidationSuiteSchema>; defaultSeverity: z.infer<typeof FindingSeveritySchema>; title: string }>;

export const MODE_POLICIES: Record<MysteryMode, { murderRequired: boolean; principalInvestigatorRequired: boolean; singleResponsiblePartyRequired: boolean; waiverAllowed: boolean }> = {
  "strict-golden-age": { murderRequired: true, principalInvestigatorRequired: true, singleResponsiblePartyRequired: true, waiverAllowed: false },
  contemporary: { murderRequired: false, principalInvestigatorRequired: false, singleResponsiblePartyRequired: false, waiverAllowed: false },
  hybrid: { murderRequired: false, principalInvestigatorRequired: false, singleResponsiblePartyRequired: false, waiverAllowed: false },
  "rule-breaking": { murderRequired: false, principalInvestigatorRequired: false, singleResponsiblePartyRequired: false, waiverAllowed: true },
};

export type MysteryPolicy = z.infer<typeof MysteryPolicySchema>;
export type MysterySolution = z.infer<typeof MysterySolutionSchema>;
export type MysteryEvidence = z.infer<typeof MysteryEvidenceSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type RuleFinding = z.infer<typeof RuleFindingSchema>;
