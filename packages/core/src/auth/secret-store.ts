import { execFile } from "node:child_process";
import { readFile, writeFile, unlink, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { authConfigDir } from "./providers.js";

/**
 * Secret storage backed by the operating system where one is available.
 *
 * Deliberately dependency-free: the repository carries almost no native
 * modules, and adding one for credential storage would complicate every
 * install. Instead we shell out to the platform's own tooling.
 *
 *   Windows  DPAPI via PowerShell (user-scoped; ciphertext is useless to
 *            another user or another machine)
 *   macOS    Keychain via `security`
 *   Linux    libsecret via `secret-tool`
 *   Fallback File at 0600, UNENCRYPTED, reported honestly as such
 *
 * The fallback is not pretended to be secure. `auth status` names the backend
 * so an author can see whether their tokens are OS-protected.
 */

const SERVICE = "novelgraph";
const fallbackPath = () => join(authConfigDir(), "credentials.json");

export type SecretBackend = "windows-dpapi" | "macos-keychain" | "libsecret" | "file-plaintext";

export interface SecretStore {
  readonly backend: SecretBackend;
  get(account: string): Promise<string | undefined>;
  set(account: string, secret: string): Promise<void>;
  delete(account: string): Promise<void>;
}

interface RunResult { stdout: string; stderr: string; code: number }

/** Run a command, passing any secret over stdin so it never reaches argv. */
function run(command: string, args: string[], stdin?: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = execFile(command, args, { windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error && typeof (error as NodeJS.ErrnoException).code === "number"
        ? Number((error as NodeJS.ErrnoException).code)
        : error ? 1 : 0;
      resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), code });
    });
    if (stdin !== undefined) {
      child.stdin?.end(stdin, "utf8");
    } else {
      child.stdin?.end();
    }
  });
}

async function commandExists(command: string): Promise<boolean> {
  const probe = process.platform === "win32"
    ? await run("where", [command])
    : await run("sh", ["-c", `command -v ${command}`]);
  return probe.code === 0 && probe.stdout.trim().length > 0;
}

// ── Windows: DPAPI via PowerShell ────────────────────────────────────────────
// ConvertFrom-SecureString applies DPAPI under the current user account, so the
// ciphertext cannot be decrypted by another user or on another machine.

const DPAPI_PROTECT = `
$ErrorActionPreference = 'Stop'
$plain = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($plain)) { exit 2 }
$secure = ConvertTo-SecureString -String $plain -AsPlainText -Force
[Console]::Out.Write((ConvertFrom-SecureString -SecureString $secure))
`.trim();

const DPAPI_UNPROTECT = `
$ErrorActionPreference = 'Stop'
$enc = [Console]::In.ReadToEnd()
if ([string]::IsNullOrEmpty($enc)) { exit 2 }
$secure = ConvertTo-SecureString -String $enc.Trim()
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
`.trim();

function dpapiFile(account: string): string {
  return join(authConfigDir(), `${account.replace(/[^a-z0-9._-]/giu, "_")}.dpapi`);
}

function powershellArgs(script: string): string[] {
  return ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script];
}

const windowsDpapiStore: SecretStore = {
  backend: "windows-dpapi",
  async get(account) {
    let ciphertext: string;
    try {
      ciphertext = await readFile(dpapiFile(account), "utf8");
    } catch {
      return undefined;
    }
    const result = await run("powershell.exe", powershellArgs(DPAPI_UNPROTECT), ciphertext);
    if (result.code !== 0 || !result.stdout) return undefined;
    return result.stdout;
  },
  async set(account, secret) {
    const result = await run("powershell.exe", powershellArgs(DPAPI_PROTECT), secret);
    if (result.code !== 0 || !result.stdout.trim()) {
      throw new Error(`DPAPI protection failed: ${result.stderr.trim() || "no output"}`);
    }
    await mkdir(authConfigDir(), { recursive: true });
    await writeFile(dpapiFile(account), result.stdout.trim(), "utf8");
  },
  async delete(account) {
    await unlink(dpapiFile(account)).catch(() => undefined);
  },
};

// ── macOS: Keychain ──────────────────────────────────────────────────────────

