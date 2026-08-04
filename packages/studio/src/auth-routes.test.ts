import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeStudioApp, createStudioApp } from "./server.js";

/**
 * The Studio authentication routes exist to keep credentials away from the
 * browser. These tests assert that boundary rather than the happy path: a
 * Studio tab must never be able to read a device code, an access token, or a
 * refresh token.
 */

const directories: string[] = [];
const apps: ReturnType<typeof createStudioApp>[] = [];

beforeEach(() => {
  // Isolate from the real credential store and user configuration. The auth
  // module resolves its config directory per call, so this override takes
  // effect even though the module was imported earlier.
  process.env.NOVELGRAPH_SECRET_BACKEND = "file";
  const configDir = mkdtempSync(join(tmpdir(), "novelgraph-authcfg-"));
  directories.push(configDir);
  process.env.NOVELGRAPH_CONFIG_DIR = configDir;
});

afterEach(() => {
  while (apps.length) closeStudioApp(apps.pop()!);
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

function newApp() {
  const root = mkdtempSync(join(tmpdir(), "novelgraph-auth-"));
  directories.push(root);
  const app = createStudioApp(root);
  apps.push(app);
  return app;
}

describe("Studio authentication routes", () => {
  it("reports provider state and the credential-storage backend", async () => {
    const app = newApp();
    const response = await app.request("/api/v1/auth/status");
    expect(response.status).toBe(200);

    const body = await response.json() as {
      storage: { backend: string; description: string; protected: boolean };
      providers: Array<{ providerId: string; state: string; detail: string }>;
    };

    expect(body.storage.backend).toBeTruthy();
    expect(typeof body.storage.protected).toBe("boolean");
    // Built-in scaffolds must enumerate even when nothing is configured —
    // otherwise the UI cannot show the user what is available to set up.
    expect(body.providers.map((p) => p.providerId)).toEqual(
      expect.arrayContaining(["chatgpt", "codex"]),
    );
    for (const provider of body.providers) {
      expect(provider.detail).toBeTruthy();
    }
  });

  it("refuses to start a flow for a provider with no client ID", async () => {
    const app = newApp();
    const response = await app.request("/api/v1/auth/chatgpt/login", { method: "POST" });

    // 409 rather than 500: an unconfigured provider is an expected state.
    expect(response.status).toBe(409);
    const body = await response.json() as { error: string; code: string };
    expect(body.code).toBe("no_client_id");
    expect(body.error).toMatch(/does not ship one/u);
  });

  it("records provider configuration without accepting a secret", async () => {
    const app = newApp();
    const configure = await app.request("/api/v1/auth/chatgpt/configure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: "client-under-test",
        issuer: "https://issuer.invalid",
        // Fields outside the allowlist must be ignored rather than persisted.
        accessToken: "should-never-be-stored",
        refreshToken: "should-never-be-stored",
      }),
    });
    expect(configure.status).toBe(200);
    expect(await configure.json()).toMatchObject({ configured: true, providerId: "chatgpt" });

    const status = await (await app.request("/api/v1/auth/status")).text();
    expect(status).not.toContain("should-never-be-stored");
  });

  it("reports no pending flow before one is started", async () => {
    const app = newApp();
    const body = await (await app.request("/api/v1/auth/chatgpt/login")).json() as { state: string };
    expect(body.state).toBe("idle");
  });

  it("logout is safe when nothing is stored", async () => {
    const app = newApp();
    const response = await app.request("/api/v1/auth/chatgpt/logout", { method: "POST" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: false, cleared: false });
  });

  it("never exposes a device code or token field to the browser", async () => {
    const app = newApp();
    await app.request("/api/v1/auth/chatgpt/configure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "c", issuer: "https://issuer.invalid" }),
    });

    // Whatever these routes return, none of them may carry credential material.
    for (const path of ["/api/v1/auth/status", "/api/v1/auth/chatgpt/login"]) {
      const text = await (await app.request(path)).text();
      expect(text).not.toMatch(/device_code|refresh_token|access_token/u);
    }
  });
});
