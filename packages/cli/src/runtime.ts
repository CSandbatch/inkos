import { homedir } from "node:os";
import { join } from "node:path";

export const GLOBAL_CONFIG_DIR = join(homedir(), ".novelgraph");
export const GLOBAL_ENV_PATH = join(GLOBAL_CONFIG_DIR, ".env");

export function findProjectRoot(): string {
  return process.cwd();
}

export function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function logError(message: string): void {
  process.stderr.write(`[ERROR] ${message}\n`);
}
