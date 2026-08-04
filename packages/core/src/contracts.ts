import { z } from "zod";

/** Branded identifiers prevent accidentally passing one domain identifier as another. */
export const WorkIdSchema = z.string().uuid().brand("WorkId");
export const RevisionIdSchema = z.string().regex(/^sha256-[a-f0-9]{64}$/).brand("RevisionId");
export const ArtifactIdSchema = z.string().uuid().brand("ArtifactId");
export const NodeRunIdSchema = z.string().uuid().brand("NodeRunId");
export const AttemptIdSchema = z.string().uuid().brand("AttemptId");
export const GrantIdSchema = z.string().uuid().brand("GrantId");

export type WorkId = z.infer<typeof WorkIdSchema>;
export type RevisionId = z.infer<typeof RevisionIdSchema>;
export type ArtifactId = z.infer<typeof ArtifactIdSchema>;
export type NodeRunId = z.infer<typeof NodeRunIdSchema>;
export type AttemptId = z.infer<typeof AttemptIdSchema>;
export type GrantId = z.infer<typeof GrantIdSchema>;

export const AuthoritySchema = z.enum(["canonical", "interpretive", "working", "reader-visible", "sealed"]);
export const AssertionClassSchema = z.enum(["graph-native", "tei-derived", "author-declared", "worker-proposed", "inferred"]);
export const ContractArtifactVisibilitySchema = z.enum(["reader-visible", "solution-authorized", "author-only"]);
export const ContractCapabilitySchema = z.string().min(1);

export const EventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  aggregateType: z.string().min(1),
  aggregateId: z.string().min(1),
  actor: z.enum(["author", "worker", "validator", "system"]),
  occurredAt: z.string().datetime(),
  payload: z.record(z.unknown()),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

export const ContextManifestSchema = z.object({
  revisionId: RevisionIdSchema,
  graphRevisionId: z.string().min(1).optional(),
  packSnapshot: z.string().min(1),
  capabilities: z.array(ContractCapabilitySchema),
  exclusions: z.array(z.string()),
  resources: z.array(z.object({ type: z.string(), id: z.string(), hash: z.string().optional() })),
});
export type ContextManifest = z.infer<typeof ContextManifestSchema>;

export const CapabilityGrantSchema = z.object({
  id: GrantIdSchema,
  capability: ContractCapabilitySchema,
  subject: z.string().min(1),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  scope: z.array(z.string().min(1)),
});
export type CapabilityGrant = z.infer<typeof CapabilityGrantSchema>;
