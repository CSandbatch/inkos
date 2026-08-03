import { Command } from "commander";
import { access, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { log, logError, GLOBAL_ENV_PATH } from "../runtime.js";

async function hasGlobalConfig(): Promise<boolean> {
  try {
    const content = await readFile(GLOBAL_ENV_PATH, "utf-8");
    return content.includes("NOVELGRAPH_LLM_API_KEY=") && !content.includes("your-api-key-here");
  } catch {
    return false;
  }
}

export const initCommand = new Command("init")
  .description("Initialize a NovelGraph project (current directory by default)")
  .argument("[name]", "Project name (creates subdirectory). Omit to init current directory.")
  .option("--lang <language>", "Writing language (NovelGraph supports English)", "en")
  .action(async (name: string | undefined, opts: { lang?: string }) => {
    const projectDir = name ? join(process.cwd(), name) : process.cwd();
    const projectName = name ?? basename(projectDir);

    try {
      if (opts.lang && opts.lang !== "en") throw new Error("NovelGraph supports English projects only.");
      await mkdir(projectDir, { recursive: true });

      // Check if novelgraph.json already exists
      const configPath = join(projectDir, "novelgraph.json");
      try {
        await access(configPath);
        throw new Error(`novelgraph.json already exists in ${projectDir}. Use a different directory or delete the existing project.`);
      } catch (e) {
        if (e instanceof Error && e.message.includes("already exists")) throw e;
        // File doesn't exist, good
      }

      await mkdir(join(projectDir, "books"), { recursive: true });

      const config = {
        name: projectName,
        version: "0.5.0",
        language: "en",
        llm: {
          provider: process.env.NOVELGRAPH_LLM_PROVIDER ?? "openai",
          baseUrl: process.env.NOVELGRAPH_LLM_BASE_URL ?? "https://api.openai.com/v1",
          model: process.env.NOVELGRAPH_LLM_MODEL ?? "gpt-4o",
        },
        notify: [],
      };

      await writeFile(
        join(projectDir, "novelgraph.json"),
        JSON.stringify(config, null, 2),
        "utf-8",
      );

      const global = await hasGlobalConfig();

      if (global) {
        await writeFile(
          join(projectDir, ".env"),
          [
            "# Project-level LLM overrides (optional)",
            "# Global config at ~/.novelgraph/.env will be used by default.",
            "# Uncomment below to override for this project only:",
            "# NOVELGRAPH_LLM_PROVIDER=openai",
            "# NOVELGRAPH_LLM_BASE_URL=https://api.openai.com/v1",
            "# NOVELGRAPH_LLM_API_KEY=your-api-key-here",
            "# NOVELGRAPH_LLM_MODEL=gpt-4o",
          ].join("\n"),
          "utf-8",
        );
      } else {
        await writeFile(
          join(projectDir, ".env"),
          [
            "# LLM Configuration",
            "# Tip: Run 'novelgraph config set-global' to set once for all projects.",
            "# Provider: openai (OpenAI / compatible proxy), anthropic (Anthropic native)",
            "NOVELGRAPH_LLM_PROVIDER=openai",
            "NOVELGRAPH_LLM_BASE_URL=https://api.openai.com/v1",
            "NOVELGRAPH_LLM_API_KEY=your-api-key-here",
            "NOVELGRAPH_LLM_MODEL=gpt-4o",
            "",
            "# Optional parameters (defaults shown):",
            "# NOVELGRAPH_LLM_TEMPERATURE=0.7",
            "# NOVELGRAPH_LLM_MAX_TOKENS=8192",
            "# NOVELGRAPH_LLM_THINKING_BUDGET=0          # Anthropic extended thinking budget",
            "# NOVELGRAPH_LLM_API_FORMAT=chat             # chat (default) or responses (OpenAI Responses API)",
            "",
            "# Anthropic example:",
            "# NOVELGRAPH_LLM_PROVIDER=anthropic",
            "# NOVELGRAPH_LLM_BASE_URL=https://api.anthropic.com",
            "# NOVELGRAPH_LLM_MODEL=claude-sonnet-4-5-20250514",
          ].join("\n"),
          "utf-8",
        );
      }

      await writeFile(
        join(projectDir, ".gitignore"),
        [".env", ".novelgraph/", "node_modules/", ".DS_Store"].join("\n"),
        "utf-8",
      );

      log(`Project initialized at ${projectDir}`);
      log("");
      if (global) {
        log("Global LLM config detected. Ready to go!");
        log("");
        log("Next steps:");
        if (name) log(`  cd ${name}`);
        log("  novelgraph studio");
      } else {
        log("Next steps:");
        if (name) log(`  cd ${name}`);
        log("  # Option 1: Set global config (recommended, one-time):");
        log("  novelgraph config set-global --provider openai --base-url https://api.openai.com/v1 --api-key sk-xxx --model gpt-4o");
        log("  # Option 2: Edit .env for this project only");
        log("");
        log("  novelgraph studio");
      }
    } catch (e) {
      logError(`Failed to initialize project: ${e}`);
      process.exit(1);
    }
  });
