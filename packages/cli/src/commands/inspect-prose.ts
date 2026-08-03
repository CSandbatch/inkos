import { Command } from "commander";
import { analyzeEnglishProsePatterns } from "@actalk/novelgraph-core";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { log, logError } from "../runtime.js";

const proseExtensions = new Set([".md", ".markdown", ".txt"]);

async function proseFiles(target: string): Promise<string[]> {
  const info = await stat(target);
  if (info.isFile()) return [target];
  if (!info.isDirectory()) throw new Error("The inspection target must be a text file or directory.");
  const files: string[] = [];
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const path = join(target, entry.name);
    if (entry.isDirectory()) files.push(...await proseFiles(path));
    else if (entry.isFile() && proseExtensions.has(extname(entry.name).toLowerCase())) files.push(path);
  }
  return files.sort();
}

export const inspectCommand = new Command("inspect-prose")
  .description("Locate advisory English prose patterns in a file or directory")
  .argument("<path>", "Markdown or text file, or a directory to inspect recursively")
  .option("--json", "Output structured findings")
  .action(async (path: string, options: { json?: boolean }) => {
    try {
      const target = resolve(path);
      const reports = [];
      for (const file of await proseFiles(target)) {
        reports.push({ file, findings: analyzeEnglishProsePatterns(await readFile(file, "utf8")) });
      }
      if (options.json) {
        log(JSON.stringify({ advisory: true, authorshipInference: false, reports }, null, 2));
        return;
      }
      log("Advisory prose inspection. Findings mark constructions for human review; they do not establish authorship.");
      for (const report of reports) {
        log(`${report.file}: ${report.findings.length} finding(s)`);
        for (const finding of report.findings) log(`  line ${finding.line}, ${finding.category}: ${finding.pattern}`);
      }
    } catch (error) {
      logError(`Prose inspection failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  });
