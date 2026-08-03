import { z } from "zod";

export const AnonymousDiagnosticSchema = z.object({
  installationId: z.string().uuid(),
  novelgraphVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/),
  osFamily: z.enum(["windows", "macos", "linux", "other"]),
  nodeVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  operation: z.enum(["studio.start", "project.create", "workflow.run", "workflow.resume", "export.create", "doctor.run"]),
  durationBucket: z.enum(["under-1s", "1-10s", "10-60s", "1-5m", "over-5m"]),
  outcome: z.enum(["success", "cancelled", "blocked", "failure"]),
  errorCode: z.enum(["configuration", "provider", "budget", "validation", "filesystem", "database", "network", "unknown"]).optional(),
}).strict();

export type AnonymousDiagnostic = z.infer<typeof AnonymousDiagnosticSchema>;

export function safeDiagnosticPayload(input: unknown): AnonymousDiagnostic {
  return AnonymousDiagnosticSchema.parse(input);
}
