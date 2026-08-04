import { z } from "zod";

/**
 * Provider profile for an OAuth 2.0 Device Authorization Grant (RFC 8628).
 *
 * Endpoints are resolved one of two ways:
 *   1. Explicitly, via `deviceAuthorizationEndpoint` + `tokenEndpoint`.
 *   2. By OIDC discovery from `issuer` (`<issuer>/.well-known/openid-configuration`).
 *
 * Nothing is hardcoded. A provider is unusable until an operator supplies a
 * registered `clientId` — we do not ship one, because we do not have one.
 */
export const ProviderProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  /** OIDC issuer used for discovery when explicit endpoints are absent. */
  issuer: z.string().url().optional(),
  deviceAuthorizationEndpoint: z.string().url().optional(),
  tokenEndpoint: z.string().url().optional(),
  /** Revocation is optional in RFC 8628; logout still clears local tokens. */
  revocationEndpoint: z.string().url().optional(),
  /** OAuth client identifier issued by the provider to this application. */
  clientId: z.string().min(1).optional(),
  /** Confidential clients only. Most device-flow clients are public (PKCE). */
  clientSecret: z.string().min(1).optional(),
  scopes: z.array(z.string()).default([]),
  audience: z.string().optional(),
  /** Base URL used for inference once authenticated. */
  apiBaseUrl: z.string().url().optional(),
  defaultModel: z.string().optional(),
});

/**
 * Whether a profile has everything needed to start a flow.
 *
 * Deliberately separate from the schema: "not configured yet" is a normal state
 * for a built-in provider scaffold, not a validation failure. Folding it into
 * the schema would make merely *listing* providers throw.
 */
export function providerReadiness(profile: ProviderProfile): { ready: boolean; reason?: string } {
  if (!profile.clientId) {
    return {
      ready: false,
      reason: `No OAuth client ID. NovelGraph does not ship one — register a device-flow client, then run 'novelgraph auth configure --provider ${profile.id} --client-id <id> --issuer <url>'.`,
    };
  }
  const hasEndpoints = Boolean(profile.deviceAuthorizationEndpoint && profile.tokenEndpoint);
  if (!hasEndpoints && !profile.issuer) {
    return {
      ready: false,
      reason: `No issuer or endpoints. Run 'novelgraph auth configure --provider ${profile.id} --issuer <url>' (endpoints are discovered) or pass --device-endpoint and --token-endpoint.`,
    };
  }
  return { ready: true };
}

export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;

/** Endpoints after discovery/explicit resolution. */
export interface ResolvedEndpoints {
  readonly deviceAuthorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly revocationEndpoint?: string;
}

/** RFC 8628 §3.2 device authorization response. */
export const DeviceAuthorizationSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().url(),
  /** RFC 8628 §3.3.1 — pre-filled URI. Some providers spell it `_complete`. */
  verification_uri_complete: z.string().url().optional(),
  expires_in: z.number().int().positive(),
  /** Polling interval in seconds. Defaults to 5 per RFC 8628 §3.2. */
  interval: z.number().int().positive().default(5),
});

export type DeviceAuthorization = z.infer<typeof DeviceAuthorizationSchema>;

/** RFC 6749 §5.1 token response. */
export const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().default("Bearer"),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

/** What we persist. Tokens are secret; everything else is metadata. */
export const StoredCredentialSchema = z.object({
  providerId: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  tokenType: z.string().default("Bearer"),
  /** Epoch milliseconds. Absent means the provider gave no expiry. */
  expiresAt: z.number().int().positive().optional(),
  scopes: z.array(z.string()).default([]),
  obtainedAt: z.number().int().positive(),
  /** Which storage backend held this, for honest reporting in `auth status`. */
  backend: z.string().min(1),
});

export type StoredCredential = z.infer<typeof StoredCredentialSchema>;

export type AuthStatusState =
  | "authenticated"
  | "expired"
  | "refreshable"
  | "not-configured"
  | "no-client-id";

export interface AuthStatus {
  readonly providerId: string;
  readonly displayName: string;
  readonly state: AuthStatusState;
  readonly detail: string;
  readonly backend?: string;
  readonly expiresAt?: number;
  readonly scopes?: ReadonlyArray<string>;
}

/** Typed, non-retryable-vs-retryable OAuth failure. */
export class OAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean = false,
    readonly description?: string,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

/** Raised when a provider has no operator-supplied client ID. */
export class MissingClientIdError extends Error {
  constructor(readonly providerId: string) {
    super(
      `Provider "${providerId}" has no OAuth client ID. NovelGraph does not ship one. ` +
      `Register a device-flow client with the provider, then set it with:\n` +
      `  novelgraph auth configure --provider ${providerId} --client-id <id> --issuer <url>`,
    );
    this.name = "MissingClientIdError";
  }
}
