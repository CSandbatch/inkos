import { Command } from "commander";
import { findProjectRoot, log, logError } from "../runtime.js";
import { startStudio } from "@actalk/novelgraph-studio";

export const studioCommand = new Command("studio")
  .description("Start NovelGraph Studio web workbench")
  .option("-p, --port <port>", "Server port; selects an available port when omitted")
  .option("--host <host>", "Bind host; defaults to loopback", "127.0.0.1")
  .option("--no-open", "Do not open a browser")
  .action(async (opts) => {
    try {
      const port = opts.port === undefined ? undefined : Number(opts.port);
      if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error("Port must be an integer from 1 through 65535.");
      const { url } = await startStudio({ projectRoot: findProjectRoot(), port, host: opts.host, openBrowser: opts.open });
      log(`NovelGraph Studio is running at ${url}`);
    } catch (error) {
      logError(`Failed to start NovelGraph Studio: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  });
