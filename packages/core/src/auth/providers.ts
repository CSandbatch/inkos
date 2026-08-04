import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { ProviderProfileSchema, MissingClientIdError, type ProviderProfile, type ResolvedEndpoints } from "./types.js";

/**
 * Configuration directory, resolved lazily on every call.
 *
 * Not a module-level constant: capturing `homedir()` at import time makes the
 * location untestable (an override set after import has no effect) and means a
 * test can silently write into the developer's real home directory.
 * `NOVELGRAPH_CONFIG_DIR` overrides it, which is also useful for containers and
 * for keeping separate profiles.
 */
export function authConfigDir(): string {
  return process.env.NOVELGRAPH_CONFIG_DIR || join(homedir(), ".novelgraph");
}

export function authConfigPath(): string {
  return join(authConfigDir(), "auth.json");
}

// Deliberately no `AUTH_CONFIG_PATH` constant. An eagerly evaluated path is a
// trap: it snapshots the home directory at import time, so any later override is
// silently ignored and a test can write into the developer's real home.

/**
 * Built-in provider scaffolds.
 *
 * These carry display metadata and inference defaults only. Endpoints and
 * client IDs are deliberately absent: NovelGraph is not a registered OAuth
 * client of any provider, and inventing endpoint URLs would produce code that
 * fails against the wrong host. An operator supplies `issuer` (for OIDC
 * discovery) or explicit endpoints, plus a `clientId`, via `auth configure`.
 */
const BUILT_IN: ReadonlyArray<Partial<ProviderProfile> & { id: string; displayName: string }> = [
  {
    id: "chatgpt",
    displayName: "ChatGPT / OpenAI",
    scopes: ["openid", "profile", "offline_access"],
    apiBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
  },
  {
    id: "codex",
    displayName: "OpenAI Codex",
    scopes: ["openid", "profile", "offline_access"],
    apiBaseUrl: "https://api.openai.com/v1",
  },
];

interface AuthConfigFile {
  providers?: Record<string, Partial<ProviderProfile>>;
}

async function readConfigFile(): Promise<AuthConfigFile> {
  try {
    return JSON.parse(await readFile(authConfigPath(), "utf8")) as AuthConfigFile;
  } catch {
    return {};
  }
}

async function writeConfigFile(config: AuthConfigFile): Promise<void> {
  await mkdir(dirname(authConfigPath()), { recursive: true });
  await writeFile(authConfigPath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

/** Environment overrides, checked before the config file. */
function environmentOverrides(id: string): Partial<ProviderProfile> {
  const key = id.toUpperCase().replace(/[^A-Z0-9]/gu, "_");
  const pick = (suffix: string) => process.env[`NOVELGRAPH_${key}_${suffix}`] || undefined;
  const scopes = pick("SCOPES");
  return {
    clientId: pick("CLIENT_ID"),
    clientSecret: pick("CLIENT_SECRET"),
    issuer: pick("ISSUER"),
    deviceAuthorizationEndpoint: pick("DEVICE_AUTHORIZATION_ENDPOINT"),
    tokenEndpoint: pick("TOKEN_ENDPOINT"),
    revocationEndpoint: pick("REVOCATION_ENDPOINT"),
    apiBaseUrl: pick("API_BASE_URL"),
    defaultModel: pick("MODEL"),
    ...(scopes ? { scopes: scopes.split(/[\s,]+/u).filter(Boolean) } : {}),
  };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Merge built-in scaffold ← config file ← environment. Later wins. */
export async function loadProvider(id: string): Promise<ProviderProfile> {
  const builtIn = BUILT_IN.find((p) => p.id === id);
  const config = await readConfigFile();
  const stored = config.providers?.[id];

  if (!builtIn && !stored) {
    const known = [...new Set([...BUILT_IN.map((p) => p.id), ...Object.keys(config.providers ?? {})])];
    throw new Error(`Unknown provider "${id}". Known providers: ${known.join(", ") || "(none)"}`);
  }

  const merged = {
    id,
    displayName: builtIn?.displayName ?? stored?.displayName ?? id,
    scopes: [],
    ...stripUndefined(builtIn ?? {}),
    ...stripUndefined(stored ?? {}),
    ...stripUndefined(environmentOverrides(id)),
  };

  return ProviderProfileSchema.parse(merged);
}

export async function listProviderIds(): Promise<string[]> {
  const config = await readConfigFile();
  return [...new Set([...BUILT_IN.map((p) => p.id), ...Object.keys(config.providers ?? {})])].sort();
}

/** Persist operator-supplied provider settings. Secrets are never stored here. */
export async function saveProviderConfig(id: string, patch: Partial<ProviderProfile>): Promise<void> {
  const config = await readConfigFile();
  const providers = config.providers ?? {};
  providers[id] = { ...providers[id], ...stripUndefined(patch) };
  await writeConfigFile({ ...config, providers });
}

interface DiscoveryDocument {
  device_authorization_endpoint?: string;
  token_endpoint?: string;
  revocation_endpoint?: string;
}

const discoveryCache = new Map<string, ResolvedEndpoints>();

/**
 * Resolve endpoints explicitly or via OIDC discovery.
 *
 * Discovery keeps provider URLs out of our source: we ask the issuer where its
 * endpoints are rather than asserting we already know.
 */
export async function resolveEndpoints(
  provider: ProviderProfile,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedEndpoints> {
  if (provider.deviceAuthorizationEndpoint && provider.tokenEndpoint) {
    return {
      deviceAuthorizationEndpoint: provider.deviceAuthorizationEndpoint,
      tokenEndpoint: provider.tokenEndpoint,
      revocationEndpoint: provider.revocationEndpoint,
    };
  }

  const issuer = provider.issuer;
  if (!issuer) {
    throw new Error(
      `Provider "${provider.id}" has neither explicit endpoints nor an issuer to discover them from.`,
    );
  }

  const cached = discoveryCache.get(issuer);
  if (cached) return cached;

  const url = `${issuer.replace(/\/+$/u, "")}/.well-known/openid-configuration`;
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(
      `OIDC discovery failed for "${provider.id}": ${response.status} ${response.statusText} at ${url}. ` +
      `Set explicit endpoints with 'novelgraph auth configure --device-endpoint <url> --token-endpoint <url>'.`,
    );
  }

  const document = (await response.json()) as DiscoveryDocument;
  if (!document.device_authorization_endpoint || !document.token_endpoint) {
    throw new Error(
      `Issuer ${issuer} does not advertise a device authorization endpoint. ` +
      `This provider may not support the device flow (RFC 8628).`,
    );
  }

  const resolved: ResolvedEndpoints = {
    deviceAuthorizationEndpoint: document.device_authorization_endpoint,
    tokenEndpoint: document.token_endpoint,
    revocationEndpoint: document.revocation_endpoint,
  };
  discoveryCache.set(issuer, resolved);
  return resolved;
}

export function requireClientId(provider: ProviderProfile): string {
  if (!provider.clientId) throw new MissingClientIdError(provider.id);
  return provider.clientId;
}

/** Test seam. */
export function clearDiscoveryCache(): void {
  discoveryCache.clear();
}
