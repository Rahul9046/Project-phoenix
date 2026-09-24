/**
 * The locale files, read as data, without a compiler.
 *
 * Shared by `check-locales.mjs`, which compares the six against each other,
 * and by `scripts/locale-probe.mjs`, which compares them against what the
 * website actually renders. Both need the same thing -- every dotted key and
 * its value -- and neither can afford a build step to get it.
 *
 * A hand-rolled reader rather than a parser: these files are a single object
 * literal of nested objects and string values, written by us, in a shape this
 * package controls. Strings can span lines and can be concatenated with `+`,
 * both of which happen in `en.ts`, so both are handled.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const localesDir = join(here, "..", "src", "locales");

/** Every locale file, `en.ts` included. */
export function localeFiles() {
  return readdirSync(localesDir).filter((name) => name.endsWith(".ts"));
}

/** Every dotted key and its value, pulled out of a locale file. */
export function readLocale(file) {
  const source = readFileSync(join(localesDir, file), "utf8");

  // Comments first: they contain braces, quotes and apostrophes, and every one
  // of those would otherwise be read as structure.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  const entries = new Map();
  const path = [];
  let index = 0;

  while (index < code.length) {
    const char = code[index];

    if (char === "}") {
      path.pop();
      index += 1;
      continue;
    }

    // `key: {` opens a group; `key: "..."` is a leaf.
    const opener = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{/.exec(code.slice(index));
    if (opener) {
      path.push(opener[1]);
      index += opener[0].length;
      continue;
    }

    const leaf = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*/.exec(code.slice(index));
    if (leaf) {
      const after = index + leaf[0].length;
      const quote = code[after];

      if (quote === '"' || quote === "'" || quote === "`") {
        const { value, end } = readStringChain(code, after);
        entries.set([...path, leaf[1]].join("."), value);
        index = end;
        continue;
      }
    }

    index += 1;
  }

  return entries;
}

/** One string literal, plus any `+ "..."` continuations. */
function readStringChain(code, start) {
  let value = "";
  let index = start;

  for (;;) {
    const quote = code[index];
    if (quote !== '"' && quote !== "'" && quote !== "`") break;

    index += 1;
    let piece = "";

    while (index < code.length && code[index] !== quote) {
      if (code[index] === "\\") {
        piece += code[index + 1] ?? "";
        index += 2;
        continue;
      }
      piece += code[index];
      index += 1;
    }

    value += piece;
    index += 1;

    const joiner = /^\s*\+\s*/.exec(code.slice(index));
    if (!joiner) break;
    index += joiner[0].length;
  }

  return { value, end: index };
}
