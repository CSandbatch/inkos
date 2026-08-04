/**
 * Strict parser for the YAML subset used by docs/engineering/capability-registry.yaml.
 *
 * Deliberately narrow. The repository has no YAML dependency, and adding one
 * requires recreating node_modules on this machine, so rather than guess at a
 * general grammar this parser supports exactly what the registry uses and
 * THROWS on anything else. A silent misparse of the capability registry would
 * corrupt generated public copy; a loud failure will not.
 *
 * Supported:
 *   key: value                bare, 'single', "double" scalars
 *   key:                      nested map (by indentation) or block list
 *   - item                    block sequence of scalars
 *   key: [a, b]               flow sequence of scalars
 *   key: >-                   folded block scalar (newlines become spaces)
 *   # comment                 whole-line and trailing (outside quotes)
 *   null / true / false / 123 typed scalars
 *
 * Not supported (throws): anchors, aliases, tags, block literals (|),
 * multi-document streams, nested flow collections, complex keys.
 */

class YamlError extends Error {
  constructor(message, line) {
    super(`${message} (line ${line})`);
    this.name = "YamlError";
    this.line = line;
  }
}

function stripComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "#" && (i === 0 || /\s/u.test(text[i - 1]))) {
      return text.slice(0, i);
    }
  }
  return text;
}

function parseScalar(raw, line) {
  const text = raw.trim();
  if (text === "") return "";
  if (text === "null" || text === "~") return null;
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?\d+$/u.test(text)) return Number.parseInt(text, 10);
  if (/^-?\d+\.\d+$/u.test(text)) return Number.parseFloat(text);
  if ((text.startsWith('"') && text.endsWith('"') && text.length > 1)
    || (text.startsWith("'") && text.endsWith("'") && text.length > 1)) {
    return text.slice(1, -1);
  }
  if (text.startsWith("[")) {
    if (!text.endsWith("]")) throw new YamlError("Unterminated flow sequence", line);
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    if (inner.includes("[") || inner.includes("{")) {
      throw new YamlError("Nested flow collections are not supported", line);
    }
    return inner.split(",").map((part) => parseScalar(part, line));
  }
  if (text.startsWith("{")) throw new YamlError("Flow mappings are not supported", line);
  if (text.startsWith("&") || text.startsWith("*") || text.startsWith("!")) {
    throw new YamlError("Anchors, aliases, and tags are not supported", line);
  }
  return text;
}

/** Rows of { indent, content, line }, comments and blanks removed. */
function tokenize(source) {
  const rows = [];
  const lines = source.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (rawLine.includes("\t")) throw new YamlError("Tabs are not permitted in YAML", index + 1);
    const withoutComment = stripComment(rawLine);
    if (!withoutComment.trim()) continue;
    if (withoutComment.trim() === "---") continue;
    rows.push({
      indent: withoutComment.length - withoutComment.trimStart().length,
      content: withoutComment.trim(),
      line: index + 1,
    });
  }
  return rows;
}

/**
 * Collect a folded block scalar: every following row indented deeper than the
 * owning key, joined with single spaces.
 */
function foldedScalar(rows, start, ownerIndent) {
  const parts = [];
  let index = start;
  while (index < rows.length && rows[index].indent > ownerIndent) {
    parts.push(rows[index].content);
    index += 1;
  }
  return { value: parts.join(" ").trim(), next: index };
}

function parseBlock(rows, start, indent) {
  // A block is either a sequence (rows beginning "- ") or a mapping.
  if (start < rows.length && rows[start].indent === indent && rows[start].content.startsWith("- ")) {
    const items = [];
    let index = start;
    while (index < rows.length && rows[index].indent === indent && rows[index].content.startsWith("- ")) {
      const row = rows[index];
      const body = row.content.slice(2).trim();
      if (body.includes(":") && !body.startsWith('"') && !body.startsWith("'") && !body.startsWith("[")) {
        throw new YamlError("Mappings inside sequences are not supported", row.line);
      }
      items.push(parseScalar(body, row.line));
      index += 1;
    }
    return { value: items, next: index };
  }

  const map = {};
  let index = start;
  while (index < rows.length) {
    const row = rows[index];
    if (row.indent < indent) break;
    if (row.indent > indent) throw new YamlError("Unexpected indentation", row.line);
    if (row.content.startsWith("- ")) break;

    const separator = row.content.indexOf(":");
    if (separator === -1) throw new YamlError(`Expected "key: value", got "${row.content}"`, row.line);
    const key = row.content.slice(0, separator).trim();
    if (!key) throw new YamlError("Empty key", row.line);
    const rest = row.content.slice(separator + 1).trim();
    index += 1;

    if (rest === ">-" || rest === ">") {
      const folded = foldedScalar(rows, index, row.indent);
      map[key] = folded.value;
      index = folded.next;
      continue;
    }
    if (rest === "|" || rest === "|-") {
      throw new YamlError("Block literal scalars (|) are not supported", row.line);
    }
    if (rest !== "") {
      map[key] = parseScalar(rest, row.line);
      continue;
    }
    // Empty value: nested block if the next row is deeper, otherwise null.
    if (index < rows.length && rows[index].indent > row.indent) {
      const nested = parseBlock(rows, index, rows[index].indent);
      map[key] = nested.value;
      index = nested.next;
    } else {
      map[key] = null;
    }
  }
  return { value: map, next: index };
}

export function parseYaml(source) {
  const rows = tokenize(source);
  if (rows.length === 0) return {};
  const result = parseBlock(rows, 0, rows[0].indent);
  if (result.next !== rows.length) {
    throw new YamlError("Trailing content could not be parsed", rows[result.next].line);
  }
  return result.value;
}

export { YamlError };
