import { createHash, randomBytes } from "node:crypto";
import {
  DeviceAuthorizationSchema,
  TokenResponseSchema,
  OAuthError,
  type DeviceAuthorization,
  type ProviderProfile,
  type ResolvedEndpoints,
  type TokenResponse,
} from "./types.js";
import { requireClientId } from "./providers.js";

/**
 * OAuth 2.0 Device Authorization Grant — RFC 8628.
 *
 * Used because a local authoring tool has no reliable way to receive a browser
 * redirect: the author authenticates on whatever device is convenient while the
 * CLI or Studio polls for the result.
 *
 * PKCE (RFC 7636) is applied unconditionally. It is not required by RFC 8628,
 * but it costs nothing and binds the token exchange to the process that started
 * the flow, so an intercepted device code is not independently redeemable.
 */

export interface PkcePair {
  readonly verifier: string;
  readonly challenge: string;
  readonly method: "S256";
}

export function createPkcePair(): PkcePair {
  // RFC 7636 §4.1: 43–128 chars from the unreserved set. 32 random bytes
  // base64url-encoded yields 43.
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, method: "S256" };
}

/** RFC 6749 §5.2 error body. */
interface OAuthErrorBody {
  error?: string;
  error_description?: string;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new OAuthError(
      "invalid_response",
      `Provider returned a non-JSON response (HTTP ${response.status}). First 200 characters: ${text.slice(0, 200)}`,
    );
  }
}

function toFormBody(fields: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) params.set(key, value);
  }
  return params.toString();
}

/** RFC 8628 §3.1 — request a device code. */
export async function requestDeviceAuthorization(
  provider: ProviderProfile,
  endpoints: ResolvedEndpoints,
  pkce: PkcePair,
  fetchImpl: typeof fetch = fetch,
): Promise<DeviceAuthorization> {
  const clientId = requireClientId(provider);

  const response = await fetchImpl(endpoints.deviceAuthorizationEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: toFormBody({
      client_id: clientId,
      client_secret: provider.clientSecret,
      scope: provider.scopes.length ? provider.scopes.join(" ") : undefined,
      audience: provider.audience,
      code_challenge: pkce.challenge,
      code_challenge_method: pkce.method,
    }),
  });

  const body = await parseBody(response);

  if (!response.ok) {
    const error = body as OAuthErrorBody;
    throw new OAuthError(
      error.error ?? `http_${response.status}`,
      error.error_description
        ?? `Device authorization failed (HTTP ${response.status}) at ${endpoints.deviceAuthorizationEndpoint}.`,
      false,
      error.error_description,
    );
  }

  const parsed = DeviceAuthorizationSchema.safeParse(body);
  if (!parsed.success) {
    throw new OAuthError(
      "invalid_response",
      `Device authorization response did not match RFC 8628: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`,
    );
  }
  return parsed.data;
}

export interface PollOptions {
  /** Called once per poll so a UI can show progress. */
  readonly onPoll?: (elapsedSeconds: number, intervalSeconds: number) => void;
  /** Cancellation. */
  readonly signal?: AbortSignal;
  /** Test seam — defaults to real timers. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Test seam — defaults to Date.now. */
  readonly now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * RFC 8628 §3.4–3.5 — poll the token endpoint until the author approves.
 *
 * Error handling follows §3.5 exactly:
 *   authorization_pending  keep polling at the current interval
 *   slow_down              increase the interval by 5s, then keep polling
 *   access_denied          the author refused — terminal
 *   expired_token          the device code expired — terminal
 */
export async function pollForToken(
  provider: ProviderProfile,
  endpoints: ResolvedEndpoints,
  authorization: DeviceAuthorization,
  pkce: PkcePair,
  fetchImpl: typeof fetch = fetch,
  options: PollOptions = {},
): Promise<TokenResponse> {
  const clientId = requireClientId(provider);
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => Date.now());

  const startedAt = now();
  const deadline = startedAt + authorization.expires_in * 1000;
  let intervalSeconds = authorization.interval;

  for (;;) {
    if (options.signal?.aborted) {
      throw new OAuthError("cancelled", "Sign-in was cancelled.");
    }
    if (now() >= deadline) {
      throw new OAuthError(
        "expired_token",
        `The device code expired after ${authorization.expires_in}s. Run the sign-in command again.`,
      );
    }

    await sleep(intervalSeconds * 1000);
    options.onPoll?.(Math.round((now() - startedAt) / 1000), intervalSeconds);

    const response = await fetchImpl(endpoints.tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: toFormBody({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: authorization.device_code,
        client_id: clientId,
        client_secret: provider.clientSecret,
        code_verifier: pkce.verifier,
      }),
    });

    const body = await parseBody(response);

    if (response.ok) {
      const parsed = TokenResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new OAuthError(
          "invalid_response",
          `Token response did not match RFC 6749: ${parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")}`,
        );
      }
      return parsed.data;
    }

    const error = body as OAuthErrorBody;
    switch (error.error) {
      case "authorization_pending":
        continue;
      case "slow_down":
        // §3.5: the client MUST increase its interval by 5 seconds.
        intervalSeconds += 5;
        continue;
      case "access_denied":
        throw new OAuthError("access_denied", "Sign-in was declined in the browser.", false, error.error_description);
      case "expired_token":
        throw new OAuthError("expired_token", "The device code expired before approval. Start sign-in again.", false, error.error_description);
      default:
        throw new OAuthError(
          error.error ?? `http_${response.status}`,
          error.error_description ?? `Token exchange failed (HTTP ${response.status}).`,
          false,
          error.error_description,
        );
    }
  }
}

/** RFC 6749 §6 — exchange a refresh token for a new access token. */
export async function refreshAccessToken(
  provider: ProviderProfile,
  endpoints: ResolvedEndpoints,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
  const clientId = requireClientId(provider);

  const response = await fetchImpl(endpoints.tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: toFormBody({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: provider.clientSecret,
      scope: provider.scopes.length ? provider.scopes.join(" ") : undefined,
    }),
  });

  const body = await parseBody(response);

  if (!response.ok) {
    const error = body as OAuthErrorBody;
    // invalid_grant means the refresh token is dead — the author must sign in again.
    const terminal = error.error === "invalid_grant";
    throw new OAuthError(
      error.error ?? `http_${response.status}`,
      terminal
        ? "The stored session is no longer valid. Run 'novelgraph auth login' again."
        : error.error_description ?? `Token refresh failed (HTTP ${response.status}).`,
      !terminal,
      error.error_description,
    );
  }

  const parsed = TokenResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new OAuthError("invalid_response", "Refresh response did not match RFC 6749.");
  }
  return parsed.data;
}

/** RFC 7009 — best-effort server-side revocation. Local tokens are cleared regardless. */
export async function revokeToken(
  provider: ProviderProfile,
  endpoints: ResolvedEndpoints,
  token: string,
  tokenTypeHint: "access_token" | "refresh_token",
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!endpoints.revocationEndpoint) return false;
  try {
    const response = await fetchImpl(endpoints.revocationEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: toFormBody({
        token,
        token_type_hint: tokenTypeHint,
        client_id: requireClientId(provider),
        client_secret: provider.clientSecret,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
