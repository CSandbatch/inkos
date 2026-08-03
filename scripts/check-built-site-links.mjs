import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, normalize, relative, resolve } from "node:path";

const root = resolve("packages/site/dist");
const base = "/novelgraph";

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(path));
    else result.push(path);
  }
  return result;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function localTarget(raw) {
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("data:") || /^https?:\/\//.test(raw)) return null;
  const withoutFragment = raw.split("#", 1)[0].split("?", 1)[0];
  if (!withoutFragment) return null;
  const path = withoutFragment.startsWith(base) ? withoutFragment.slice(base.length) : withoutFragment;
  return decodeURIComponent(path || "/");
}

const htmlFiles = (await filesUnder(root)).filter((path) => extname(path) === ".html");
const failures = [];

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
    const target = localTarget(match[1]);
    if (target === null) continue;
    const relativeTarget = target.replace(/^\/+/, "");
    const candidate = normalize(join(root, relativeTarget));
    if (!candidate.startsWith(root)) {
      failures.push(`${relative(root, htmlFile)} -> ${match[1]} escapes the built site`);
      continue;
    }
    const resolved = extname(candidate) ? candidate : join(candidate, "index.html");
    if (!await exists(resolved)) failures.push(`${relative(root, htmlFile)} -> ${match[1]} (${relative(root, resolved)} missing)`);
  }
}

if (failures.length) {
  process.stderr.write(`Broken internal site links (${failures.length}):\n${failures.map((line) => `- ${line}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Verified internal links and assets across ${htmlFiles.length} built HTML files.\n`);
