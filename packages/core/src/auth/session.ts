import { loadProvider, resolveEndpoints, listProviderIds, requireClientId } from "./providers.js";
import { getSecretStore, describeBackend, backendIsProtected } from "./secret-store.js";
import {
  createPkcePair,
  requestDeviceAuthorization,
  pollForToken,
  refreshAccessToken,
  revokeToken,
  type PollOptions,
} from "./device-flow.js";
import {
  StoredCredentialSchema,
  MissingClientIdError,
  OAuthError,
  providerReadiness,
  type AuthStatus,
  type DeviceAuthorization,
  type ProviderProfile,
  type StoredCredential,
  type TokenResponse,
} from "./types.js";

/** Refresh this far ahead of expiry so a call never races the boundary. */
const REFRESH_SKEW_MS = 60_000;

function accountKey(providerId: string): string {
  return `oauth:${providerId}`;
}

function toStoredCredential(
  providerId: string,
  token: TokenResponse,
  backend: string,
  previousRefreshToken?: string,
): StoredCredential {
  const obtainedAt = Date.now();
  return StoredCredentialSchema.parse({
    providerId,
    accessToken: token.access_token,
    // RFC 6749 §6: a refresh response MAY omit the refresh token, in which case
    // the previous one stays valid. Dropping it here would silently log the
    // author out at the next expiry.
    refreshToken: token.refresh_token ?? previousRefreshToken,
    tokenType: token.token_type || "Bearer",
    expiresAt: token.expires_in ? obtainedAt + token.expires_in * 1000 : undefined,
    scopes: token.scope ? token.scope.split(/\s+/u).filter(Boolean) : [],
    obtainedAt,
    backend,
  });
}

export async function readCredential(providerId: string): Promise<StoredCredential | undefined> {
  const store = await getSecretStore();
  const raw = await store.get(accountKey(providerId));
  if (!raw) return undefined;
  const parsed = StoredCredentialSchema.safeParse(JSON.parse(raw) as unknown);
  return parsed.success ? parsed.data : undefined;
}

export async function writeCredential(credential: StoredCredential): Promise<void> {
  const store = await getSecretStore();
  await store.set(accountKey(credential.providerId), JSON.stringify(credential));
}

export async function deleteCredential(providerId: string): Promise<void> {
  const store = await getSecretStore();
  await store.delete(accountKey(providerId));
}

export function isExpired(credential: StoredCredential, skewMs = REFRESH_SKEW_MS): boolean {
  if (!credential.expiresAt) return false;
  return Date.now() + skewMs >= credential.expiresAt;
}

export interface LoginHandle {
  readonly authorization: DeviceAuthorization;
  /** Resolves when the author approves, rejects on denial/expiry/cancel. */
  readonly completed: Promise<StoredCredential>;
}

/**
 * Begin a device-flow sign-in.
 *
 * Returns as soon as the user code is available so the caller can display it,
 * then completes in the background. This shape lets both the CLI and the Studio
 * show the code immediately rather than blocking on the whole exchange.
 */
export async function beginLogin(
  providerId: string,
  fetchImpl: typeof fetch = fetch,
  pollOptions: PollOptions = {},
): Promise<LoginHandle> {
  const provider = await loadProvider(providerId);

  // Check the client ID before resolving endpoints. A missing client ID is the
  // most common misconfiguration and has the most actionable message; resolving
  // endpoints first would surface a confusing "no issuer" error instead, and
  // would make a network call for a request that cannot succeed.
  requireClientId(provider);

  const endpoints = await resolveEndpoints(provider, fetchImpl);
  const pkce = createPkcePair();

  const authorization = await requestDeviceAuthorization(provider, endpoints, pkce, fetchImpl);
  const store = await getSecretStore();

  const completed = (async () => {
    const token = await pollForToken(provider, endpoints, authorization, pkce, fetchImpl, pollOptions);
    const credential = toStoredCredential(providerId, token, store.backend);
    await writeCredential(credential);
    return credential;
  })();

  return { authorization, completed };
}

/**
 * Return a usable access token, refreshing if it is expired or close to it.
 * Throws if the provider was never authenticated or the session is dead.
 */
export async function getAccessToken(
  providerId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const credential = await readCredential(providerId);
  if (!credential) {
    throw new OAuthError(
      "not_authenticated",
      `Not signed in to "${providerId}". Run 'novelgraph auth login --provider ${providerId}'.`,
    );
  }

  if (!isExpired(credential)) return credential.accessToken;

  if (!credential.refreshToken) {
    throw new OAuthError(
      "expired_token",
      `The "${providerId}" session expired and no refresh token was issued. Run 'novelgraph auth login --provider ${providerId}'.`,
    );
  }

  const provider = await loadProvider(providerId);
  const endpoints = await resolveEndpoints(provider, fetchImpl);
  const store = await getSecretStore();
  const token = await refreshAccessToken(provider, endpoints, credential.refreshToken, fetchImpl);
  const refreshed = toStoredCredential(providerId, token, store.backend, credential.refreshToken);
  await writeCredential(refreshed);
  return refreshed.accessToken;
}

/** Sign out: revoke server-side where supported, then always clear locally. */
export async function logout(
  providerId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ revoked: boolean; cleared: boolean }> {
  const credential = await readCredential(providerId);
  if (!credential) return { revoked: false, cleared: false };

  let revoked = false;
  try {
    const provider = await loadProvider(providerId);
    const endpoints = await resolveEndpoints(provider, fetchImpl);
    revoked = await revokeToken(
      provider,
      endpoints,
      credential.refreshToken ?? credential.accessToken,
      credential.refreshToken ? "refresh_token" : "access_token",
      fetchImpl,
    );
  } catch {
    // Revocation is best-effort. Local removal below is what matters.
  }

  await deleteCredential(providerId);
  return { revoked, cleared: true };
}

export async function statusFor(providerId: string): Promise<AuthStatus> {
  let provider: ProviderProfile;
  try {
    provider = await loadProvider(providerId);
  } catch (error) {
    return {
      providerId,
      displayName: providerId,
      state: "not-configured",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const credential = await readCredential(providerId);

  if (!credential) {
    const readiness = providerReadiness(provider);
    return {
      providerId,
      displayName: provider.displayName,
      state: readiness.ready ? "not-configured" : "no-client-id",
      detail: readiness.reason ?? "Configured and ready. Not signed in yet.",
    };
  }

  const base = {
    providerId,
    displayName: provider.displayName,
    backend: credential.backend,
    expiresAt: credential.expiresAt,
    scopes: credential.scopes,
  };

  if (!isExpired(credential)) {
    const remaining = credential.expiresAt
      ? `expires in ${Math.max(0, Math.round((credential.expiresAt - Date.now()) / 60_000))} min`
      : "no expiry reported";
    return { ...base, state: "authenticated", detail: `Signed in — ${remaining}.` };
  }

  return credential.refreshToken
    ? { ...base, state: "refreshable", detail: "Access token expired; will refresh on next use." }
    : { ...base, state: "expired", detail: "Session expired. Sign in again." };
}

export async function statusAll(): Promise<AuthStatus[]> {
  const ids = await listProviderIds();
  return Promise.all(ids.map(statusFor));
}

export async function describeStorage(): Promise<{ backend: string; description: string; protected: boolean }> {
  const store = await getSecretStore();
  return {
    backend: store.backend,
    description: describeBackend(store.backend),
    protected: backendIsProtected(store.backend),
  };
}

export { MissingClientIdError, OAuthError };
