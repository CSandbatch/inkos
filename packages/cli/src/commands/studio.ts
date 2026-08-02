import { Command } from "commander";
import { findProjectRoot, log, logError } from "../utils.js";
import { startStudio } from "@actalk/inkos-studio";

export const studioCommand = new Command("studio")
  .description("Start InkOS Studio web workbench")
  .option("-p, --port <port>", "Server port", "4567")
  .option("--host <host>", "Bind host; defaults to loopback", "127.0.0.1")
  .option("--no-open", "Do not open a browser")
  .action(async (opts) => {
    try {
      const { url } = await startStudio({ projectRoot: findProjectRoot(), port: Number(opts.port), host: opts.host, openBrowser: opts.open });
      log(`InkOS Studio is running at ${url}`);
    } catch (error) {
      logError(`Failed to start InkOS Studio: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  });
