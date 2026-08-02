import { describe, expect, it } from "vitest";
import { safeDiagnosticPayload } from "../studio/telemetry.js";

const allowed = { installationId: "3b28c570-d1c2-48a2-9254-1934ce6c82dc", inkosVersion: "0.4.9", osFamily: "windows", nodeVersion: "22.5.0", operation: "studio.start", durationBucket: "1-10s", outcome: "success" };

describe("anonymous diagnostics", () => {
  it("accepts the documented allowlist", () => expect(safeDiagnosticPayload(allowed)).toEqual(allowed));
  it.each(["manuscript", "prompt", "path", "apiKey", "projectName", "modelResponse"])("rejects forbidden field %s", (field) => expect(() => safeDiagnosticPayload({ ...allowed, [field]: "private" })).toThrow());
});
