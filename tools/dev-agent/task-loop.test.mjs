import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

describe("agent framework contracts", () => {
  it("documents the loop and memory authority boundary", async () => {
    const memory = await readFile(resolve(root, ".agent/README.md"), "utf8");
    assert.match(memory, /discover → orient → plan → implement → verify → document → review → handoff/u);
    assert.match(memory, /only a governed NovelGraph transaction/u);
  });

  it("keeps Hermes instructions and diagnostics present", async () => {
    const instructions = await readFile(resolve(root, "AGENTS.md"), "utf8");
    const doctor = await readFile(resolve(root, "tools/dev-agent/hermes-doctor.mjs"), "utf8");
    assert.match(instructions, /agent:context/u);
    assert.match(doctor, /Hermes unavailable/u);
    assert.match(doctor, /AGENTS\.md/u);
  });
});
