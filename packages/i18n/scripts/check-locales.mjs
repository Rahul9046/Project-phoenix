/**
 * Locale key parity, checked without a build step.
 *
 *   npm run i18n:check
 *
 * TypeScript already enforces this: every locale is annotated `Translations`,
 * so a missing or extra key fails `tsc`. This exists for the two things the
 * type system cannot do.
 *
 * It names every difference at once. `tsc` reports the first structural
 * mismatch per file and stops being useful when a locale is behind by thirty
 * keys -- this prints the list, which is what a translator actually needs.
 *
 * And it catches the strings types cannot see: a value left in English inside a
 * translated file, an empty string, or a `{placeholder}` that was translated
 * along with the sentence and no longer matches what the code passes in. That
 * last one is silent at runtime -- the brace simply survives into the sentence
 * the member reads.
 *
 * Reads the TypeScript sources directly rather than importing them, so it needs
 * no compiler and no dependencies.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, "..", "src", "locales");

/**
 * Every dotted key and its value, pulled out of a locale file.
 *
 * A hand-rolled reader rather than a parser: these files are a single object
 * literal of nested objects and string values, written by us, in a shape this
 * package controls. Strings can span lines and can be concatenated with `+`,
 * both of which happen in `en.ts`, so both are handled.
 */
function readLocale(file) {
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

const placeholders = (text) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const files = readdirSync(localesDir).filter((name) => name.endsWith(".ts"));
const english = readLocale("en.ts");
const others = files.filter((name) => name !== "en.ts");

console.log(`\nEnglish defines ${english.size} keys.\n`);

let failures = 0;

for (const file of others) {
  const locale = file.replace(/\.ts$/, "");
  const entries = readLocale(file);

  const missing = [...english.keys()].filter((key) => !entries.has(key));
  const extra = [...entries.keys()].filter((key) => !english.has(key));

  const empty = [];
  const untranslated = [];
  const badVars = [];

  for (const [key, value] of entries) {
    const source = english.get(key);
    if (source === undefined) continue;

    if (value.trim() === "") empty.push(key);

    /*
     * A value identical to the English is usually a key somebody forgot, but
     * not always -- "Eraya", "Google" and an email placeholder are meant to be
     * the same everywhere. Anything with a Latin letter and no other script is
     * worth a look; the rest is signal-free noise.
     */
    if (value === source && /[A-Za-z]/.test(value) && value.trim().length > 3) {
      untranslated.push(key);
    }

    const want = placeholders(source).join(",");
    const got = placeholders(value).join(",");
    if (want !== got) badVars.push(`${key} (expects ${want || "none"}, has ${got || "none"})`);
  }

  const problems = [
    ["missing", missing],
    ["not in English", extra],
    ["empty", empty],
    ["placeholders differ", badVars],
  ].filter(([, list]) => list.length > 0);

  if (problems.length === 0) {
    const note = untranslated.length
      ? `  (${untranslated.length} value(s) identical to English — check they are meant to be)`
      : "";
    console.log(`  pass  ${locale}: ${entries.size} keys${note}`);
    continue;
  }

  failures += 1;
  console.log(`  FAIL  ${locale}`);
  for (const [label, list] of problems) {
    console.log(`        ${label}: ${list.slice(0, 12).join(", ")}${list.length > 12 ? ` … +${list.length - 12}` : ""}`);
  }
}

console.log(
  failures === 0
    ? `\nAll ${others.length} locales match English.\n`
    : `\n${failures} locale(s) do not match English.\n`,
);

process.exit(failures === 0 ? 0 : 1);
