import { Command } from "commander";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describeStorage, statusAll } from "@actalk/novelgraph-core";
import { findProjectRoot, log, GLOBAL_ENV_PATH } from "../runtime.js";

interface Check { name: string; ok: boolean; detail: string }

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

export const doctorCommand = new Command("doctor")
  .description("Check the local NovelGraph installation and project boundary")
  .action(async () => {
    const root = findProjectRoot();
    const major = Number.parseInt(process.version.slice(1).split(".")[0] ?? "0", 10);
    const checks: Check[] = [{ name: "Node.js >= 22", ok: major >= 22, detail: process.version }];

    try {
      const config = JSON.parse(await readFile(join(root, "novelgraph.json"), "utf8")) as Record<string, unknown>;
      const english = config.language === "en";
      checks.push({ name: "novelgraph.json", ok: english, detail: english ? "Found; language=en" : "Found, but language must be en" });
    } catch {
      checks.push({ name: "novelgraph.json", ok: false, detail: "Not found. Run 'novelgraph init'." });
    }

    const projectEnv = join(root, ".env");
    checks.push({ name: "Project environment", ok: await exists(projectEnv), detail: await exists(projectEnv) ? projectEnv : "Not found" });
    checks.push({ name: "Global environment", ok: true, detail: await exists(GLOBAL_ENV_PATH) ? GLOBAL_ENV_PATH : "Optional; not configured" });

    const database = join(root, ".novelgraph", "studio.sqlite");
    checks.push({ name: "Studio database", ok: true, detail: await exists(database) ? database : "Not created yet; launch 'novelgraph studio'" });

    const storage = await describeStorage();
    const authStatuses = await statusAll();
    const signedIn = authStatuses.filter((s) => s.state === "authenticated" || s.state === "refreshable");

    // Unprotected storage is only a failure when something is actually stored in
    // it. A project with no credentials has nothing at risk.
    const storageAtRisk = !storage.protected && signedIn.length > 0;
    checks.push({
      name: "Credential storage",
      ok: !storageAtRisk,
      detail: storageAtRisk
        ? `${storage.description} — tokens are stored unprotected on this machine`
        : storage.description,
    });

    checks.push({
      name: "Provider sign-in",
      ok: true,
      detail: signedIn.length
        ? `${signedIn.map((s) => s.providerId).join(", ")} (run 'novelgraph auth status' for detail)`
        : "Not signed in; run 'novelgraph auth login'",
    });

    log("\nNovelGraph Doctor\n");
    for (const check of checks) log(`  ${check.ok ? "[OK]" : "[!!]"} ${check.name}: ${check.detail}`);
    const failed = checks.filter((check) => !check.ok).length;
    log(failed ? `\n${failed} required issue(s) found.` : "\nAll required checks passed.");
    if (failed) process.exitCode = 1;
  });
