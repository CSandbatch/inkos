import { describe, expect, it, beforeEach } from "vitest";
import {
  createPkcePair,
  requestDeviceAuthorization,
  pollForToken,
  refreshAccessToken,
} from "../auth/device-flow.js";
import { resolveEndpoints, clearDiscoveryCache } from "../auth/providers.js";
import { ProviderProfileSchema, OAuthError, MissingClientIdError, providerReadiness } from "../auth/types.js";
import { createHash } from "node:crypto";

const endpoints = {
  deviceAuthorizationEndpoint: "https://auth.example.test/device",
  tokenEndpoint: "https://auth.example.test/token",
  revocationEndpoint: "https://auth.example.test/revoke",
};

const provider = ProviderProfileSchema.parse({
  id: "test",
  displayName: "Test Provider",
  clientId: "client-abc",
  scopes: ["openid", "offline_access"],
  deviceAuthorizationEndpoint: endpoints.deviceAuthorizationEndpoint,
  tokenEndpoint: endpoints.tokenEndpoint,
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Scripted fetch: returns queued responses in order and records requests. */
function scriptedFetch(queue: Response[]) {
  const calls: Array<{ url: string; body: URLSearchParams }> = [];
  const impl = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    });
    const next = queue.shift();
    if (!next) throw new Error("scriptedFetch: no queued response");
    return next;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const noSleep = async () => undefined;

describe("PKCE", () => {
  it("produces an S256 challenge that verifies against the verifier", () => {
    const pair = createPkcePair();
    expect(pair.method).toBe("S256");
    // RFC 7636 §4.1: verifier is 43-128 chars from the unreserved set.
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.verifier).toMatch(/^[A-Za-z0-9\-._~]+$/u);
    expect(createHash("sha256").update(pair.verifier).digest("base64url")).toBe(pair.challenge);
  });

  it("is unique per invocation", () => {
    expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier);
  });
});

