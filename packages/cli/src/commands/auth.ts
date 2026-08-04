import { Command } from "commander";
import { spawn } from "node:child_process";
import {
  beginLogin,
  logout as logoutProvider,
  statusAll,
  statusFor,
  getAccessToken,
  describeStorage,
  loadProvider,
  saveProviderConfig,
  listProviderIds,
  readCredential,
  authConfigPath,
  MissingClientIdError,
  OAuthError,
  type AuthStatus,
} from "@actalk/novelgraph-core";
import { log, logError } from "../runtime.js";

function openUrl(url: string): void {
  const [command, args] = process.platform === "win32"
    ? ["cmd", ["/c", "start", "", url]]
    : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } catch {
    // Opening a browser is a convenience; the URL is printed regardless.
  }
}

const STATE_MARK: Record<AuthStatus["state"], string> = {
  "authenticated": "[OK]",
  "refreshable": "[OK]",
  "expired": "[!!]",
  "not-configured": "[--]",
  "no-client-id": "[--]",
};

function reportAuthError(error: unknown): never {
  if (error instanceof MissingClientIdError) {
    logError(error.message);
    process.exit(1);
  }
  if (error instanceof OAuthError) {
    logError(`${error.code}: ${error.message}`);
    if (error.description && error.description !== error.message) log(`  ${error.description}`);
    process.exit(1);
  }
  logError(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

export const authCommand = new Command("auth")
  .description("Sign in to a model provider using the OAuth device flow");

authCommand
  .command("configure")
  .description("Set the OAuth client ID and endpoints for a provider")
  .requiredOption("--provider <id>", "Provider id (e.g. chatgpt, codex)")
  .option("--client-id <id>", "OAuth client ID issued to this application by the provider")
  .option("--client-secret <secret>", "Client secret (confidential clients only; public clients use PKCE)")
  .option("--issuer <url>", "OIDC issuer; endpoints are discovered from it")
  .option("--device-endpoint <url>", "Explicit device authorization endpoint (skips discovery)")
  .option("--token-endpoint <url>", "Explicit token endpoint (skips discovery)")
  .option("--revocation-endpoint <url>", "Explicit revocation endpoint (optional)")
  .option("--scopes <list>", "Space- or comma-separated scopes")
  .option("--api-base-url <url>", "Base URL used for inference after sign-in")
  .option("--model <name>", "Default model")
  .action(async (opts) => {
    try {
      await saveProviderConfig(opts.provider, {
        clientId: opts.clientId,
        clientSecret: opts.clientSecret,
        issuer: opts.issuer,
        deviceAuthorizationEndpoint: opts.deviceEndpoint,
        tokenEndpoint: opts.tokenEndpoint,
        revocationEndpoint: opts.revocationEndpoint,
        scopes: opts.scopes ? String(opts.scopes).split(/[\s,]+/u).filter(Boolean) : undefined,
        apiBaseUrl: opts.apiBaseUrl,
        defaultModel: opts.model,
      });
      log(`Saved provider configuration for "${opts.provider}" to ${authConfigPath()}`);

      const provider = await loadProvider(opts.provider);
      if (!provider.clientId) {
        log("");
        log("No client ID is set yet. NovelGraph does not ship one — register a device-flow");
        log("client with the provider, then run:");
        log(`  novelgraph auth configure --provider ${opts.provider} --client-id <id> --issuer <url>`);
      } else {
        log(`Ready. Run: novelgraph auth login --provider ${opts.provider}`);
      }
    } catch (error) {
      reportAuthError(error);
    }
  });

authCommand
  .command("login")
  .description("Sign in with the OAuth 2.0 device flow (RFC 8628)")
  .option("--provider <id>", "Provider id", "chatgpt")
  .option("--no-open", "Do not open a browser automatically")
  .action(async (opts) => {
    try {
      const provider = await loadProvider(opts.provider);
      const storage = await describeStorage();

      log(`Signing in to ${provider.displayName}…`);
      const handle = await beginLogin(opts.provider, fetch, {
        onPoll: (elapsed) => {
          if (elapsed > 0 && elapsed % 15 === 0) log(`  still waiting… (${elapsed}s)`);
        },
      });

      const { authorization } = handle;
      const target = authorization.verification_uri_complete ?? authorization.verification_uri;

      log("");
      log(`  1. Open  ${authorization.verification_uri}`);
      log(`  2. Enter code  ${authorization.user_code}`);
      log("");
      log(`  Code expires in ${Math.round(authorization.expires_in / 60)} minutes.`);

      if (opts.open !== false) {
        openUrl(target);
        log("  A browser window should have opened.");
      }
      log("");

      const credential = await handle.completed;

      log(`Signed in to ${provider.displayName}.`);
      log(`  Tokens stored via: ${storage.description}`);
      if (!storage.protected) {
        log("");
        log("  WARNING: no OS credential store was available, so tokens are held in a");
        log("  plain file readable by your user account. Install libsecret (Linux) or");
        log("  run on a platform with a keychain to protect them at rest.");
      }
      if (credential.expiresAt) {
        log(`  Access token expires ${new Date(credential.expiresAt).toISOString()}`);
      }
      if (!credential.refreshToken) {
        log("  No refresh token was issued; you will need to sign in again when it expires.");
      }
    } catch (error) {
      reportAuthError(error);
    }
  });

authCommand
  .command("status")
  .description("Show sign-in state for every configured provider")
  .option("--json", "Output JSON")
  .option("--provider <id>", "Limit to one provider")
  .action(async (opts) => {
    try {
      const statuses = opts.provider ? [await statusFor(opts.provider)] : await statusAll();
      const storage = await describeStorage();

      if (opts.json) {
        log(JSON.stringify({ storage, providers: statuses }, null, 2));
        return;
      }

      log("");
      log("NovelGraph Authentication");
      log("");
      const width = Math.max(...statuses.map((s) => s.providerId.length), 8);
      for (const status of statuses) {
        log(`  ${STATE_MARK[status.state]} ${status.providerId.padEnd(width)}  ${status.detail}`);
        if (status.scopes?.length) log(`       ${" ".repeat(width)}  scopes: ${status.scopes.join(" ")}`);
      }
      log("");
      log(`  Credential storage: ${storage.description}`);
      if (!storage.protected) log("  WARNING: tokens are not protected at rest on this machine.");
      log("");
    } catch (error) {
      reportAuthError(error);
    }
  });

authCommand
  .command("logout")
  .description("Revoke where supported and delete stored tokens")
  .option("--provider <id>", "Provider id")
  .option("--all", "Sign out of every provider")
  .action(async (opts) => {
    try {
      const ids = opts.all ? await listProviderIds() : [opts.provider ?? "chatgpt"];
      let any = false;
      for (const id of ids) {
        const result = await logoutProvider(id);
        if (result.cleared) {
          any = true;
          log(`Signed out of "${id}"${result.revoked ? " (token revoked with the provider)" : " (local tokens cleared)"}.`);
        }
      }
      if (!any) log("No stored credentials to remove.");
    } catch (error) {
      reportAuthError(error);
    }
  });

authCommand
  .command("token")
  .description("Print a valid access token, refreshing it if required")
  .option("--provider <id>", "Provider id", "chatgpt")
  .action(async (opts) => {
    try {
      // Refuse to print a secret into a terminal the author is watching or
      // sharing; scripts should pipe it.
      if (process.stdout.isTTY) {
        logError(
          "Refusing to print an access token to a terminal. Pipe it instead:\n" +
          `  novelgraph auth token --provider ${opts.provider} | your-tool`,
        );
        process.exit(1);
      }
      const credential = await readCredential(opts.provider);
      if (!credential) {
        logError(`Not signed in to "${opts.provider}". Run 'novelgraph auth login --provider ${opts.provider}'.`);
        process.exit(1);
      }
      process.stdout.write(await getAccessToken(opts.provider));
    } catch (error) {
      reportAuthError(error);
    }
  });
