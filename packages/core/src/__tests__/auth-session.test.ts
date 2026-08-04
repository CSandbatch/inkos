import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";

/**
 * End-to-end device-flow test against a real HTTP server.
 *
 * Uses the file backend so the test never touches the developer's OS keychain,
 * and an isolated HOME so it never touches their real ~/.novelgraph.
 */

let home: string;
let server: Server;
let origin: string;

// State the fake provider mutates between requests.
let pendingPolls = 0;
let approved = true;
let issuedRefreshToken: string | undefined = "rt-1";
let accessTokenCounter = 0;

beforeAll(async () => {
  home = await mkdtemp(join(tmpdir(), "ng-auth-"));
  // Explicit override rather than patching HOME: the config path is resolved
  // per call, so this reliably isolates the test from the real home directory.
  process.env.NOVELGRAPH_CONFIG_DIR = home;
  process.env.NOVELGRAPH_SECRET_BACKEND = "file";

  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
      const send = (status: number, payload: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      };

      if (req.url === "/.well-known/openid-configuration") {
        return send(200, {
          device_authorization_endpoint: `${origin}/device`,
          token_endpoint: `${origin}/token`,
          revocation_endpoint: `${origin}/revoke`,
        });
      }
      if (req.url === "/device") {
        if (!body.get("code_challenge")) return send(400, { error: "invalid_request", error_description: "PKCE required" });
        return send(200, {
          device_code: "dev-code-1", user_code: "TEST-CODE",
          verification_uri: `${origin}/activate`, expires_in: 600, interval: 1,
        });
      }
      if (req.url === "/token") {
        const grant = body.get("grant_type");
        if (grant === "refresh_token") {
          if (body.get("refresh_token") !== issuedRefreshToken) return send(400, { error: "invalid_grant" });
          accessTokenCounter += 1;
          // Deliberately omit refresh_token: RFC 6749 §6 permits it, and the
          // previous one must remain in force.
          return send(200, { access_token: `at-refreshed-${accessTokenCounter}`, expires_in: 3600 });
        }
        if (!body.get("code_verifier")) return send(400, { error: "invalid_grant", error_description: "verifier required" });
        if (!approved) return send(400, { error: "access_denied" });
        if (pendingPolls > 0) { pendingPolls -= 1; return send(400, { error: "authorization_pending" }); }
        return send(200, {
          access_token: "at-initial", token_type: "Bearer", expires_in: 3600,
          refresh_token: issuedRefreshToken, scope: "openid offline_access",
        });
      }
      if (req.url === "/revoke") return send(200, {});
      return send(404, { error: "not_found" });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(home, { recursive: true, force: true });
});

beforeEach(() => {
  pendingPolls = 0;
  approved = true;
  issuedRefreshToken = "rt-1";
  accessTokenCounter = 0;
});

/**
 * Imported lazily so the modules read the patched HOME. The auth config path is
 * computed at module load, so a top-level import would bind the real home.
 */
async function loadAuth() {
  const providers = await import("../auth/providers.js");
  const session = await import("../auth/session.js");
  const secretStore = await import("../auth/secret-store.js");
  secretStore.resetSecretStoreCache();
  providers.clearDiscoveryCache();
  // The file backend persists across tests in this shared temp home, so clear
  // any credential a previous test left behind.
  for (const id of await providers.listProviderIds()) await session.deleteCredential(id);
  await providers.saveProviderConfig("testprov", {
    displayName: "Test Provider",
    clientId: "client-1",
    issuer: origin,
    scopes: ["openid", "offline_access"],
  });
  return { ...providers, ...session };
}

describe("device flow, end to end", () => {
  it("discovers endpoints, completes sign-in, and stores a usable credential", async () => {
    const auth = await loadAuth();
    pendingPolls = 2;

    const handle = await auth.beginLogin("testprov", fetch, { sleep: async () => undefined });

    // The user code is available before the exchange completes, which is what
    // lets the CLI and Studio show it immediately.
    expect(handle.authorization.user_code).toBe("TEST-CODE");

    const credential = await handle.completed;
    expect(credential.accessToken).toBe("at-initial");
    expect(credential.refreshToken).toBe("rt-1");
    expect(credential.scopes).toEqual(["openid", "offline_access"]);
    expect(credential.backend).toBe("file-plaintext");

    expect(await auth.getAccessToken("testprov", fetch)).toBe("at-initial");

    const status = await auth.statusFor("testprov");
    expect(status.state).toBe("authenticated");
  });

  it("refreshes an expired access token and keeps the old refresh token", async () => {
    const auth = await loadAuth();
    const handle = await auth.beginLogin("testprov", fetch, { sleep: async () => undefined });
    const credential = await handle.completed;

    // Force expiry.
    await auth.writeCredential({ ...credential, expiresAt: Date.now() - 1_000 });
    expect((await auth.statusFor("testprov")).state).toBe("refreshable");

    const token = await auth.getAccessToken("testprov", fetch);
    expect(token).toBe("at-refreshed-1");

    // The provider omitted refresh_token on refresh; it must survive.
    const stored = await auth.readCredential("testprov");
    expect(stored?.refreshToken).toBe("rt-1");
    expect(stored?.accessToken).toBe("at-refreshed-1");
  });

  it("reports expired without a refresh token and refuses to invent one", async () => {
    const auth = await loadAuth();
    issuedRefreshToken = undefined;
    const handle = await auth.beginLogin("testprov", fetch, { sleep: async () => undefined });
    const credential = await handle.completed;
    await auth.writeCredential({ ...credential, expiresAt: Date.now() - 1_000 });

    expect((await auth.statusFor("testprov")).state).toBe("expired");
    await expect(auth.getAccessToken("testprov", fetch)).rejects.toMatchObject({ code: "expired_token" });
  });

  it("propagates a declined sign-in", async () => {
    const auth = await loadAuth();
    approved = false;
    const handle = await auth.beginLogin("testprov", fetch, { sleep: async () => undefined });
    await expect(handle.completed).rejects.toMatchObject({ code: "access_denied" });
    expect((await auth.statusFor("testprov")).state).toBe("not-configured");
  });

  it("logout revokes and clears, and is idempotent", async () => {
    const auth = await loadAuth();
    const handle = await auth.beginLogin("testprov", fetch, { sleep: async () => undefined });
    await handle.completed;

    const first = await auth.logout("testprov", fetch);
    expect(first).toEqual({ revoked: true, cleared: true });
    expect(await auth.readCredential("testprov")).toBeUndefined();

    const second = await auth.logout("testprov", fetch);
    expect(second).toEqual({ revoked: false, cleared: false });
  });

  it("refuses to sign in a provider with no client ID", async () => {
    const auth = await loadAuth();
    await auth.saveProviderConfig("noclient", { displayName: "No Client", issuer: origin });
    await expect(auth.beginLogin("noclient", fetch)).rejects.toMatchObject({ providerId: "noclient" });
    expect((await auth.statusFor("noclient")).state).toBe("no-client-id");
  });

  it("never writes a token into the provider config file", async () => {
    const auth = await loadAuth();
    const handle = await auth.beginLogin("testprov", fetch, { sleep: async () => undefined });
    await handle.completed;

    const { readFile } = await import("node:fs/promises");
    const config = await readFile(auth.authConfigPath(), "utf8");
    expect(config).not.toContain("at-initial");
    expect(config).not.toContain("rt-1");
  });
});