describe("device authorization request", () => {
  it("sends the PKCE challenge and scopes as form fields", async () => {
    const pkce = createPkcePair();
    const { impl, calls } = scriptedFetch([jsonResponse({
      device_code: "dev-1", user_code: "WXYZ-1234",
      verification_uri: "https://example.test/activate", expires_in: 900, interval: 5,
    })]);

    const authorization = await requestDeviceAuthorization(provider, endpoints, pkce, impl);

    expect(authorization.user_code).toBe("WXYZ-1234");
    expect(calls[0]!.url).toBe(endpoints.deviceAuthorizationEndpoint);
    expect(calls[0]!.body.get("client_id")).toBe("client-abc");
    expect(calls[0]!.body.get("code_challenge")).toBe(pkce.challenge);
    expect(calls[0]!.body.get("code_challenge_method")).toBe("S256");
    expect(calls[0]!.body.get("scope")).toBe("openid offline_access");
  });

  it("defaults the poll interval to 5 seconds when the provider omits it", async () => {
    const { impl } = scriptedFetch([jsonResponse({
      device_code: "dev-1", user_code: "AAAA", verification_uri: "https://example.test/a", expires_in: 600,
    })]);
    const authorization = await requestDeviceAuthorization(provider, endpoints, createPkcePair(), impl);
    expect(authorization.interval).toBe(5);
  });

  it("refuses to start without a client ID", async () => {
    const anonymous = ProviderProfileSchema.parse({ ...provider, clientId: undefined });
    const { impl } = scriptedFetch([]);
    await expect(requestDeviceAuthorization(anonymous, endpoints, createPkcePair(), impl))
      .rejects.toBeInstanceOf(MissingClientIdError);
  });

  it("surfaces a provider error body rather than a bare status", async () => {
    const { impl } = scriptedFetch([jsonResponse(
      { error: "invalid_client", error_description: "Unknown client" }, 401,
    )]);
    await expect(requestDeviceAuthorization(provider, endpoints, createPkcePair(), impl))
      .rejects.toMatchObject({ code: "invalid_client" });
  });

  it("reports non-JSON responses without leaking the whole page", async () => {
    const { impl } = scriptedFetch([new Response("<html>gateway error</html>", { status: 502 })]);
    await expect(requestDeviceAuthorization(provider, endpoints, createPkcePair(), impl))
      .rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("token polling — RFC 8628 §3.5", () => {
  const authorization = { device_code: "dev-1", user_code: "AAAA", verification_uri: "https://x.test", expires_in: 900, interval: 1 };

  it("keeps polling through authorization_pending and returns the token", async () => {
    const { impl, calls } = scriptedFetch([
      jsonResponse({ error: "authorization_pending" }, 400),
      jsonResponse({ error: "authorization_pending" }, 400),
      jsonResponse({ access_token: "at-1", token_type: "Bearer", expires_in: 3600, refresh_token: "rt-1" }),
    ]);
    const pkce = createPkcePair();

    const token = await pollForToken(provider, endpoints, authorization, pkce, impl, { sleep: noSleep });

    expect(token.access_token).toBe("at-1");
    expect(calls).toHaveLength(3);
    // The verifier must accompany every exchange, binding it to this process.
    expect(calls[2]!.body.get("code_verifier")).toBe(pkce.verifier);
    expect(calls[2]!.body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:device_code");
  });

  it("increases the interval by 5 seconds on slow_down", async () => {
    const waits: number[] = [];
    const { impl } = scriptedFetch([
      jsonResponse({ error: "slow_down" }, 400),
      jsonResponse({ error: "authorization_pending" }, 400),
      jsonResponse({ access_token: "at-1" }),
    ]);

    await pollForToken(provider, endpoints, authorization, createPkcePair(), impl, {
      sleep: async (ms) => { waits.push(ms); },
    });

    // Starts at the advertised 1s; after slow_down it must be 6s.
    expect(waits).toEqual([1000, 6000, 6000]);
  });

  it("treats access_denied as terminal", async () => {
    const { impl } = scriptedFetch([jsonResponse({ error: "access_denied" }, 400)]);
    await expect(pollForToken(provider, endpoints, authorization, createPkcePair(), impl, { sleep: noSleep }))
      .rejects.toMatchObject({ code: "access_denied", retryable: false });
  });

  it("treats expired_token as terminal", async () => {
    const { impl } = scriptedFetch([jsonResponse({ error: "expired_token" }, 400)]);
    await expect(pollForToken(provider, endpoints, authorization, createPkcePair(), impl, { sleep: noSleep }))
      .rejects.toMatchObject({ code: "expired_token" });
  });

  it("stops at the local deadline even if the provider never says expired", async () => {
    let clock = 0;
    const { impl } = scriptedFetch([]);
    await expect(pollForToken(
      provider, endpoints, { ...authorization, expires_in: 10 }, createPkcePair(), impl,
      { sleep: noSleep, now: () => (clock += 20_000) },
    )).rejects.toMatchObject({ code: "expired_token" });
  });

  it("honours an abort signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const { impl } = scriptedFetch([]);
    await expect(pollForToken(provider, endpoints, authorization, createPkcePair(), impl, {
      sleep: noSleep, signal: controller.signal,
    })).rejects.toMatchObject({ code: "cancelled" });
  });
});

describe("refresh", () => {
  it("exchanges a refresh token", async () => {
    const { impl, calls } = scriptedFetch([jsonResponse({ access_token: "at-2", expires_in: 3600 })]);
    const token = await refreshAccessToken(provider, endpoints, "rt-1", impl);
    expect(token.access_token).toBe("at-2");
    expect(calls[0]!.body.get("grant_type")).toBe("refresh_token");
    expect(calls[0]!.body.get("refresh_token")).toBe("rt-1");
  });

  it("marks invalid_grant as non-retryable and tells the author to sign in again", async () => {
    const { impl } = scriptedFetch([jsonResponse({ error: "invalid_grant" }, 400)]);
    await expect(refreshAccessToken(provider, endpoints, "dead", impl))
      .rejects.toMatchObject({ code: "invalid_grant", retryable: false });
  });

  it("marks transient server failures as retryable", async () => {
    const { impl } = scriptedFetch([jsonResponse({ error: "temporarily_unavailable" }, 503)]);
    await expect(refreshAccessToken(provider, endpoints, "rt-1", impl))
      .rejects.toMatchObject({ retryable: true });
  });
});

describe("endpoint resolution", () => {
  beforeEach(() => clearDiscoveryCache());

  it("prefers explicit endpoints over discovery", async () => {
    const { impl, calls } = scriptedFetch([]);
    const resolved = await resolveEndpoints(provider, impl);
    expect(resolved.tokenEndpoint).toBe(endpoints.tokenEndpoint);
    expect(calls).toHaveLength(0);
  });

  it("discovers endpoints from an OIDC issuer", async () => {
    const discoverable = ProviderProfileSchema.parse({
      id: "disc", displayName: "Discoverable", clientId: "c", issuer: "https://issuer.example.test",
    });
    const { impl, calls } = scriptedFetch([jsonResponse({
      device_authorization_endpoint: "https://issuer.example.test/device",
      token_endpoint: "https://issuer.example.test/token",
    })]);

    const resolved = await resolveEndpoints(discoverable, impl);

    expect(calls[0]!.url).toBe("https://issuer.example.test/.well-known/openid-configuration");
    expect(resolved.deviceAuthorizationEndpoint).toBe("https://issuer.example.test/device");
  });

  it("explains when an issuer does not support the device flow", async () => {
    const discoverable = ProviderProfileSchema.parse({
      id: "nodevice", displayName: "No Device", clientId: "c", issuer: "https://issuer2.example.test",
    });
    const { impl } = scriptedFetch([jsonResponse({ token_endpoint: "https://issuer2.example.test/token" })]);
    await expect(resolveEndpoints(discoverable, impl)).rejects.toThrow(/does not advertise a device authorization endpoint/u);
  });

  it("reports unreadiness rather than throwing, so listing providers is safe", () => {
    // A built-in scaffold with nothing configured must parse cleanly — otherwise
    // `auth status` cannot even enumerate what is available to set up.
    const bare = ProviderProfileSchema.parse({ id: "bare", displayName: "Bare" });
    expect(providerReadiness(bare).ready).toBe(false);
    expect(providerReadiness(bare).reason).toMatch(/does not ship one/u);

    const noEndpoints = ProviderProfileSchema.parse({ id: "bad", displayName: "Bad", clientId: "c" });
    expect(providerReadiness(noEndpoints).ready).toBe(false);
    expect(providerReadiness(noEndpoints).reason).toMatch(/issuer or endpoints/u);

    expect(providerReadiness(provider).ready).toBe(true);
  });

  it("still refuses to resolve endpoints when neither is configured", async () => {
    const noEndpoints = ProviderProfileSchema.parse({ id: "bad", displayName: "Bad", clientId: "c" });
    const { impl } = scriptedFetch([]);
    await expect(resolveEndpoints(noEndpoints, impl)).rejects.toThrow(/neither explicit endpoints nor an issuer/u);
  });
});

describe("OAuthError", () => {
  it("carries a machine-readable code and a retryability flag", () => {
    const error = new OAuthError("slow_down", "slow down", true);
    expect(error.code).toBe("slow_down");
    expect(error.retryable).toBe(true);
    expect(error).toBeInstanceOf(Error);
  });
});