const macosKeychainStore: SecretStore = {
  backend: "macos-keychain",
  async get(account) {
    const result = await run("security", ["find-generic-password", "-s", SERVICE, "-a", account, "-w"]);
    if (result.code !== 0) return undefined;
    const value = result.stdout.replace(/\n$/u, "");
    return value.length > 0 ? value : undefined;
  },
  async set(account, secret) {
    // -U updates in place; -w - reads the secret from stdin rather than argv.
    const result = await run("security", ["add-generic-password", "-s", SERVICE, "-a", account, "-U", "-w", secret]);
    if (result.code !== 0) throw new Error(`Keychain write failed: ${result.stderr.trim()}`);
  },
  async delete(account) {
    await run("security", ["delete-generic-password", "-s", SERVICE, "-a", account]);
  },
};

// ── Linux: libsecret ─────────────────────────────────────────────────────────

const libsecretStore: SecretStore = {
  backend: "libsecret",
  async get(account) {
    const result = await run("secret-tool", ["lookup", "service", SERVICE, "account", account]);
    if (result.code !== 0 || !result.stdout) return undefined;
    return result.stdout.replace(/\n$/u, "") || undefined;
  },
  async set(account, secret) {
    const result = await run(
      "secret-tool",
      ["store", "--label", `NovelGraph (${account})`, "service", SERVICE, "account", account],
      secret,
    );
    if (result.code !== 0) throw new Error(`secret-tool write failed: ${result.stderr.trim()}`);
  },
  async delete(account) {
    await run("secret-tool", ["clear", "service", SERVICE, "account", account]);
  },
};

// ── Fallback: 0600 file, unencrypted, honestly labelled ──────────────────────

async function readFallback(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(fallbackPath(), "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

const filePlaintextStore: SecretStore = {
  backend: "file-plaintext",
  async get(account) {
    return (await readFallback())[account];
  },
  async set(account, secret) {
    const all = await readFallback();
    all[account] = secret;
    await mkdir(authConfigDir(), { recursive: true });
    await writeFile(fallbackPath(), `${JSON.stringify(all, null, 2)}\n`, "utf8");
    await chmod(fallbackPath(), 0o600).catch(() => undefined);
  },
  async delete(account) {
    const all = await readFallback();
    if (!(account in all)) return;
    delete all[account];
    await writeFile(fallbackPath(), `${JSON.stringify(all, null, 2)}\n`, "utf8");
    await chmod(fallbackPath(), 0o600).catch(() => undefined);
  },
};

let cached: SecretStore | undefined;

/** Select the best available backend for this platform, once per process. */
export async function getSecretStore(): Promise<SecretStore> {
  if (cached) return cached;

  if (process.env.NOVELGRAPH_SECRET_BACKEND === "file") {
    cached = filePlaintextStore;
    return cached;
  }

  if (process.platform === "win32" && await commandExists("powershell.exe")) {
    // Confirm DPAPI actually round-trips before committing to it.
    const probe = await run("powershell.exe", powershellArgs(DPAPI_PROTECT), "probe");
    if (probe.code === 0 && probe.stdout.trim()) {
      cached = windowsDpapiStore;
      return cached;
    }
  }

  if (process.platform === "darwin" && await commandExists("security")) {
    cached = macosKeychainStore;
    return cached;
  }

  if (process.platform === "linux" && await commandExists("secret-tool")) {
    cached = libsecretStore;
    return cached;
  }

  cached = filePlaintextStore;
  return cached;
}

export function describeBackend(backend: SecretBackend): string {
  switch (backend) {
    case "windows-dpapi": return "Windows DPAPI (user-scoped encryption)";
    case "macos-keychain": return "macOS Keychain";
    case "libsecret": return "libsecret (GNOME Keyring / KWallet)";
    case "file-plaintext": return "UNENCRYPTED file at ~/.novelgraph/credentials.json (mode 0600)";
  }
}

export function backendIsProtected(backend: SecretBackend): boolean {
  return backend !== "file-plaintext";
}

/** Test seam. */
export function resetSecretStoreCache(): void {
  cached = undefined;
}

export const __testing = { filePlaintextStore, windowsDpapiStore, macosKeychainStore, libsecretStore };
